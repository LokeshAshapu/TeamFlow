import { useEffect, useRef, useState, useCallback } from 'react';
import io from 'socket.io-client';

const SOCKET_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:5000';

export const useWebRTC = (roomId, userId, userName) => {
  const [localStream, setLocalStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [isJoined, setIsJoined] = useState(false);
  const socketRef = useRef(null);
  const peersRef = useRef({}); // Map socketId to RTCPeerConnection

  const configuration = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' },
    ]
  };

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER);
    
    socketRef.current.emit('join-room', { roomId, userId, userName });

    socketRef.current.on('user-joined', async ({ socketId, userName: joinedUserName }) => {
      console.log('User joined:', joinedUserName);
      await createPeerConnection(socketId, true);
    });

    socketRef.current.on('offer', async ({ from, offer }) => {
      const pc = await createPeerConnection(from, false);
      await pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socketRef.current.emit('answer', { to: from, answer });
    });

    socketRef.current.on('answer', async ({ from, answer }) => {
      const pc = peersRef.current[from];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
      }
    });

    socketRef.current.on('ice-candidate', async ({ from, candidate }) => {
      const pc = peersRef.current[from];
      if (pc) {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      }
    });

    socketRef.current.on('user-left', ({ socketId }) => {
      if (peersRef.current[socketId]) {
        peersRef.current[socketId].close();
        delete peersRef.current[socketId];
        setRemoteStreams(prev => {
          const next = { ...prev };
          delete next[socketId];
          return next;
        });
      }
    });

    return () => {
      socketRef.current.disconnect();
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }
      Object.values(peersRef.current).forEach(pc => pc.close());
    };
  }, [roomId, userId, userName]);

  const createPeerConnection = async (socketId, isInitiator) => {
    const pc = new RTCPeerConnection(configuration);
    peersRef.current[socketId] = pc;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socketRef.current.emit('ice-candidate', { to: socketId, candidate: event.candidate });
      }
    };

    pc.ontrack = (event) => {
      setRemoteStreams(prev => ({
        ...prev,
        [socketId]: event.streams[0]
      }));
    };

    if (isInitiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socketRef.current.emit('offer', { to: socketId, offer });
    }

    return pc;
  };

  const startStream = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setLocalStream(stream);
      // Update all existing connections with the new stream
      Object.values(peersRef.current).forEach(pc => {
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
      
      Object.values(peersRef.current).forEach(pc => {
        const sender = pc.getSenders().find(s => s.track.kind === 'video');
        if (sender) sender.replaceTrack(videoTrack);
      });

      videoTrack.onended = () => {
        // Switch back to camera
        if (localStream) {
          const cameraTrack = localStream.getVideoTracks()[0];
          Object.values(peersRef.current).forEach(pc => {
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
