import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useWebRTC = (roomId, userId, userName) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const socketRef = useRef(null);
  const peersRef = useRef({}); // Map socketId to { pc, makingOffer, ignoreOffer, isSettingRemoteAnswerPending }

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  const handleUserLeft = useCallback((socketId) => {
    if (peersRef.current[socketId]) {
      peersRef.current[socketId].pc.close();
      delete peersRef.current[socketId];
      setRemoteStreams(prev => {
        const next = { ...prev };
        delete next[socketId];
        return next;
      });
    }
  }, []);

  const createPeerConnection = useCallback(async (socketId) => {
    if (peersRef.current[socketId]) return peersRef.current[socketId].pc;

    const pc = new RTCPeerConnection(configuration);
    const peerData = {
      pc,
      makingOffer: false,
      ignoreOffer: false,
      isSettingRemoteAnswerPending: false
    };
    peersRef.current[socketId] = peerData;

    // Politeness logic: lexicographical comparison of socket IDs
    const isPolite = socketRef.current.id < socketId;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = ({ candidate }) => {
      socketRef.current.emit('ice-candidate', { to: socketId, candidate });
    };

    pc.ontrack = ({ streams }) => {
      setRemoteStreams(prev => ({
        ...prev,
        [socketId]: streams[0]
      }));
    };

    pc.onnegotiationneeded = async () => {
      try {
        console.log('Negotiation needed for:', socketId);
        peerData.makingOffer = true;
        await pc.setLocalDescription();
        socketRef.current.emit('offer', { to: socketId, offer: pc.localDescription });
      } catch (err) {
        console.error('Negotiation error:', err);
      } finally {
        peerData.makingOffer = false;
      }
    };

    pc.onsignalingstatechange = () => {
      console.log('Signaling state change:', pc.signalingState, 'for:', socketId);
    };

    pc.oniceconnectionstatechange = () => {
      console.log('ICE state change:', pc.iceConnectionState, 'for:', socketId);
      if (pc.iceConnectionState === 'disconnected' || pc.iceConnectionState === 'failed') {
        handleUserLeft(socketId);
      }
    };

    return pc;
  }, [localStream, handleUserLeft]);

  useEffect(() => {
    if (!roomId || !userId) return;

    console.log('Connecting to room:', roomId);
    socketRef.current = io(SOCKET_SERVER);
    
    socketRef.current.on('user-joined', async ({ socketId, userName: joinedName }) => {
      console.log('User joined event:', joinedName, socketId);
      await createPeerConnection(socketId);
    });

    socketRef.current.on('offer', async ({ from, offer }) => {
      try {
        console.log('Received offer from:', from);
        const pc = await createPeerConnection(from);
        const peerData = peersRef.current[from];
        const isPolite = socketRef.current.id && socketRef.current.id < from;

        const offerCollision = peerData.makingOffer || pc.signalingState !== 'stable';
        peerData.ignoreOffer = !isPolite && offerCollision;

        if (peerData.ignoreOffer) {
          console.log('Ignoring offer collision from:', from);
          return;
        }

        if (offerCollision) {
          console.log('Handling offer collision (polite peer) with:', from);
          await Promise.all([
            pc.setLocalDescription({ type: 'rollback' }),
            pc.setRemoteDescription(offer)
          ]);
        } else {
          await pc.setRemoteDescription(offer);
        }

        await pc.setLocalDescription();
        socketRef.current.emit('answer', { to: from, answer: pc.localDescription });
      } catch (err) {
        console.error('Offer error:', err);
      }
    });

    socketRef.current.on('answer', async ({ from, answer }) => {
      try {
        console.log('Received answer from:', from);
        const peerData = peersRef.current[from];
        if (peerData) {
          await peerData.pc.setRemoteDescription(answer);
        }
      } catch (err) {
        console.error('Answer error:', err);
      }
    });

    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      try {
        const peerData = peersRef.current[from];
        if (peerData) {
          await peerData.pc.addIceCandidate(candidate);
        }
      } catch (err) {
        // Ignore errors for candidates arriving before descriptions
      }
    });

    socketRef.current.on('user-left', ({ socketId }) => {
      handleUserLeft(socketId);
    });

    socketRef.current.emit('join-room', { roomId, userId, userName });

    return () => {
      socketRef.current.disconnect();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(p => p.pc.close());
      peersRef.current = {};
    };
  }, [roomId, userId, userName, createPeerConnection, handleUserLeft]);

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
