import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Send, Hash, Users, Search, MoreHorizontal, 
  Paperclip, Smile, User, ExternalLink, 
  MessageCircle, X, Image as ImageIcon, File as FileIcon,
  ShieldCheck, Lock
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import io from 'socket.io-client';

const SOCKET_SERVER = import.meta.env.VITE_API_URL || 'http://localhost:5000';
const EMOJIS = ['😀', '😂', '😍', '👍', '🔥', '🚀', '✨', '💯', '🎉', '👏', '🙌', '🤔', '😎', '💡', '✅'];

const Chat = () => {
  const { profile, isAdmin, isLead } = useAuth();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [activeChat, setActiveChat] = useState({ id: 'general', type: 'channel', name: 'General Chat' });
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [attachment, setAttachment] = useState(null);
  const [uploading, setUploading] = useState(false);
  const socketRef = useRef();
  const scrollRef = useRef();
  const fileInputRef = useRef();

  useEffect(() => {
    if (profile) {
      fetchMessages();
      fetchTeamMembers();
    }
    
    socketRef.current = io(SOCKET_SERVER);
    
    const roomId = activeChat.id === 'management' ? 'management' : 
                   (activeChat.type === 'channel' ? 'general' : 
                   [profile?.id, activeChat.id].sort().join('-'));
    
    socketRef.current.emit('join-room', { roomId, userId: profile?.id, userName: profile?.full_name });

    socketRef.current.on('receive-message', (message) => {
      const isManagement = activeChat.id === 'management' && message.channel_type === 'management';
      const isGeneral = activeChat.id === 'general' && !message.recipient_id && message.channel_type !== 'management';
      const isDM = activeChat.type === 'dm' && 
                   ((message.sender_id === profile?.id && message.recipient_id === activeChat.id) ||
                    (message.sender_id === activeChat.id && message.recipient_id === profile?.id));
      
      if (isManagement || isGeneral || isDM) {
        setMessages(prev => [...prev, message]);
      }
    });

    return () => socketRef.current.disconnect();
  }, [profile, activeChat]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('messages')
        .select('*, sender_id(id, full_name, avatar_url, role)');
      
      if (activeChat.id === 'management') {
        query = query.eq('channel_type', 'management');
      } else if (activeChat.type === 'channel') {
        query = query.is('recipient_id', null).eq('channel_type', 'public');
        if (!isAdmin && profile?.team_id) {
          query = query.eq('team_id', profile.team_id);
        }
      } else {
        query = query.or(`and(sender_id.eq.${profile.id},recipient_id.eq.${activeChat.id}),and(sender_id.eq.${activeChat.id},recipient_id.eq.${profile.id})`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: true });
      if (error) throw error;
      setMessages(data || []);
    } catch (error) {
      console.error('Error fetching messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async () => {
    let query = supabase.from('profiles').select('*');
    if (!isAdmin && profile?.team_id) {
      query = query.eq('team_id', profile.team_id);
    }
    const { data } = await query;
    setTeamMembers(data || []);
  };

  const uploadFile = async (file) => {
    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random()}.${fileExt}`;
    const filePath = `chat/${fileName}`;
    const { error: uploadError } = await supabase.storage.from('chat-attachments').upload(filePath, file);
    if (uploadError) throw uploadError;
    const { data: { publicUrl } } = supabase.storage.from('chat-attachments').getPublicUrl(filePath);
    return publicUrl;
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() && !attachment) return;
    setUploading(true);

    try {
      let fileUrl = null;
      if (attachment) fileUrl = await uploadFile(attachment);

      const messageData = {
        content: newMessage,
        sender_id: profile.id,
        recipient_id: activeChat.type === 'dm' ? activeChat.id : null,
        channel_type: activeChat.id === 'management' ? 'management' : 'public',
        team_id: profile.team_id,
        file_url: fileUrl,
        file_type: attachment?.type.startsWith('image/') ? 'image' : 'file',
        created_at: new Date().toISOString(),
        sender_details: { id: profile.id, full_name: profile.full_name, avatar_url: profile.avatar_url }
      };

      const { error } = await supabase.from('messages').insert([{ 
        content: messageData.content,
        sender_id: messageData.sender_id,
        recipient_id: messageData.recipient_id,
        channel_type: messageData.channel_type,
        team_id: messageData.team_id,
        file_url: messageData.file_url,
        file_type: messageData.file_type
      }]);
      
      if (error) throw error;
      
      const roomId = activeChat.id === 'management' ? 'management' : 
                   (activeChat.type === 'channel' ? 'general' : 
                   [profile.id, activeChat.id].sort().join('-'));

      socketRef.current.emit('send-message', { roomId, message: messageData });
      setMessages(prev => [...prev, messageData]);
      setNewMessage('');
      setAttachment(null);
    } catch (error) {
      alert(error.message);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-8rem)] flex gap-6 animate-slide-in">
      <div className="w-80 flex flex-col gap-6">
        <div className="card h-full flex flex-col p-0 overflow-hidden border-none shadow-xl bg-white/80 backdrop-blur-sm">
          <div className="p-6 border-b border-gray-100">
            <h2 className="text-xl font-bold text-secondary">Chat Channels</h2>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <div className="p-4 space-y-2">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Public</span>
              <button 
                onClick={() => setActiveChat({ id: 'general', type: 'channel', name: 'General Chat' })}
                className={`w-full flex items-center gap-3 p-3 rounded-2xl font-bold text-sm transition-all ${
                  activeChat.id === 'general' ? 'bg-primary text-white shadow-lg shadow-blue-500/20' : 'text-gray-500 hover:bg-gray-50'
                }`}
              >
                <Hash size={18} /> General Chat
              </button>

              {(isAdmin || isLead) && (
                <>
                  <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-2 pt-4 block">Restricted</span>
                  <button 
                    onClick={() => setActiveChat({ id: 'management', type: 'channel', name: 'Management Chat' })}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl font-bold text-sm transition-all ${
                      activeChat.id === 'management' ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20' : 'text-purple-600 hover:bg-purple-50'
                    }`}
                  >
                    <ShieldCheck size={18} /> Management Chat
                  </button>
                </>
              )}
            </div>

            <div className="p-4 border-t border-gray-50">
              <span className="text-xs font-black text-gray-400 uppercase tracking-widest px-2">Team Members</span>
              <div className="mt-4 space-y-1">
                {teamMembers.filter(m => m.id !== profile?.id).map(member => (
                  <button 
                    key={member.id} 
                    onClick={() => setActiveChat({ id: member.id, type: 'dm', name: member.full_name, avatar: member.avatar_url })}
                    className={`w-full flex items-center gap-3 p-3 rounded-2xl transition-all text-sm group ${
                      activeChat.id === member.id ? 'bg-blue-50 text-primary font-bold border border-blue-100' : 'text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-9 h-9 rounded-xl bg-gray-100 text-gray-400 flex items-center justify-center font-bold text-xs overflow-hidden">
                      {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover" /> : member.full_name?.charAt(0)}
                    </div>
                    <div className="text-left flex-1 min-w-0">
                      <p className="truncate">{member.full_name}</p>
                      <p className="text-[10px] opacity-70 truncate capitalize">{member.role}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 card p-0 flex flex-col overflow-hidden border-none shadow-2xl bg-white">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-white/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-white font-bold shadow-lg ${
              activeChat.id === 'management' ? 'bg-purple-600 shadow-purple-500/20' : (activeChat.type === 'channel' ? 'bg-primary shadow-blue-500/20' : 'bg-accent shadow-green-500/20')
            }`}>
              {activeChat.id === 'management' ? <ShieldCheck size={20} /> : (activeChat.type === 'channel' ? <Hash size={20} /> : (activeChat.avatar ? <img src={activeChat.avatar} className="w-full h-full object-cover rounded-2xl" /> : activeChat.name.charAt(0)))}
            </div>
            <div>
              <h3 className="font-bold text-secondary text-lg">{activeChat.name}</h3>
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                {activeChat.id === 'management' ? <><Lock size={10} /> Admin & Leads Only</> : (activeChat.type === 'channel' ? 'Public Team Channel' : 'Private Direct Message')}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-gray-50/30">
          {loading ? (
            <div className="flex justify-center py-20"><div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
          ) : messages.length > 0 ? messages.map((msg, idx) => {
            const isMe = msg.sender_id === profile?.id || msg.sender_id?.id === profile?.id;
            const sender = msg.sender_id?.full_name ? msg.sender_id : (msg.sender_details || {});
            
            return (
              <div key={idx} className={`flex gap-4 ${isMe ? 'flex-row-reverse' : ''}`}>
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 rounded-2xl bg-white border border-gray-100 flex items-center justify-center font-bold text-gray-400 shadow-sm overflow-hidden">
                    {sender.avatar_url ? <img src={sender.avatar_url} className="w-full h-full object-cover" /> : sender.full_name?.charAt(0) || '?'}
                  </div>
                </div>
                <div className={`max-w-[70%] ${isMe ? 'text-right' : ''}`}>
                  <div className={`flex items-center gap-2 mb-1.5 ${isMe ? 'justify-end' : ''}`}>
                    <span className="text-xs font-black text-secondary uppercase tracking-tighter">{isMe ? 'You' : sender.full_name}</span>
                    <span className="text-[10px] text-gray-400 font-bold">{new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                  </div>
                  <div className={`p-4 rounded-3xl shadow-sm text-sm leading-relaxed space-y-3 ${
                    isMe ? (activeChat.id === 'management' ? 'bg-purple-600' : 'bg-primary') + ' text-white rounded-tr-none' : 'bg-white text-gray-700 rounded-tl-none border border-gray-100'
                  }`}>
                    {msg.content && <p>{msg.content}</p>}
                    {msg.file_url && (
                      <div className="mt-2">
                        {msg.file_type === 'image' ? (
                          <img src={msg.file_url} alt="attachment" className="rounded-xl max-w-full h-auto" />
                        ) : (
                          <a href={msg.file_url} target="_blank" rel="noreferrer" className="flex items-center gap-2 p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition-all text-secondary">
                            <FileIcon size={18} /> <span className="underline text-xs">Download File</span>
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          }) : (
            <div className="py-20 text-center flex flex-col items-center gap-4">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-gray-200 shadow-inner border border-gray-100"><MessageCircle size={40} /></div>
              <p className="text-gray-400 font-bold">Start the conversation in {activeChat.name}</p>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        <div className="p-6 bg-white border-t border-gray-100 relative">
          {showEmojiPicker && (
            <div className="absolute bottom-24 left-6 bg-white shadow-2xl rounded-2xl p-4 border border-gray-100 flex gap-2 z-50 animate-scale-in">
              {EMOJIS.map(e => <button key={e} onClick={() => setNewMessage(prev => prev + e)} className="text-2xl hover:scale-125 transition-transform">{e}</button>)}
            </div>
          )}

          {attachment && (
            <div className="absolute bottom-24 left-6 bg-blue-50 border border-blue-100 rounded-2xl p-3 flex items-center gap-3 animate-slide-in">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center text-primary"><FileIcon size={20} /></div>
              <p className="text-xs font-bold text-secondary truncate w-32">{attachment.name}</p>
              <button onClick={() => setAttachment(null)} className="text-gray-400 hover:text-red-500"><X size={18} /></button>
            </div>
          )}

          <form onSubmit={handleSendMessage} className="relative group">
            <div className="absolute left-4 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button type="button" onClick={() => fileInputRef.current.click()} className="p-2 text-gray-400 hover:text-primary transition-colors"><Paperclip size={20} /></button>
              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="p-2 text-gray-400 hover:text-primary transition-colors"><Smile size={20} /></button>
            </div>
            <input type="file" ref={fileInputRef} className="hidden" onChange={e => setAttachment(e.target.files[0])} />
            <input 
              type="text" 
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={`Message ${activeChat.name}...`}
              className="w-full bg-gray-50 border-none rounded-3xl py-4 pl-24 pr-16 focus:ring-4 focus:ring-primary/5 transition-all text-sm font-medium"
            />
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <button type="submit" disabled={uploading} className={`w-12 h-12 rounded-2xl text-white shadow-xl transition-all flex items-center justify-center ${activeChat.id === 'management' ? 'bg-purple-600 shadow-purple-500/20' : 'bg-primary shadow-blue-500/20'}`}>
                {uploading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Send size={20} />}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default Chat;
