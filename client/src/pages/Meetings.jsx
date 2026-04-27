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
  LayoutGrid
} from 'lucide-react';

const VideoFeed = ({ stream, label, isLocal }) => {
  const videoRef = useRef();

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <div className="relative bg-secondary rounded-2xl overflow-hidden shadow-xl aspect-video group animate-fade-in">
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isLocal}
        className={`w-full h-full object-cover ${isLocal ? 'scale-x-[-1]' : ''}`}
      />
      <div className="absolute bottom-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-black/50 backdrop-blur-md rounded-lg text-white text-sm font-medium">
        <div className={`w-2 h-2 rounded-full ${isLocal ? 'bg-primary' : 'bg-accent animate-pulse'}`}></div>
        {label} {isLocal && '(You)'}
      </div>
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
    isMeetingActive
  } = useWebRTC(roomId, profile?.id, profile?.full_name);

  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isMicOn, setIsMicOn] = useState(true);

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
        <div className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-6 overflow-y-auto p-1 scroll-smooth">
            <VideoFeed 
              stream={localStream} 
              label={profile?.full_name} 
              isLocal={true} 
            />
            {Object.entries(remoteStreams).map(([socketId, stream]) => (
              <VideoFeed 
                key={socketId} 
                stream={stream} 
                label={`Member ${socketId.substring(0, 4)}`} 
              />
            ))}
          </div>

          <div className="mt-8 flex items-center justify-center gap-6 py-6 bg-secondary/5 backdrop-blur-sm rounded-3xl border border-gray-100 shadow-sm">
            <div className="flex items-center gap-4">
              <button 
                onClick={handleToggleAudio}
                className={`p-4 rounded-2xl transition-all shadow-lg ${isMicOn ? 'bg-white text-secondary hover:bg-gray-100' : 'bg-red-500 text-white shadow-red-500/20'}`}
              >
                {isMicOn ? <Mic size={24} /> : <MicOff size={24} />}
              </button>
              
              <button 
                onClick={handleToggleVideo}
                className={`p-4 rounded-2xl transition-all shadow-lg ${isVideoOn ? 'bg-white text-secondary hover:bg-gray-100' : 'bg-red-500 text-white shadow-red-500/20'}`}
              >
                {isVideoOn ? <Video size={24} /> : <VideoOff size={24} />}
              </button>

              <button 
                onClick={startScreenShare}
                className="p-4 bg-white text-secondary hover:bg-gray-100 rounded-2xl transition-all shadow-lg"
              >
                <Monitor size={24} />
              </button>
            </div>

            <div className="w-px h-10 bg-gray-200"></div>

            <button 
              onClick={handleLeave}
              className="p-4 bg-red-500 text-white rounded-2xl hover:bg-red-600 shadow-xl shadow-red-500/30 transition-all hover:scale-105"
            >
              <PhoneOff size={24} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Meetings;
