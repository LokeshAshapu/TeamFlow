import React, { useEffect, useRef, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Video, VideoOff, Mic, MicOff, Monitor, PhoneOff, 
  Users, Maximize2, LayoutGrid, X, ChevronRight, MessageSquare, 
  ShieldCheck, Settings, AlertCircle, Send, User, MonitorUp, Paperclip, FileText, Image as ImageIcon, Download
} from 'lucide-react';

const ParticipantTile = ({ stream, name, isLocal, isStreaming, isVideoOn, participantId, isPinned, isScreenSharing, onPin }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
      // CRITICAL FIX: explicit play() is required by some browsers when dynamically assigning srcObject
      videoRef.current.play().catch(e => console.error("Video play error:", e));
    }
  }, [stream, isScreenSharing, isVideoOn]);

  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  return (
    <div className={`relative bg-gray-900 rounded-xl overflow-hidden shadow-2xl group transition-all duration-300 ring-1 ring-white/10 ${isPinned ? 'w-full h-full' : 'aspect-video w-full'}`}>
      {/* 
        CRITICAL FIX: 
        We use opacity-0 and pointer-events-none instead of display:none (hidden). 
        Safari and mobile browsers will PAUSE a video element if it has display: none, which mutes the audio.
      */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`absolute inset-0 w-full h-full transition-opacity duration-300 ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''} ${isStreaming && (isVideoOn || isScreenSharing) ? 'opacity-100 z-10' : 'opacity-0 z-0 pointer-events-none'}`}
      />
      
      {/* Avatar Fallback Layer */}
      <div className={`absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gray-800 transition-opacity duration-300 ${(!isStreaming || (!isVideoOn && !isScreenSharing)) ? 'opacity-100 z-20' : 'opacity-0 z-0 pointer-events-none'}`}>
        <div className="w-20 h-20 rounded-full bg-gray-700 border border-gray-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg mb-2">
          {initials}
        </div>
      </div>
      
      <div className="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg text-white text-xs font-semibold z-30">
        <div className={`w-2 h-2 rounded-full ${isStreaming ? (isVideoOn || isScreenSharing ? 'bg-green-500' : 'bg-yellow-500') : 'bg-red-500'}`}></div>
        {name} {isLocal && '(You)'}
        {isScreenSharing && <Monitor size={12} className="ml-1 text-blue-400" />}
      </div>

      <div className="absolute top-3 right-3 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-30">
        {onPin && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className={`p-2 backdrop-blur-md rounded-lg transition-colors ${isPinned ? 'bg-blue-600 text-white' : 'bg-black/60 text-gray-300 hover:text-white'}`}
            title={isPinned ? "Unpin" : "Pin to main screen"}
          >
            <Maximize2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
};

const Meetings = () => {
  const { profile } = useAuth();
  const [team, setTeam] = useState(null);
  
  const [pinnedSessionId, setPinnedSessionId] = useState(null);

  // Use a stable room ID once profile is loaded
  const roomId = profile?.team_id ? `team-${profile.team_id}` : (profile ? 'general-meeting' : null);
  
  const { 
    localStream, 
    remoteStreams, 
    startStream, 
    toggleVideo, 
    toggleAudio, 
    startScreenShare,
    stopScreenShare,
    isJoined,
    participants,
    sessionId,
    activeParticipants,
    isMeetingActive,
    localIsScreenSharing,
    connectionStatus,
    messages,
    sendMessage
  } = useWebRTC(roomId, profile?.id, profile?.full_name);

  // Auto-pin screen sharer
  useEffect(() => {
    const sharer = participants.find(p => p.isScreenSharing);
    if (sharer) {
      setPinnedSessionId(sharer.sessionId);
    } else if (pinnedSessionId) {
      const stillExists = participants.find(p => p.sessionId === pinnedSessionId);
      if (!stillExists) setPinnedSessionId(null);
    }
  }, [participants, pinnedSessionId]);

  const handlePin = (id) => {
    setPinnedSessionId(prev => prev === id ? null : id);
  };

  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [chatMessage, setChatMessage] = useState('');
  const [attachment, setAttachment] = useState(null);
  const fileInputRef = useRef(null);
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert("File is too large. Maximum size is 2MB for real-time chat.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setAttachment({
        name: file.name,
        type: file.type,
        data: event.target.result // Base64 data URL
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (chatMessage.trim() || attachment) {
      sendMessage(chatMessage, attachment);
      setChatMessage('');
      setAttachment(null);
    }
  };

  useEffect(() => {
    if (profile?.team_id) {
      fetchTeam();
    }
  }, [profile]);

  const fetchTeam = async () => {
    const { data } = await supabase.from('teams').select('name').eq('id', profile.team_id).single();
    if (data) setTeam(data);
  };

  const handleToggleVideo = async () => {
    const newState = await toggleVideo();
    setIsVideoOn(newState);
  };

  const handleToggleAudio = () => {
    toggleAudio();
    setIsMicOn(!isMicOn);
  };
  
  const handleLeave = () => {
    window.location.reload();
  };

  const participantCount = participants.length;

  if (!isJoined) {
    return (
      <div className="h-[calc(100vh-8rem)] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-3xl border border-gray-200 shadow-xl p-8 text-center animate-fade-in">
          <div className={`w-24 h-24 rounded-full mx-auto flex items-center justify-center mb-6 shadow-inner transition-colors ${isMeetingActive ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-primary'}`}>
            <Video size={48} />
          </div>
          
          <h2 className="text-3xl font-bold mb-3 text-secondary">
            {isMeetingActive ? 'Meeting in Progress' : 'Ready to Join?'}
          </h2>
          
          <div className="text-gray-500 mb-8 max-w-sm mx-auto">
            {isMeetingActive ? (
              <div className="flex flex-col items-center gap-3">
                <p className="font-medium text-gray-700">
                  {activeParticipants.map(p => p.userName).join(', ')} {activeParticipants.length === 1 ? 'is' : 'are'} in the meeting.
                </p>
                <div className="flex -space-x-3">
                  {activeParticipants.slice(0, 4).map((p, i) => (
                    <div key={i} className="w-10 h-10 rounded-full bg-primary border-2 border-white flex items-center justify-center text-xs text-white font-bold uppercase shadow-sm">
                      {p.userName?.charAt(0)}
                    </div>
                  ))}
                  {activeParticipants.length > 4 && (
                    <div className="w-10 h-10 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-xs text-gray-600 font-bold shadow-sm">
                      +{activeParticipants.length - 4}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="font-medium">
                Join the {team ? team.name : 'General'} meeting room. Turn on your camera and microphone to start collaborating.
              </p>
            )}
          </div>

          <button 
            onClick={startStream}
            className={`w-full py-4 text-lg font-bold text-white rounded-2xl shadow-xl transition-all hover:-translate-y-1 active:translate-y-0 ${isMeetingActive ? 'bg-green-600 hover:bg-green-700 shadow-green-500/30' : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/30'}`}
          >
            {isMeetingActive ? 'Join Meeting Now' : 'Start Session'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-gray-950 flex flex-col font-sans text-gray-100 animate-fade-in">
      {/* Zoom-like Dark Header */}
      <header className="flex items-center justify-between px-6 py-4 bg-gray-900 border-b border-gray-800 shrink-0 shadow-lg z-20">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-8 h-8 rounded bg-blue-600/20 text-blue-500">
            <ShieldCheck size={18} />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-white">Meeting Room: {team ? team.name : 'General'}</h1>
            <p className="text-xs text-gray-400 font-mono">Room ID: {roomId}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {connectionStatus === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1 rounded bg-red-500/10 text-red-400 text-sm">
              <AlertCircle size={14} /> Connection Error
            </div>
          )}
          <div className="px-3 py-1 rounded bg-gray-800 text-gray-300 text-sm font-medium flex items-center gap-2">
            <Users size={14} /> {participantCount}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 p-4 overflow-hidden flex flex-col">
          {pinnedSessionId ? (
            /* Spotlight View */
            <div className="flex-1 flex flex-col xl:flex-row gap-4 h-full">
              <div className="flex-1 xl:w-3/4 h-full rounded-2xl overflow-hidden bg-black shadow-2xl relative ring-1 ring-white/5">
                {(() => {
                  const pinnedParticipant = participants.find(p => p.sessionId === pinnedSessionId) || {
                    sessionId,
                    userId: profile?.id,
                    userName: profile?.full_name,
                    isStreaming: isJoined,
                    isVideoOn,
                    isScreenSharing: localIsScreenSharing
                  };
                  const streamToUse = pinnedParticipant.sessionId === sessionId ? localStream : remoteStreams[pinnedParticipant.sessionId];
                  
                  return (
                    <ParticipantTile 
                      stream={streamToUse} 
                      name={pinnedParticipant.userName} 
                      isLocal={pinnedParticipant.sessionId === sessionId}
                      isStreaming={pinnedParticipant.isStreaming}
                      isVideoOn={pinnedParticipant.isVideoOn}
                      isScreenSharing={pinnedParticipant.isScreenSharing}
                      participantId={pinnedParticipant.userId}
                      isPinned={true}
                      onPin={() => handlePin(pinnedParticipant.sessionId)}
                    />
                  );
                })()}
              </div>
              <div className="w-full xl:w-64 flex xl:flex-col gap-4 overflow-x-auto xl:overflow-y-auto pb-2 xl:pb-0 scrollbar-hide">
                {/* Local Participant in Sidebar */}
                {pinnedSessionId !== sessionId && (
                  <div className="w-48 xl:w-full shrink-0">
                    <ParticipantTile 
                      stream={localStream} 
                      name={profile?.full_name} 
                      isLocal={true} 
                      isStreaming={isJoined}
                      isVideoOn={isVideoOn}
                      isScreenSharing={localIsScreenSharing}
                      participantId={profile?.id}
                      onPin={() => handlePin(sessionId)}
                    />
                  </div>
                )}
                
                {/* Remote Participants in Sidebar */}
                {participants.filter(p => p.sessionId !== sessionId && p.sessionId !== pinnedSessionId).map((p) => (
                  <div key={p.sessionId} className="w-48 xl:w-full shrink-0">
                    <ParticipantTile 
                      stream={remoteStreams[p.sessionId]} 
                      name={p.userName} 
                      isLocal={false}
                      isStreaming={p.isStreaming}
                      isVideoOn={p.isVideoOn}
                      isScreenSharing={p.isScreenSharing}
                      participantId={p.userId}
                      onPin={() => handlePin(p.sessionId)}
                    />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            /* Grid View */
            <div className={`flex-1 grid gap-4 place-content-center w-full h-full p-4 ${
              participantCount <= 1 ? 'grid-cols-1 max-w-4xl mx-auto' : 
              participantCount === 2 ? 'grid-cols-1 md:grid-cols-2 max-w-6xl mx-auto' : 
              participantCount <= 4 ? 'grid-cols-2 max-w-6xl mx-auto' : 
              participantCount <= 6 ? 'grid-cols-2 md:grid-cols-3 max-w-7xl mx-auto' : 
              'grid-cols-3 lg:grid-cols-4 max-w-7xl mx-auto'
            }`}>
              <ParticipantTile 
                stream={localStream} 
                name={profile?.full_name} 
                isLocal={true} 
                isStreaming={isJoined}
                isVideoOn={isVideoOn}
                isScreenSharing={localIsScreenSharing}
                participantId={profile?.id}
                onPin={() => handlePin(sessionId)}
              />
              
              {participants.filter(p => p.sessionId !== sessionId).map((p) => (
                <ParticipantTile 
                  key={p.sessionId}
                  stream={remoteStreams[p.sessionId]} 
                  name={p.userName} 
                  isLocal={false}
                  isStreaming={p.isStreaming}
                  isVideoOn={p.isVideoOn}
                  isScreenSharing={p.isScreenSharing}
                  participantId={p.userId}
                  onPin={() => handlePin(p.sessionId)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Sidebars (Chat / Participants) */}
        {(showChat || showParticipants) && (
          <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col shrink-0 shadow-2xl z-20 transition-all">
            <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900 shadow-sm">
              <h3 className="font-semibold text-white flex items-center gap-2">
                {showChat ? <><MessageSquare size={16} /> Meeting Chat</> : <><Users size={16} /> Participants ({participantCount})</>}
              </h3>
              <button 
                onClick={() => { setShowChat(false); setShowParticipants(false); }}
                className="text-gray-400 hover:text-white transition-colors p-1"
              >
                <X size={18} />
              </button>
            </div>

            {showChat && (
              <div className="flex-1 flex flex-col min-h-0 bg-gray-900">
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {messages.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500 text-center">
                      <MessageSquare size={48} className="mb-4 opacity-20" />
                      <p>No messages yet.</p>
                      <p className="text-sm">Start the conversation!</p>
                    </div>
                  ) : (
                    messages.map((msg, i) => {
                      const isMe = msg.senderId === sessionId;
                      return (
                        <div key={i} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                          <span className="text-[10px] text-gray-500 mb-1 ml-1">{isMe ? 'You' : msg.senderName}</span>
                          <div className={`px-4 py-2 rounded-2xl max-w-[85%] text-sm ${isMe ? 'bg-blue-600 text-white rounded-br-none' : 'bg-gray-800 text-gray-200 rounded-bl-none'}`}>
                            {msg.attachment && (
                              <div className="mb-2">
                                {msg.attachment.type.startsWith('image/') ? (
                                  <img src={msg.attachment.data} alt="attachment" className="max-w-full rounded-lg border border-white/20" />
                                ) : (
                                  <a 
                                    href="#" 
                                    onClick={(e) => {
                                      e.preventDefault();
                                      try {
                                        fetch(msg.attachment.data)
                                          .then(res => res.blob())
                                          .then(blob => {
                                            const url = window.URL.createObjectURL(blob);
                                            const a = document.createElement('a');
                                            a.href = url;
                                            a.download = msg.attachment.name;
                                            document.body.appendChild(a);
                                            a.click();
                                            document.body.removeChild(a);
                                            window.URL.revokeObjectURL(url);
                                          });
                                      } catch (err) {
                                        console.error("Download failed:", err);
                                      }
                                    }}
                                    className="flex items-center gap-2 p-2 bg-black/20 rounded-lg hover:bg-black/40 transition-colors text-white"
                                  >
                                    <FileText size={16} />
                                    <span className="truncate max-w-[150px]">{msg.attachment.name}</span>
                                    <Download size={14} className="ml-auto" />
                                  </a>
                                )}
                              </div>
                            )}
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={chatEndRef} />
                </div>
                
                {attachment && (
                  <div className="px-3 py-2 bg-gray-800 border-t border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-gray-300 overflow-hidden">
                      {attachment.type.startsWith('image/') ? <ImageIcon size={14} /> : <FileText size={14} />}
                      <span className="truncate">{attachment.name}</span>
                    </div>
                    <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-white">
                      <X size={14} />
                    </button>
                  </div>
                )}

                <form onSubmit={handleSendMessage} className="p-3 border-t border-gray-800 bg-gray-900">
                  <div className="flex items-center gap-2 relative">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2.5 text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"
                      title="Attach File"
                    >
                      <Paperclip size={18} />
                    </button>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      onChange={handleFileChange} 
                      className="hidden" 
                      accept="image/*,.pdf,.doc,.docx,.txt"
                    />
                    
                    <div className="relative flex-1">
                      <input
                        type="text"
                        value={chatMessage}
                        onChange={(e) => setChatMessage(e.target.value)}
                        placeholder="Type a message..."
                        className="w-full bg-gray-800 text-white placeholder-gray-500 border-none rounded-xl pl-4 pr-10 py-2.5 focus:ring-1 focus:ring-blue-500 outline-none"
                      />
                      <button 
                        type="submit" 
                        disabled={!chatMessage.trim() && !attachment}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 text-white rounded-lg disabled:opacity-50 disabled:bg-gray-700 transition-colors"
                      >
                        <Send size={14} />
                      </button>
                    </div>
                  </div>
                </form>
              </div>
            )}

            {showParticipants && (
              <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-gray-900">
                {/* Local User */}
                <div className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-xl transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-900 text-blue-300 flex items-center justify-center font-bold text-xs">
                      {profile?.full_name?.charAt(0)}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-200">{profile?.full_name} <span className="text-gray-500 text-xs">(You)</span></p>
                    </div>
                  </div>
                  <div className="flex gap-2 text-gray-400">
                    {isMicOn ? <Mic size={14} /> : <MicOff size={14} className="text-red-500" />}
                    {isVideoOn ? <Video size={14} /> : <VideoOff size={14} className="text-red-500" />}
                  </div>
                </div>

                {/* Remote Users */}
                {participants.filter(p => p.sessionId !== sessionId).map((p) => (
                  <div key={p.sessionId} className="flex items-center justify-between p-3 hover:bg-gray-800 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-gray-800 text-gray-300 flex items-center justify-center font-bold text-xs border border-gray-700">
                        {p.userName?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-200">{p.userName}</p>
                      </div>
                    </div>
                    <div className="flex gap-2 text-gray-400">
                      {p.isVideoOn ? <Video size={14} /> : <VideoOff size={14} className="text-red-500" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Zoom-like Bottom Control Bar */}
      <div className="bg-gray-900 border-t border-gray-800 px-4 sm:px-8 py-3 flex items-center justify-between shrink-0 shadow-[0_-10px_30px_rgba(0,0,0,0.5)] z-20">
        <div className="flex items-center gap-1 sm:gap-4 w-1/3">
          <div className="flex flex-col items-center">
            <button 
              onClick={handleToggleAudio}
              className={`p-3 sm:p-4 rounded-xl transition-all ${isMicOn ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
            >
              {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">{isMicOn ? 'Mute' : 'Unmute'}</span>
          </div>
          
          <div className="flex flex-col items-center">
            <button 
              onClick={handleToggleVideo}
              className={`p-3 sm:p-4 rounded-xl transition-all ${isVideoOn ? 'bg-gray-800 text-gray-200 hover:bg-gray-700' : 'bg-red-500/20 text-red-500 hover:bg-red-500/30'}`}
            >
              {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">{isVideoOn ? 'Stop Video' : 'Start Video'}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-4 justify-center w-1/3">
          <div className="flex flex-col items-center">
            <button 
              onClick={() => {
                setShowParticipants(!showParticipants);
                if (showChat) setShowChat(false);
              }}
              className={`p-3 sm:p-4 rounded-xl transition-all relative ${showParticipants ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
            >
              <Users size={22} />
              <div className="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-[10px] w-5 h-5 rounded-full flex items-center justify-center font-bold border-2 border-gray-900">
                {participantCount}
              </div>
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">Participants</span>
          </div>

          <div className="flex flex-col items-center">
            <button 
              onClick={() => {
                if (localIsScreenSharing) stopScreenShare();
                else startScreenShare();
              }}
              className={`p-3 sm:p-4 rounded-xl transition-all ${localIsScreenSharing ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30 shadow-lg shadow-green-500/10' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
            >
              <MonitorUp size={22} />
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">{localIsScreenSharing ? 'Stop Share' : 'Share Screen'}</span>
          </div>

          <div className="flex flex-col items-center">
            <button 
              onClick={() => {
                setShowChat(!showChat);
                if (showParticipants) setShowParticipants(false);
              }}
              className={`p-3 sm:p-4 rounded-xl transition-all ${showChat ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/20' : 'bg-gray-800 text-gray-200 hover:bg-gray-700'}`}
            >
              <MessageSquare size={22} />
            </button>
            <span className="text-[10px] sm:text-xs text-gray-400 mt-1.5 font-medium">Chat</span>
          </div>
        </div>

        <div className="flex items-center justify-end w-1/3">
          <button 
            onClick={handleLeave}
            className="bg-red-600 hover:bg-red-700 text-white px-6 sm:px-8 py-3 rounded-xl font-bold transition-all shadow-lg shadow-red-600/30 flex items-center gap-2 hover:scale-105 active:scale-95"
          >
            <PhoneOff size={20} />
            <span className="hidden sm:inline">Leave Meeting</span>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Meetings;
