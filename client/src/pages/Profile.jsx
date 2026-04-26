import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  User, Mail, Phone, Briefcase, FileText, 
  Save, Globe, Camera, X, Shield, 
  CheckCircle2, Mail as MailIcon
} from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';

const Profile = () => {
  const { profile: currentUser, refreshProfile } = useAuth();
  const { userId } = useParams();
  const fileInputRef = useRef();
  
  const [profile, setProfile] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [formData, setFormData] = useState({
    full_name: '',
    phone_number: '',
    designation: '',
    bio: ''
  });

  const isOwnProfile = !userId || userId === currentUser?.id;

  useEffect(() => {
    const targetId = userId || currentUser?.id;
    if (targetId) fetchProfile(targetId);
  }, [userId, currentUser]);

  const fetchProfile = async (targetId) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, teams(name)')
        .eq('id', targetId)
        .single();

      if (error) {
        // If profile doesn't exist yet, it's likely the Admin
        if (targetId === currentUser?.id) {
          setProfile(currentUser);
        }
      } else {
        setProfile(data);
      }

      if (data || currentUser) {
        const activeData = data || currentUser;
        setFormData({
          full_name: activeData.full_name || '',
          phone_number: activeData.phone_number || '',
          designation: activeData.designation || '',
          bio: activeData.bio || ''
        });
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploading(true);
    try {
      const filePath = `avatars/${currentUser.id}-${Date.now()}`;
      await supabase.storage.from('avatars').upload(filePath, file);
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);
      await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);
      await refreshProfile();
      fetchProfile(currentUser.id);
    } catch (err) {
      alert('Upload failed. Ensure "avatars" bucket is public.');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.from('profiles').update(formData).eq('id', currentUser.id);
      if (error) throw error;
      await refreshProfile();
      setIsEditing(false);
      fetchProfile(currentUser.id);
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !profile) return (
    <div className="flex h-[60vh] items-center justify-center">
      <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto animate-slide-in pb-20">
      {/* Sleek Header Banner */}
      <div className="relative h-48 bg-gradient-to-r from-blue-600 to-indigo-700 rounded-3xl overflow-hidden shadow-lg">
        <div className="absolute inset-0 opacity-10 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>
      </div>

      <div className="relative px-8 -mt-20">
        <div className="card border-none shadow-2xl p-8 bg-white/95 backdrop-blur-xl rounded-[2rem]">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="relative group">
              <div className="w-32 h-32 rounded-3xl bg-gray-100 border-4 border-white shadow-xl overflow-hidden flex items-center justify-center">
                {profile?.avatar_url ? <img src={profile.avatar_url} className="w-full h-full object-cover" /> : <User size={50} className="text-gray-300" />}
              </div>
              {isOwnProfile && (
                <button onClick={() => fileInputRef.current.click()} className="absolute inset-0 bg-black/40 rounded-3xl flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all">
                  {uploading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <Camera size={24} />}
                </button>
              )}
              <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleAvatarUpload} />
            </div>

            <div className="flex-1">
              <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
                <div>
                  <h1 className="text-3xl font-black text-secondary">{profile?.full_name || (profile?.role === 'admin' ? 'Administrator' : 'Team Member')}</h1>
                  <p className="text-primary font-bold flex items-center gap-2 capitalize">
                    <Briefcase size={18} /> {profile?.designation || (profile?.role === 'admin' ? 'System Owner' : 'Product Member')}
                  </p>
                </div>
                {isOwnProfile && (
                  <button onClick={() => setIsEditing(!isEditing)} className={`btn-${isEditing ? 'secondary' : 'primary'} rounded-2xl px-6 py-2.5 font-bold shadow-lg`}>
                    {isEditing ? <X size={18} /> : 'Edit Profile'}
                  </button>
                )}
              </div>
              
              <div className="flex flex-wrap gap-3">
                <span className="badge-gray"><Globe size={14} /> {profile?.teams?.name || 'Global Team'}</span>
                <span className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${profile?.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}`}>
                  <Shield size={14} /> {profile?.role}
                </span>
              </div>
            </div>
          </div>

          <div className="mt-12 pt-12 border-t border-gray-50 grid grid-cols-1 lg:grid-cols-3 gap-12">
            <div className="lg:col-span-2 space-y-8">
              {isEditing ? (
                <form onSubmit={handleUpdate} className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Full Name</label>
                      <input type="text" required className="input-field rounded-2xl" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Mobile Number</label>
                      <input type="text" className="input-field rounded-2xl" value={formData.phone_number} onChange={e => setFormData({...formData, phone_number: e.target.value})} />
                    </div>
                    <div className="space-y-2 col-span-full">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Professional Job Title</label>
                      <input type="text" className="input-field rounded-2xl" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Bio / Skills</label>
                    <textarea className="input-field rounded-2xl h-32" value={formData.bio} onChange={e => setFormData({...formData, bio: e.target.value})} />
                  </div>
                  <button type="submit" className="btn-primary w-full py-4 rounded-2xl text-lg font-bold shadow-2xl">Save Changes</button>
                </form>
              ) : (
                <div className="space-y-8">
                  <h3 className="text-xl font-bold text-secondary flex items-center gap-2"><FileText size={22} className="text-primary" /> Professional Bio</h3>
                  <div className="p-8 bg-gray-50 rounded-[2rem] border border-gray-100 text-gray-600 leading-relaxed text-lg">
                    {profile?.bio || 'No professional bio has been added yet. Click "Edit Profile" to tell your team about yourself.'}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="bg-white rounded-[2rem] p-8 border border-gray-100 shadow-sm">
                <h3 className="font-bold text-secondary mb-6 text-lg">Direct Contact</h3>
                <div className="space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-primary"><MailIcon size={20} /></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase">Email Address</p>
                      <p className="font-bold text-secondary text-sm truncate w-40">{profile?.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl bg-green-50 flex items-center justify-center text-accent"><Phone size={20} /></div>
                    <div>
                      <p className="text-[10px] font-black text-gray-400 uppercase">Mobile Number</p>
                      <p className="font-bold text-secondary text-sm">{profile?.phone_number || 'Not listed'}</p>
                    </div>
                  </div>
                </div>
                <div className="mt-8 p-4 bg-blue-50/50 rounded-2xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 flex items-center gap-2"><Shield size={12} /> Team Visibility</p>
                  <p className="text-[9px] text-blue-500 mt-1 leading-tight">Your profile details are only visible to your team members and managers.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
