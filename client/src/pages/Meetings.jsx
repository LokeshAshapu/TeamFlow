import React, { useEffect, useRef, useState } from 'react';
import { useWebRTC } from '../hooks/useWebRTC';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Video, 
  VideoOff, 
  Mic, 
  MicOff, 
  Monitor, 
  PhoneOff, 
  Users,
  Maximize2,
  LayoutGrid,
  X,
  ChevronRight,
  MessageSquare,
  ShieldCheck,
  Settings,
  WifiOff,
  RefreshCw,
  LogOut,
  AlertCircle,
  Send,
  User
} from 'lucide-react';

const ParticipantTile = ({ stream, name, isLocal, isStreaming, isVideoOn, participantId, isPinned, isScreenSharing, onPin }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isScreenSharing, isVideoOn]);

  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  return (
    <div className={`relative bg-secondary/95 rounded-2xl overflow-hidden shadow-2xl group animate-fade-in ring-1 ring-white/10 ${isPinned ? 'w-full h-full' : 'aspect-video'}`}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full ${isStreaming && (isVideoOn || isScreenSharing) ? 'block' : 'hidden'} ${isScreenSharing ? 'object-contain bg-black' : 'object-cover'} ${isLocal && !isScreenSharing ? 'scale-x-[-1]' : ''}`}
      />
      
      {(!isStreaming || (!isVideoOn && !isScreenSharing)) && (
        <div className="absolute inset-0 w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-slate-900">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold border-2 border-primary/30 shadow-lg mb-2">
            {initials}
          </div>
          <span className="text-white/40 text-sm font-medium">{name}</span>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white text-xs font-semibold">
        <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-accent animate-pulse' : 'bg-gray-500'}`}></div>
        {name} {isLocal && '(You)'}
        {isScreenSharing && <Monitor size={12} className="ml-1 text-accent" />}
      </div>

      <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {onPin && (
          <button 
            onClick={(e) => { e.stopPropagation(); onPin(); }}
            className={`p-2 backdrop-blur-xl rounded-lg border border-white/10 transition-colors ${isPinned ? 'bg-primary/80 text-white' : 'bg-black/40 text-gray-300 hover:text-white'}`}
            title={isPinned ? "Unpin" : "Pin to main screen"}
          >
            <Maximize2 size={14} />
          </button>
        )}
        {isLocal && (
          <div className="p-2 bg-black/40 backdrop-blur-xl rounded-lg border border-white/10">
            <ShieldCheck size={14} className="text-primary" />
          </div>
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
  const chatEndRef = useRef(null);

  useEffect(() => {
    if (showChat) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, showChat]);

  const handleSendMessage = (e) => {
    e?.preventDefault();
    if (chatMessage.trim()) {
      sendMessage(chatMessage);
      setChatMessage('');
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
    // A simple reload is the most reliable way to clear all WebRTC states and presence
    // but we can also navigate away or just reset state if we had a more complex router setup.
    window.location.reload();
  };

  const participantCount = participants.length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 animate-slide-in">
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-blue-50 text-primary flex items-center justify-center shadow-inner shrink-0">
            <LayoutGrid size={20} className="sm:w-6 sm:h-6" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-secondary truncate">Meeting Room</h1>
            <p className="text-gray-500 font-medium flex items-center gap-2 text-xs sm:text-sm truncate">
              <span className="w-2 h-2 rounded-full bg-accent shrink-0"></span>
              {team ? `${team.name} Team` : 'General Public'}
              <span className="hidden xs:inline text-[9px] sm:text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-400 font-mono ml-2 truncate">Room: {roomId}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center justify-between sm:justify-end gap-3 bg-white px-3 sm:px-4 py-2 rounded-xl border border-gray-100 shadow-sm self-start sm:self-auto w-full sm:w-auto">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {isJoined && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary border-2 border-white flex items-center justify-center text-[9px] sm:text-[10px] text-white font-bold uppercase">
                  {profile?.full_name?.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-xs sm:text-sm font-bold text-secondary">{participantCount} Participants</span>
          </div>
          <div className="w-2 h-2 rounded-full bg-accent animate-pulse"></div>
        </div>
      </header>

      {!isJoined ? (
        <div className="flex-1 flex flex-col items-center justify-center bg-white rounded-3xl border border-dashed border-gray-200 p-8">
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mb-6 shadow-inner transition-colors ${isMeetingActive ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-primary'}`}>
            <Video size={40} />
          </div>
          
          <h2 className="text-2xl font-bold mb-2">
            {isMeetingActive ? 'Meeting in Progress' : 'Ready to start?'}
          </h2>
          
          <div className="text-gray-400 mb-8 max-w-xs text-center">
            {isMeetingActive ? (
              <div className="flex flex-col items-center gap-3">
                <p className="text-sm font-medium">
                  {activeParticipants.map(p => p.userName).join(', ')} {activeParticipants.length === 1 ? 'is' : 'are'} already in the meeting.
                </p>
                <div className="flex -space-x-2">
                  {activeParticipants.slice(0, 3).map((p, i) => (
                    <div key={i} className="w-8 h-8 rounded-full bg-accent border-2 border-white flex items-center justify-center text-[10px] text-white font-bold uppercase">
                      {p.userName?.charAt(0)}
                    </div>
                  ))}
                  {activeParticipants.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center text-[10px] text-gray-500 font-bold">
                      +{activeParticipants.length - 3}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-sm font-medium">
                Start a {team ? team.name : 'General'} meeting and start collaborating with your team.
              </p>
            )}
          </div>

          <button 
            onClick={startStream}
            className={`btn-primary px-12 py-4 text-lg rounded-2xl shadow-xl transition-all hover:scale-105 active:scale-95 ${isMeetingActive ? 'bg-green-600 shadow-green-500/30' : 'shadow-blue-500/30'}`}
          >
            {isMeetingActive ? 'Join Meeting' : 'Start Session'}
          </button>
        </div>
      ) : (
        <div className="flex-1 flex gap-6 min-h-0 relative">
          {/* Connection Status Overlay */}
          {(connectionStatus === 'error' || connectionStatus === 'disconnected') && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center bg-secondary/80 backdrop-blur-md animate-fade-in p-6">
              <div className="bg-white rounded-[32px] shadow-2xl max-w-md w-full p-8 flex flex-col items-center text-center animate-scale-in">
                <div className="w-20 h-20 rounded-3xl bg-red-50 text-red-500 flex items-center justify-center mb-6 shadow-inner">
                  <WifiOff size={40} />
                </div>
                
                <h2 className="text-2xl font-black text-secondary mb-3">Connection Lost</h2>
                <p className="text-gray-500 font-medium mb-8">
                  We've lost connection to the meeting server. This could be due to a temporary network issue.
                </p>
                
                <div className="flex flex-col w-full gap-3">
                  <button 
                    onClick={() => window.location.reload()}
                    className="w-full py-4 bg-primary text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl shadow-blue-500/30 hover:scale-[1.02] active:scale-95 transition-all"
                  >
                    <RefreshCw size={20} className="animate-spin-slow" />
                    Rejoin Meeting
                  </button>
                  
                  <button 
                    onClick={() => window.location.href = '/dashboard'}
                    className="w-full py-4 bg-gray-50 text-gray-500 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-gray-100 transition-all"
                  >
                    <LogOut size={20} />
                    Leave for Now
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex-1 flex flex-col min-h-0">
            {pinnedSessionId ? (() => {
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
                <div className="flex-1 flex flex-col lg:flex-row gap-4 sm:gap-6 p-1 min-h-0">
                  {/* Pinned Video */}
                  <div className="flex-[3] lg:flex-[4] min-h-0 rounded-3xl overflow-hidden bg-black relative">
                    <ParticipantTile 
                      stream={streamToUse}
                      name={pinnedParticipant.userName}
                      isLocal={pinnedParticipant.sessionId === sessionId}
                      isStreaming={pinnedParticipant.isStreaming}
                      isVideoOn={pinnedParticipant.isVideoOn !== false}
                      isScreenSharing={pinnedParticipant.isScreenSharing}
                      participantId={pinnedParticipant.userId}
                      isPinned={true}
                      onPin={() => handlePin(pinnedParticipant.sessionId)}
                    />
                  </div>
                  {/* Thumbnails */}
                  <div className="flex-1 flex lg:flex-col gap-4 overflow-x-auto lg:overflow-y-auto p-1 min-h-[140px] lg:min-h-0 scroll-smooth items-center lg:items-stretch">
                    {/* Show local if not pinned */}
                    {pinnedParticipant.sessionId !== sessionId && (
                      <div className="w-48 lg:w-full shrink-0">
                        <ParticipantTile 
                          stream={localStream}
                          name={profile?.full_name}
                          isLocal={true}
                          isStreaming={isJoined}
                          isVideoOn={isVideoOn}
                          isScreenSharing={localIsScreenSharing}
                          participantId={profile?.id}
                          isPinned={false}
                          onPin={() => handlePin(sessionId)}
                        />
                      </div>
                    )}
                    {participants.filter(p => p.sessionId !== sessionId && p.sessionId !== pinnedParticipant.sessionId).map(p => (
                      <div key={p.sessionId} className="w-48 lg:w-full shrink-0">
                        <ParticipantTile 
                          stream={remoteStreams[p.sessionId]}
                          name={p.userName}
                          isLocal={false}
                          isStreaming={p.isStreaming}
                          isVideoOn={p.isVideoOn !== false}
                          isScreenSharing={p.isScreenSharing}
                          participantId={p.userId}
                          isPinned={false}
                          onPin={() => handlePin(p.sessionId)}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })() : (
              <div className={`flex-1 grid gap-4 sm:gap-6 overflow-y-auto p-1 scroll-smooth auto-rows-max ${
                participants.length <= 1 ? 'grid-cols-1 max-w-4xl mx-auto w-full' : 
                participants.length <= 2 ? 'grid-cols-1 md:grid-cols-2' : 
                participants.length <= 4 ? 'grid-cols-1 sm:grid-cols-2' : 
                'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
              }`}>
                {/* Local Participant */}
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

                {/* Remote Participants */}
                {participants.filter(p => p.sessionId !== sessionId).map((p) => (
                  <ParticipantTile 
                    key={p.sessionId}
                    stream={remoteStreams[p.sessionId]} 
                    name={p.userName} 
                    isLocal={false}
                    isStreaming={p.isStreaming}
                    isVideoOn={p.isVideoOn !== false}
                    isScreenSharing={p.isScreenSharing}
                    participantId={p.userId}
                    onPin={() => handlePin(p.sessionId)}
                  />
                ))}
              </div>
            )}

            {/* Controls Bar */}
            <div className="mt-4 sm:mt-6 flex items-center justify-center gap-2 sm:gap-4 py-3 sm:py-4 px-3 sm:px-6 bg-white border border-gray-100 rounded-[24px] sm:rounded-3xl shadow-xl shadow-gray-200/50 overflow-x-auto">
              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={handleToggleAudio}
                  className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all ${isMicOn ? 'bg-gray-50 text-secondary hover:bg-gray-100' : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'}`}
                  title={isMicOn ? 'Mute' : 'Unmute'}
                >
                  {isMicOn ? <Mic size={20} className="sm:w-[22px] sm:h-[22px]" /> : <MicOff size={20} className="sm:w-[22px] sm:h-[22px]" />}
                </button>
                
                <button 
                  onClick={handleToggleVideo}
                  className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all ${isVideoOn ? 'bg-gray-50 text-secondary hover:bg-gray-100' : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'}`}
                  title={isVideoOn ? 'Stop Video' : 'Start Video'}
                >
                  {isVideoOn ? <Video size={20} className="sm:w-[22px] sm:h-[22px]" /> : <VideoOff size={20} className="sm:w-[22px] sm:h-[22px]" />}
                </button>
              </div>

              <div className="w-px h-6 sm:h-8 bg-gray-200 mx-1 sm:mx-2"></div>

              <div className="flex items-center gap-1 sm:gap-2">
                <button 
                  onClick={() => {
                    if (localIsScreenSharing) {
                      stopScreenShare();
                    } else {
                      startScreenShare();
                    }
                  }}
                  className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all ${localIsScreenSharing ? 'bg-accent/10 text-accent ring-1 ring-accent' : 'bg-gray-50 text-secondary hover:bg-gray-100'}`}
                  title={localIsScreenSharing ? "Stop Sharing" : "Share Screen"}
                >
                  <Monitor size={20} className="sm:w-[22px] sm:h-[22px]" />
                </button>
                
                <button 
                  onClick={() => {
                    setShowParticipants(!showParticipants);
                    setShowChat(false);
                  }}
                  className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all ${showParticipants ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-secondary hover:bg-gray-100'}`}
                  title="Participants"
                >
                  <Users size={20} className="sm:w-[22px] sm:h-[22px]" />
                </button>

                <button 
                  onClick={() => {
                    setShowChat(!showChat);
                    setShowParticipants(false);
                  }}
                  className={`p-2.5 sm:p-3.5 rounded-xl sm:rounded-2xl transition-all ${showChat ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-secondary hover:bg-gray-100'}`}
                  title="Chat"
                >
                  <MessageSquare size={20} className="sm:w-[22px] sm:h-[22px]" />
                </button>
              </div>

              <div className="w-px h-6 sm:h-8 bg-gray-200 mx-1 sm:mx-2"></div>

              <button 
                onClick={handleLeave}
                className="px-4 sm:px-6 py-2.5 sm:py-3.5 bg-red-500 text-white rounded-xl sm:rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all font-bold flex items-center gap-2 hover:scale-105 active:scale-95 shrink-0"
              >
                <PhoneOff size={18} className="sm:w-[20px] sm:h-[20px]" />
                <span className="hidden xs:inline">End Meeting</span>
              </button>
            </div>
          </div>

          {/* Participants Sidebar */}
          {showParticipants && (
            <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-0 w-full md:w-80 h-full bg-white md:rounded-3xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-secondary flex items-center gap-2">
                  Participants
                  <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{participants.length}</span>
                </h3>
                <button 
                  onClick={() => setShowParticipants(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-4 space-y-2">
                {participants.map((p) => (
                  <div key={p.sessionId} className="flex items-center justify-between p-3 rounded-2xl hover:bg-gray-50 transition-colors group">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 flex items-center justify-center text-primary font-bold text-sm border border-blue-100 shadow-sm">
                        {p.userName?.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-sm font-bold text-secondary truncate max-w-[120px]">
                          {p.userName} {p.userId === profile?.id && '(You)'}
                        </span>
                        <span className="text-[10px] text-gray-400 flex items-center gap-1">
                          {p.isStreaming ? (
                            <><Video size={10} className="text-accent" /> Active</>
                          ) : (
                            <><VideoOff size={10} /> Camera Off</>
                          )}
                        </span>
                      </div>
                    </div>
                    {p.userId === profile?.id && (
                      <ShieldCheck size={14} className="text-primary opacity-50" />
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-gray-50/50 border-t border-gray-50">
                <button className="w-full py-3 bg-white border border-gray-100 text-gray-500 text-sm font-bold rounded-2xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2">
                  <Users size={16} />
                  Invite Others
                </button>
              </div>
            </div>
          )}

          {/* Chat Sidebar */}
          {showChat && (
            <div className="fixed inset-0 z-50 md:relative md:inset-auto md:z-0 w-full md:w-80 h-full bg-white md:rounded-3xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              <div className="p-4 sm:p-6 border-b border-gray-50 flex items-center justify-between">
                <h3 className="font-bold text-secondary flex items-center gap-2">
                  Live Chat
                  <span className="bg-gray-100 text-gray-500 text-[10px] px-2 py-0.5 rounded-full">{messages.length}</span>
                </h3>
                <button 
                  onClick={() => setShowChat(false)}
                  className="p-2 hover:bg-gray-100 rounded-xl transition-colors text-gray-400"
                >
                  <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-400">
                    <MessageSquare size={40} className="mb-4 opacity-20" />
                    <p className="text-sm font-medium">No messages yet. Start the conversation!</p>
                  </div>
                ) : (
                  messages.map((msg) => (
                    <div 
                      key={msg.id} 
                      className={`flex flex-col ${msg.senderId === profile?.id ? 'items-end' : 'items-start'}`}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-gray-400">
                          {msg.senderId === profile?.id ? 'You' : msg.senderName}
                        </span>
                        <span className="text-[10px] text-gray-300">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <div className={`px-4 py-2 rounded-2xl text-sm max-w-[90%] break-words ${
                        msg.senderId === profile?.id 
                          ? 'bg-primary text-white rounded-tr-none' 
                          : 'bg-gray-100 text-secondary rounded-tl-none'
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="p-4 bg-gray-50 border-t border-gray-100">
                <form onSubmit={handleSendMessage} className="relative">
                  <input 
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Type a message..."
                    className="w-full bg-white border border-gray-200 rounded-2xl py-3 pl-4 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button 
                    type="submit"
                    disabled={!chatMessage.trim()}
                    className="absolute right-2 top-1.5 p-2 bg-primary text-white rounded-xl shadow-lg shadow-blue-500/20 hover:scale-105 active:scale-95 disabled:opacity-50 disabled:scale-100 transition-all"
                  >
                    <Send size={18} />
                  </button>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Meetings;
