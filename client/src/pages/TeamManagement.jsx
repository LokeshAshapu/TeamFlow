import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Users, UserPlus, Shield, Mail, CheckCircle2, MoreVertical, Plus, X, LayoutGrid, Trash2, Edit2 } from 'lucide-react';

const TeamManagement = () => {
  const { profile, isAdmin } = useAuth();
  const [members, setMembers] = useState([]);
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newUser, setNewUser] = useState({ email: '', fullName: '', role: 'member', teamId: '' });
  const [editingTeam, setEditingTeam] = useState(null);
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);

  useEffect(() => {
    fetchTeams();
    fetchMembers();
  }, [profile]);

  const fetchTeams = async () => {
    const { data } = await supabase.from('teams').select('*').order('name');
    setTeams(data || []);
  };

  const fetchMembers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*, teams(name)');
      
      if (!isAdmin && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setMembers(data || []);
    } catch (error) {
      console.error('Error fetching members:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    try {
      const { error } = await supabase.from('teams').insert([{ name: newTeamName }]);
      if (error) throw error;
      setNewTeamName('');
      setShowTeamModal(false);
      fetchTeams();
      alert(`Successfully created ${newTeamName}`);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: newUser.email,
          password: 'Password123!',
          fullName: newUser.fullName,
          role: newUser.role,
          teamId: newUser.teamId || profile?.team_id
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setShowAddModal(false);
      setNewUser({ email: '', fullName: '', role: 'member', teamId: '' });
      fetchMembers();
      alert('User created successfully! Default password: Password123!');
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam.name.trim()) return;
    try {
      const { error } = await supabase.from('teams').update({ name: editingTeam.name }).eq('id', editingTeam.id);
      if (error) throw error;
      setShowEditTeamModal(false);
      setEditingTeam(null);
      fetchTeams();
      fetchMembers();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteTeam = async (teamId) => {
    if (!confirm('Are you sure you want to delete this team? Members will be unassigned.')) return;
    try {
      const { error } = await supabase.from('teams').delete().eq('id', teamId);
      if (error) throw error;
      fetchTeams();
      fetchMembers();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleMoveMember = async (memberId, teamId) => {
    try {
      const { error } = await supabase.from('profiles').update({ team_id: teamId || null }).eq('id', memberId);
      if (error) throw error;
      fetchMembers();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteMember = async (memberId) => {
    if (!confirm('Are you sure you want to permanently delete this member?')) return;
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:5000'}/api/admin/delete-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: memberId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      fetchMembers();
      alert('Member deleted successfully');
    } catch (error) {
      alert(error.message);
    }
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Team Management</h1>
          <p className="text-gray-500 font-medium">Manage members and team structures</p>
        </div>
        <div className="flex gap-3">
          {isAdmin && (
            <button onClick={() => setShowTeamModal(true)} className="btn-secondary shadow-sm">
              <Plus size={18} /> New Team
            </button>
          )}
          {(isAdmin || profile?.role === 'lead') && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-lg shadow-blue-500/20">
              <UserPlus size={18} /> Add Member
            </button>
          )}
        </div>
      </header>

      {/* Team Overview Cards */}
      {isAdmin && (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teams.map(team => (
            <div key={team.id} className="card p-4 flex items-center justify-between group hover:border-primary transition-all cursor-pointer bg-white/50 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold">
                  <LayoutGrid size={20} />
                </div>
                <div>
                  <p className="font-bold text-secondary">{team.name}</p>
                  <p className="text-[10px] text-gray-400 font-black uppercase">
                    {members.filter(m => m.team_id === team.id).length} Members
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => { setEditingTeam(team); setShowEditTeamModal(true); }}
                  className="p-1.5 text-gray-400 hover:text-blue-500 transition-colors"
                >
                  <Edit2 size={14} />
                </button>
                <button 
                  onClick={() => handleDeleteTeam(team.id)}
                  className="p-1.5 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card p-0 overflow-hidden border-none shadow-xl bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/50 border-b border-gray-100">
              <tr>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Member</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Role</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Team</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold text-sm">
                        {member.avatar_url ? <img src={member.avatar_url} className="w-full h-full object-cover rounded-xl" /> : member.full_name?.charAt(0)}
                      </div>
                      <div>
                        <p className="font-bold text-secondary">{member.full_name}</p>
                        <p className="text-xs text-gray-400">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-tighter
                      ${member.role === 'admin' ? 'text-purple-600' : member.role === 'lead' ? 'text-orange-600' : 'text-blue-600'}
                    `}>
                      <Shield size={12} /> {member.role}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <select 
                      className="text-sm font-bold text-gray-500 bg-transparent border-none focus:ring-0 cursor-pointer hover:text-primary transition-colors"
                      value={member.team_id || ''}
                      onChange={(e) => handleMoveMember(member.id, e.target.value)}
                      disabled={!isAdmin && profile?.role !== 'lead'}
                    >
                      <option value="">Unassigned</option>
                      {teams.map(t => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-6 py-4">
                    <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-accent">
                      <CheckCircle2 size={12} /> Active
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex justify-end gap-2">
                      <button 
                        onClick={() => handleDeleteMember(member.id)}
                        className="p-2 text-gray-300 hover:text-red-500 rounded-lg transition-colors"
                        disabled={!isAdmin}
                      >
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Team Modal */}
      {showTeamModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Create New Team</h2>
              <button onClick={() => setShowTeamModal(false)}><X size={24} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleCreateTeam} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 ml-1">Team Name</label>
                <input 
                  type="text" 
                  required 
                  placeholder="e.g. Team 1"
                  className="input-field" 
                  value={newTeamName} 
                  onChange={e => setNewTeamName(e.target.value)} 
                />
              </div>
              <button type="submit" className="btn-primary w-full py-4 text-lg shadow-xl shadow-blue-500/30">
                Create Team
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Add New Member</h2>
              <button onClick={() => setShowAddModal(false)}><X size={24} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleAddMember} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 ml-1">Full Name</label>
                <input type="text" required className="input-field" value={newUser.fullName} onChange={e => setNewUser({...newUser, fullName: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 ml-1">Email Address</label>
                <input type="email" required className="input-field" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Role</label>
                  <select className="input-field" value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value})}>
                    <option value="member">Member</option>
                    <option value="lead">Team Lead</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Assign Team</label>
                  <select className="input-field" value={newUser.teamId} onChange={e => setNewUser({...newUser, teamId: e.target.value})}>
                    <option value="">Select Team</option>
                    {teams.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                  </select>
                </div>
              </div>
              <button type="submit" className="btn-primary w-full py-4 text-lg shadow-xl shadow-blue-500/30 mt-4">Create Account</button>
            </form>
          </div>
        </div>
      )}
      {/* Edit Team Modal */}
      {showEditTeamModal && editingTeam && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-md shadow-2xl animate-scale-in p-8">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Edit Team</h2>
              <button onClick={() => { setShowEditTeamModal(false); setEditingTeam(null); }}><X size={24} className="text-gray-400" /></button>
            </div>
            <form onSubmit={handleUpdateTeam} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-sm font-bold text-gray-700 ml-1">Team Name</label>
                <input 
                  type="text" 
                  required 
                  className="input-field" 
                  value={editingTeam.name} 
                  onChange={e => setEditingTeam({...editingTeam, name: e.target.value})} 
                />
              </div>
              <button type="submit" className="btn-primary w-full py-4 text-lg shadow-xl shadow-blue-500/30">
                Update Team
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;
