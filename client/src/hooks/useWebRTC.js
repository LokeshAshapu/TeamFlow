import { useEffect, useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

export const useWebRTC = (roomId, userId, userName) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isJoined, setIsJoined] = useState(false);
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
        Object.keys(state).forEach(peerId => {
          if (peerId !== sessionId) {
            createPeerConnection(peerId);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        leftPresences.forEach(p => handleUserLeft(p.presence_ref));
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
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ userId, userName, joinedAt: new Date().toISOString() });
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
      
      Object.values(peersRef.current).forEach(({ pc }) => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      videoTrack.onended = () => {
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          Object.values(peersRef.current).forEach(({ pc }) => {
            const sender = pc.getSenders().find(s => s.track.kind === 'video');
            if (sender) sender.replaceTrack(cameraTrack);
          });
        }
      };
    } catch (err) {
      console.error('Failed to share screen', err);
    }
  };

  return {
    localStream,
    remoteStreams,
    startStream,
    toggleVideo,
    toggleAudio,
    startScreenShare,
    isJoined
  };
};
