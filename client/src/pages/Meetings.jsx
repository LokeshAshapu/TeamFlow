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
  AlertCircle
} from 'lucide-react';

const ParticipantTile = ({ stream, name, isLocal, isStreaming, participantId }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const initials = name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';

  return (
    <div className="relative bg-secondary/95 rounded-2xl overflow-hidden shadow-2xl aspect-video group animate-fade-in ring-1 ring-white/10">
      {isStreaming ? (
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted={isLocal}
          className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-secondary to-slate-900">
          <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center text-primary text-2xl font-bold border-2 border-primary/30 shadow-lg mb-2">
            {initials}
          </div>
          <span className="text-white/40 text-sm font-medium">{name}</span>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/40 backdrop-blur-xl rounded-xl border border-white/10 text-white text-xs font-semibold">
        <div className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-accent animate-pulse' : 'bg-gray-500'}`}></div>
        {name} {isLocal && '(You)'}
      </div>

      {isLocal && (
        <div className="absolute top-4 right-4 p-2 bg-black/40 backdrop-blur-xl rounded-lg border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity">
          <ShieldCheck size={14} className="text-primary" />
        </div>
      )}
    </div>
  );
};

const Meetings = () => {
  const { profile } = useAuth();
  const [team, setTeam] = useState(null);
  
  // Use a stable room ID once profile is loaded
  const roomId = profile?.team_id ? `team-${profile.team_id}` : (profile ? 'general-meeting' : null);
  
  const { 
    localStream, 
    remoteStreams, 
    startStream, 
    toggleVideo, 
    toggleAudio, 
    startScreenShare,
    isJoined,
    participants,
    activeParticipants,
    isMeetingActive,
    connectionStatus
  } = useWebRTC(roomId, profile?.id, profile?.full_name);

  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  useEffect(() => {
    if (profile?.team_id) {
      fetchTeam();
    }
  }, [profile]);

  const fetchTeam = async () => {
    const { data } = await supabase.from('teams').select('name').eq('id', profile.team_id).single();
    if (data) setTeam(data);
  };

  const handleToggleVideo = () => {
    toggleVideo();
    setIsVideoOn(!isVideoOn);
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

  const participantCount = activeParticipants.length;

  return (
    <div className="h-[calc(100vh-8rem)] flex flex-col gap-6 animate-slide-in">
      <header className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-blue-50 text-primary flex items-center justify-center shadow-inner">
            <LayoutGrid size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-secondary">Meeting Room</h1>
            <p className="text-gray-500 font-medium flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent"></span>
              Channel: {team ? `${team.name} Team` : 'General Public'}
              <span className="text-[10px] bg-gray-100 px-2 py-0.5 rounded text-gray-400 font-mono ml-2">Room: {roomId}</span>
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {isJoined && (
                <div className="w-8 h-8 rounded-full bg-primary border-2 border-white flex items-center justify-center text-[10px] text-white font-bold uppercase">
                  {profile?.full_name?.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-sm font-bold text-secondary">{participantCount} Participants</span>
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
            <div className={`flex-1 grid gap-6 overflow-y-auto p-1 scroll-smooth ${
              participants.length <= 1 ? 'grid-cols-1 max-w-4xl mx-auto w-full' : 
              participants.length <= 4 ? 'grid-cols-1 md:grid-cols-2' : 
              'grid-cols-2 lg:grid-cols-3'
            }`}>
              {/* Local Participant */}
              <ParticipantTile 
                stream={localStream} 
                name={profile?.full_name} 
                isLocal={true} 
                isStreaming={isJoined}
                participantId={profile?.id}
              />

              {/* Remote Participants */}
              {participants.filter(p => p.userId !== profile?.id).map((p) => (
                <ParticipantTile 
                  key={p.sessionId}
                  stream={remoteStreams[p.sessionId]} 
                  name={p.userName} 
                  isLocal={false}
                  isStreaming={p.isStreaming}
                  participantId={p.userId}
                />
              ))}
            </div>

            {/* Controls Bar */}
            <div className="mt-6 flex items-center justify-center gap-4 py-4 px-6 bg-white border border-gray-100 rounded-3xl shadow-xl shadow-gray-200/50">
              <div className="flex items-center gap-2">
                <button 
                  onClick={handleToggleAudio}
                  className={`p-3.5 rounded-2xl transition-all ${isMicOn ? 'bg-gray-50 text-secondary hover:bg-gray-100' : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'}`}
                  title={isMicOn ? 'Mute' : 'Unmute'}
                >
                  {isMicOn ? <Mic size={22} /> : <MicOff size={22} />}
                </button>
                
                <button 
                  onClick={handleToggleVideo}
                  className={`p-3.5 rounded-2xl transition-all ${isVideoOn ? 'bg-gray-50 text-secondary hover:bg-gray-100' : 'bg-red-500 text-white hover:bg-red-600 shadow-lg shadow-red-500/20'}`}
                  title={isVideoOn ? 'Stop Video' : 'Start Video'}
                >
                  {isVideoOn ? <Video size={22} /> : <VideoOff size={22} />}
                </button>
              </div>

              <div className="w-px h-8 bg-gray-200 mx-2"></div>

              <div className="flex items-center gap-2">
                <button 
                  onClick={startScreenShare}
                  className="p-3.5 bg-gray-50 text-secondary hover:bg-gray-100 rounded-2xl transition-all"
                  title="Share Screen"
                >
                  <Monitor size={22} />
                </button>
                
                <button 
                  onClick={() => setShowParticipants(!showParticipants)}
                  className={`p-3.5 rounded-2xl transition-all ${showParticipants ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-secondary hover:bg-gray-100'}`}
                  title="Participants"
                >
                  <Users size={22} />
                </button>

                <button 
                  className="p-3.5 bg-gray-50 text-secondary hover:bg-gray-100 rounded-2xl transition-all"
                  title="Chat (Coming Soon)"
                >
                  <MessageSquare size={22} />
                </button>
              </div>

              <div className="w-px h-8 bg-gray-200 mx-2"></div>

              <button 
                onClick={handleLeave}
                className="px-6 py-3.5 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-lg shadow-red-500/30 transition-all font-bold flex items-center gap-2 hover:scale-105 active:scale-95"
              >
                <PhoneOff size={20} />
                <span className="hidden sm:inline">End Meeting</span>
              </button>
            </div>
          </div>

          {/* Participants Sidebar */}
          {showParticipants && (
            <div className="w-80 bg-white rounded-3xl border border-gray-100 shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-300">
              <div className="p-6 border-b border-gray-50 flex items-center justify-between">
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
                        <span className="text-sm font-bold text-secondary">
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
        </div>
      )}
    </div>
  );
};

export default Meetings;
