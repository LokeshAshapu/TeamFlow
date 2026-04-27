import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useWebRTC = (roomId, userId, userName) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [participants, setParticipants] = useState([]);
  const [isJoined, setIsJoined] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connecting' | 'connected' | 'disconnected' | 'error'
  const [messages, setMessages] = useState(() => {
    // Load from session storage for the specific room
    const saved = sessionStorage.getItem(`chat-${roomId}`);
    return saved ? JSON.parse(saved) : [];
  });
  const channelRef = useRef(null);
  const peersRef = useRef({}); // Map sessionId to { pc, makingOffer, ignoreOffer }
  const sessionId = useRef(Math.random().toString(36).substring(7)).current;

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const handleUserLeft = useCallback((peerSessionId) => {
    if (peersRef.current[peerSessionId]) {
      peersRef.current[peerSessionId].pc.close();
      delete peersRef.current[peerSessionId];
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[peerSessionId];
        return next;
      });
    }
  }, []);

  const createPeerConnection = useCallback(async (peerSessionId) => {
    if (peersRef.current[peerSessionId]) return peersRef.current[peerSessionId].pc;

    console.log('Creating PC for session:', peerSessionId);
    const pc = new RTCPeerConnection(configuration);
    const peerData = {
      pc,
      makingOffer: false,
      ignoreOffer: false
    };
    peersRef.current[peerSessionId] = peerData;

    // Politeness logic: lexicographical comparison of session IDs
    const isPolite = sessionId < peerSessionId;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'ice-candidate',
          payload: { from: sessionId, to: peerSessionId, candidate }
        });
      }
    };

    pc.ontrack = ({ streams }) => {
      console.log('Received remote track from:', peerSessionId);
      setRemoteStreams(prev => ({
        ...prev,
        [peerSessionId]: streams[0]
      }));
    };

    pc.onnegotiationneeded = async () => {
      try {
        peerData.makingOffer = true;
        await pc.setLocalDescription();
        channelRef.current.send({
          type: 'broadcast',
          event: 'offer',
          payload: { from: sessionId, to: peerSessionId, offer: pc.localDescription }
        });
      } catch (err) {
        console.error('Negotiation error:', err);
      } finally {
        peerData.makingOffer = false;
      }
    };

    pc.oniceconnectionstatechange = () => {
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handleUserLeft(peerSessionId);
      }
    };

    return pc;
  }, [localStream, handleUserLeft, sessionId]);

  useEffect(() => {
    if (!roomId || !userId) return;

    console.log('Joining Supabase channel:', roomId, 'as session:', sessionId);
    const channel = supabase.channel(roomId, {
      config: {
        presence: { key: sessionId }
      }
    });
    channelRef.current = channel;

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        console.log('Presence Sync State:', state);
        
        // Convert presence state to list of participant info and uniqueify by userId
        const allUsers = Object.values(state).flat().map(p => ({
          sessionId: p.presence_ref,
          userId: p.userId,
          userName: p.userName,
          isStreaming: p.isStreaming,
          joinedAt: p.joinedAt
        }));

        // No longer uniqueifying by userId to allow multiple devices
        setParticipants(allUsers);

        // Create peer connections and handle negotiation for users who are streaming
        Object.values(state).flat().forEach(async (p) => {
          const peerId = p.presence_ref;
          if (peerId !== sessionId && p.isStreaming) {
            const pc = await createPeerConnection(peerId);
            // If the PC already existed but we just found out they are streaming, 
            // the tracks might already be added, but negotiation will trigger if needed.
          }
        });
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        console.log('User joined presence:', key, newPresences);
        setParticipants(prev => {
          const all = [...prev];
          newPresences.forEach(p => {
            if (!all.find(x => x.sessionId === p.presence_ref)) {
              all.push({
                sessionId: p.presence_ref,
                userId: p.userId,
                userName: p.userName,
                isStreaming: p.isStreaming,
                joinedAt: p.joinedAt
              });
            }
          });
          return all;
        });
        
        // If a newly joined user is already streaming, connect to them
        newPresences.forEach(p => {
          if (p.presence_ref !== sessionId && p.isStreaming) {
            createPeerConnection(p.presence_ref);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => handleUserLeft(p.presence_ref));
        setParticipants(prev => prev.filter(p => !leftPresences.find(lp => lp.presence_ref === p.sessionId)));
      })
      .on('broadcast', { event: 'offer' }, async ({ payload }) => {
        if (payload.to !== sessionId) return;
        try {
          console.log('Received offer from:', payload.from);
          const pc = await createPeerConnection(payload.from);
          const peerData = peersRef.current[payload.from];
          const isPolite = sessionId < payload.from;

          const offerCollision = peerData.makingOffer || pc.signalingState !== 'stable';
          peerData.ignoreOffer = !isPolite && offerCollision;

          if (peerData.ignoreOffer) return;

          if (offerCollision) {
            await Promise.all([
              pc.setLocalDescription({ type: 'rollback' }),
              pc.setRemoteDescription(payload.offer)
            ]);
          } else {
            await pc.setRemoteDescription(payload.offer);
          }

          await pc.setLocalDescription();
          channel.send({
            type: 'broadcast',
            event: 'answer',
            payload: { from: sessionId, to: payload.from, answer: pc.localDescription }
          });
        } catch (err) {
          console.error('Offer error:', err);
        }
      })
      .on('broadcast', { event: 'answer' }, async ({ payload }) => {
        if (payload.to !== sessionId) return;
        try {
          const peerData = peersRef.current[payload.from];
          if (peerData) {
            await peerData.pc.setRemoteDescription(payload.answer);
          }
        } catch (err) {
          console.error('Answer error:', err);
        }
      })
      .on('broadcast', { event: 'ice-candidate' }, async ({ payload }) => {
        if (payload.to !== sessionId) return;
        try {
          const peerData = peersRef.current[payload.from];
          if (peerData) {
            await peerData.pc.addIceCandidate(payload.candidate);
          }
        } catch (err) {
          // Ignore candidate errors
        }
      })
      .on('broadcast', { event: 'chat-message' }, ({ payload }) => {
        console.log('Received chat message:', payload);
        const newMessage = {
          id: Math.random().toString(36).substring(7),
          senderId: payload.senderId,
          senderName: payload.senderName,
          content: payload.content,
          timestamp: new Date().toISOString()
        };
        setMessages(prev => {
          const next = [...prev, newMessage];
          sessionStorage.setItem(`chat-${roomId}`, JSON.stringify(next));
          return next;
        });
      })
      .on('broadcast', { event: 'history-request' }, ({ payload }) => {
        // If we have messages, send them to the new joiner
        if (messages.length > 0) {
          console.log('Sending history to:', payload.from);
          channel.send({
            type: 'broadcast',
            event: 'history-response',
            payload: { to: payload.from, messages }
          });
        }
      })
      .on('broadcast', { event: 'history-response' }, ({ payload }) => {
        // If the history is for us, and we don't have many messages yet
        if (payload.to === sessionId) {
          console.log('Received history sync');
          setMessages(prev => {
            // Merge and uniqueify by ID
            const combined = [...prev, ...payload.messages];
            const unique = Array.from(new Map(combined.map(m => [m.id, m])).values());
            unique.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
            sessionStorage.setItem(`chat-${roomId}`, JSON.stringify(unique));
            return unique;
          });
        }
      })
      .subscribe(async (status) => {
        console.log('Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
          console.log('Successfully subscribed to channel');
          
          // Request history from others
          channel.send({
            type: 'broadcast',
            event: 'history-request',
            payload: { from: sessionId }
          });

          // Track immediately as NOT streaming
          await channel.track({ 
            userId, 
            userName, 
            isStreaming: false,
            joinedAt: new Date().toISOString() 
          });
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          setConnectionStatus('error');
        } else if (status === 'CLOSED') {
          setConnectionStatus('disconnected');
        }
      });

    return () => {
      channel.unsubscribe();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(p => p.pc.close());
      peersRef.current = {};
    };
  }, [roomId, userId, userName, createPeerConnection, handleUserLeft, sessionId]);

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      
      Object.values(peersRef.current).forEach(({ pc }) => {
        stream.getTracks().forEach(track => pc.addTrack(track, stream));
      });
      
      // Update tracking to indicate we are now streaming
      if (channelRef.current) {
        await channelRef.current.track({ 
          userId, 
          userName, 
          isStreaming: true,
          joinedAt: new Date().toISOString(),
          sessionId // Include sessionId in metadata for easier debugging
        });
      }
      
      setIsJoined(true);
    } catch (err) {
      console.error('Failed to get local stream', err);
    }
  };

  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      videoTrack.enabled = !videoTrack.enabled;
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      audioTrack.enabled = !audioTrack.enabled;
    }
  };

  const startScreenShare = async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      const videoTrack = screenStream.getVideoTracks()[0];
      
      // Update local stream for local tile visibility
      if (localStream) {
        const currentVideoTrack = localStream.getVideoTracks()[0];
        if (currentVideoTrack) {
          localStream.removeTrack(currentVideoTrack);
          localStream.addTrack(videoTrack);
          // Trigger a re-render by setting a "new" stream object (clone or state update)
          setLocalStream(new MediaStream(localStream.getTracks()));
        }
      }

      Object.values(peersRef.current).forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        if (sender) {
          sender.replaceTrack(videoTrack);
        } else {
          // If no video sender exists, add the track
          pc.addTrack(videoTrack, localStream);
        }
      });

      videoTrack.onended = () => {
        stopScreenShare(videoTrack);
      };

      return screenStream;
    } catch (err) {
      console.error('Failed to share screen', err);
    }
  };

  const stopScreenShare = async (screenTrack) => {
    try {
      if (screenTrack) screenTrack.stop();
      
      // Re-acquire camera stream
      const cameraStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      const cameraTrack = cameraStream.getVideoTracks()[0];

      if (localStream) {
        const currentTracks = localStream.getTracks();
        currentTracks.forEach(t => {
          if (t.kind === 'video') {
            localStream.removeTrack(t);
            t.stop();
          }
        });
        localStream.addTrack(cameraTrack);
        setLocalStream(new MediaStream(localStream.getTracks()));
      }

      for (const { pc } of Object.values(peersRef.current)) {
        const senders = pc.getSenders();
        const videoSender = senders.find(s => s.track?.kind === 'video');
        if (videoSender) {
          await videoSender.replaceTrack(cameraTrack);
        }
      }
    } catch (err) {
      console.error('Failed to stop screen share', err);
    }
  };

  const sendMessage = (content) => {
    if (!channelRef.current || !content.trim()) return;

    const message = {
      senderId: userId,
      senderName: userName,
      content: content.trim()
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'chat-message',
      payload: message
    });

    // Add to local state immediately
    const newMessage = {
      id: Math.random().toString(36).substring(7),
      ...message,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => {
      const next = [...prev, newMessage];
      sessionStorage.setItem(`chat-${roomId}`, JSON.stringify(next));
      return next;
    });
  };

  return {
    localStream,
    remoteStreams,
    startStream,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    isJoined,
    participants,
    sessionId, // Export local sessionId
    activeParticipants: participants.filter(p => p.isStreaming),
    isMeetingActive: participants.some(p => p.isStreaming),
    connectionStatus,
    messages,
    sendMessage
  };
};
