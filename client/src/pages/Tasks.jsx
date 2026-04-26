import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreVertical, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  User,
  X,
  MessageSquare
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Tasks = () => {
  const { profile, isAdmin, canManageTasks } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filter, setFilter] = useState('all');
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', deadline: '' });

  useEffect(() => {
    if (profile) {
      fetchTasks();
      fetchUsers();
    }

    const taskSubscription = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();

    const userSubscription = supabase
      .channel('profiles-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, fetchUsers)
      .subscribe();

    return () => {
      supabase.removeChannel(taskSubscription);
      supabase.removeChannel(userSubscription);
    };
  }, [filter, profile, isAdmin]);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*, assigned_to(id, full_name, avatar_url, designation, role)');
      
      if (!isAdmin && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query.order('created_at', { ascending: false });
      if (error) throw error;
      setTasks(data || []);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsers = async () => {
    try {
      console.log('Fetching users for assignment...');
      let query = supabase.from('profiles').select('id, full_name, avatar_url, team_id, designation, role');
      if (!isAdmin && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }
      const { data, error } = await query;
      if (error) throw error;
      console.log(`Found ${data?.length || 0} users`);
      setUsers(data || []);
    } catch (err) {
      console.error('Error fetching users:', err);
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!profile) return;
    try {
      const { error } = await supabase
        .from('tasks')
        .insert([{ 
          ...newTask, 
          created_by: profile.id,
          team_id: profile.team_id 
        }]);
      
      if (error) throw error;
      
      await supabase.from('activities').insert([{
        user_id: profile?.id,
        team_id: profile?.team_id,
        action: `created task: ${newTask.title}`,
        details: { task_title: newTask.title }
      }]);

      setShowAddModal(false);
      setNewTask({ title: '', description: '', assigned_to: '', priority: 'medium', deadline: '' });
    } catch (error) {
      alert(error.message);
    }
  };

  const updateTaskStatus = async (taskId, status, currentTitle) => {
    const progress = status === 'done' ? 100 : status === 'in-progress' ? 50 : 0;
    await supabase.from('tasks').update({ status, progress_percent: progress }).eq('id', taskId);
    
    await supabase.from('activities').insert([{
      user_id: profile?.id,
      task_id: taskId,
      team_id: profile?.team_id,
      action: `updated status to ${status.replace('-', ' ')} for ${currentTitle}`
    }]);
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-100 text-red-700';
      case 'medium': return 'bg-yellow-100 text-yellow-700';
      case 'low': return 'bg-green-100 text-green-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-6 animate-slide-in">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Task Management</h1>
          <p className="text-gray-500 font-medium">Collaborate with your team in real-time</p>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input type="text" placeholder="Search tasks..." className="input-field pl-10 w-64 bg-white" />
          </div>
          {canManageTasks && (
            <button onClick={() => setShowAddModal(true)} className="btn-primary shadow-lg shadow-blue-500/20">
              <Plus size={18} /> New Task
            </button>
          )}
        </div>
      </header>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {['all', 'todo', 'in-progress', 'done'].map((s) => (
            <button
              key={s}
              onClick={() => setFilter(s)}
              className={`px-4 py-2 rounded-xl text-sm font-bold whitespace-nowrap transition-all
                ${filter === s ? 'bg-secondary text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50'}
              `}
            >
              {s.charAt(0).toUpperCase() + s.slice(1).replace('-', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
          {loading ? (
            <div className="col-span-full py-20 text-center text-gray-400">Loading tasks...</div>
          ) : tasks.length > 0 ? (
            tasks.map((task) => {
              const canEdit = canManageTasks || task.assigned_to?.id === profile?.id;
              return (
                <div key={task.id} className="card hover:shadow-xl transition-all group relative border-none shadow-sm bg-white/80 backdrop-blur-sm">
                  <div className="flex items-start justify-between mb-4">
                    <span className={`px-2 py-1 rounded text-[10px] font-black uppercase tracking-widest ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    {canEdit && (
                      <select 
                        value={task.status}
                        onChange={(e) => updateTaskStatus(task.id, e.target.value, task.title)}
                        className="text-[10px] font-bold uppercase bg-gray-50 border-none rounded-lg p-1.5 focus:ring-0 cursor-pointer"
                      >
                        <option value="todo">To Do</option>
                        <option value="in-progress">In Progress</option>
                        <option value="done">Done</option>
                      </select>
                    )}
                  </div>
                  
                  <h3 className="font-bold text-lg mb-2 group-hover:text-primary transition-colors line-clamp-1">{task.title}</h3>
                  <p className="text-gray-500 text-sm line-clamp-2 mb-6 h-10">{task.description}</p>
                  
                  <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-100">
                    <button 
                      onClick={() => task.assigned_to && navigate(`/profile/${task.assigned_to.id}`)}
                      className="flex items-center gap-2 hover:opacity-70 transition-opacity"
                    >
                      <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center text-primary overflow-hidden border border-blue-100">
                        {task.assigned_to?.avatar_url ? (
                          <img src={task.assigned_to.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <User size={14} />
                        )}
                      </div>
                      <div className="text-left">
                        <p className="text-xs font-bold text-secondary truncate w-24">{task.assigned_to?.full_name || 'Unassigned'}</p>
                        <p className="text-[10px] text-gray-400 truncate w-24 capitalize">{task.assigned_to?.designation || task.assigned_to?.role || 'Member'}</p>
                      </div>
                    </button>
                    
                    <span className={`text-[10px] font-black uppercase tracking-tighter ${task.status === 'done' ? 'text-accent' : 'text-primary'}`}>
                      {task.status.replace('-', ' ')}
                    </span>
                  </div>

                  <div className="mt-4">
                    <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className={`h-full transition-all duration-500 ${task.status === 'done' ? 'bg-accent' : 'bg-primary'}`} style={{ width: `${task.progress_percent}%` }}></div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="col-span-full py-20 text-center bg-white rounded-3xl border border-dashed border-gray-200">
              <h3 className="text-lg font-bold text-secondary">No tasks found</h3>
              <p className="text-gray-500">Wait for your Lead to assign a task.</p>
            </div>
          )}
        </div>

        {/* Team Sidebar */}
        <div className="space-y-6">
          <div className="card border-none shadow-sm bg-white/50 backdrop-blur-sm">
            <h2 className="font-bold text-secondary mb-4 flex items-center gap-2">
              <User size={18} className="text-primary" /> Team Members
            </h2>
            <div className="space-y-3">
              {users.map(u => (
                <button 
                  key={u.id}
                  onClick={() => navigate(`/profile/${u.id}`)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-white rounded-xl transition-all group border border-transparent hover:border-gray-100 hover:shadow-sm"
                >
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-primary flex items-center justify-center font-bold border border-blue-100">
                    {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover rounded-xl" /> : u.full_name?.charAt(0)}
                  </div>
                  <div className="text-left flex-1 min-w-0">
                    <p className="text-sm font-bold text-secondary truncate">{u.full_name}</p>
                    <p className="text-[10px] text-gray-400 truncate capitalize">{u.designation || u.role || 'Member'}</p>
                  </div>
                  <MessageSquare size={14} className="text-gray-300 group-hover:text-primary transition-colors" />
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-secondary/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl w-full max-w-2xl shadow-2xl animate-scale-in flex overflow-hidden max-h-[90vh]">
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold">New Task</h2>
                <button onClick={() => setShowAddModal(false)}><X size={24} className="text-gray-400" /></button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-6">
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Title</label>
                  <input type="text" required className="input-field" value={newTask.title} onChange={e => setNewTask({...newTask, title: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-bold text-gray-700 ml-1">Description</label>
                  <textarea className="input-field h-24" value={newTask.description} onChange={e => setNewTask({...newTask, description: e.target.value})} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Priority</label>
                    <select className="input-field" value={newTask.priority} onChange={e => setNewTask({...newTask, priority: e.target.value})}>
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-bold text-gray-700 ml-1">Current Assignee</label>
                    <div className="p-3 bg-gray-50 rounded-xl text-sm font-bold text-primary flex items-center gap-2">
                      <User size={16} /> {users.find(u => u.id === newTask.assigned_to)?.full_name || 'Select from right →'}
                    </div>
                  </div>
                </div>
                <button type="submit" className="btn-primary w-full py-4 text-lg shadow-xl shadow-blue-500/30">Create Task</button>
              </form>
            </div>

            <div className="w-64 bg-gray-50 p-8 border-l border-gray-100 overflow-y-auto">
              <h3 className="font-bold text-sm text-gray-500 uppercase tracking-widest mb-6">Assign To</h3>
              <div className="space-y-3">
                {users.length > 0 ? users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setNewTask({...newTask, assigned_to: u.id})}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl border transition-all ${
                      newTask.assigned_to === u.id ? 'bg-primary text-white border-primary shadow-lg shadow-blue-500/20' : 'bg-white border-gray-100 hover:border-primary/30'
                    }`}
                  >
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${newTask.assigned_to === u.id ? 'bg-white/20' : 'bg-blue-50 text-primary'}`}>
                      {u.full_name?.charAt(0) || <User size={14} />}
                    </div>
                    <span className="text-xs font-bold truncate">{u.full_name || 'Unnamed User'}</span>
                  </button>
                )) : (
                  <div className="text-center py-10">
                    <p className="text-xs text-gray-400 font-medium italic">No members found.</p>
                    <p className="text-[10px] text-gray-300 mt-2">Check your Team Management settings.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
