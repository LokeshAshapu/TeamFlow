import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Search, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  User,
  X,
  MessageSquare,
  BarChart3,
  Calendar,
  ChevronRight,
  Trash2,
  Edit3
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Tasks = () => {
  const { profile, isAdmin, canManageTasks } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedTask, setSelectedTask] = useState(null);
  const [filter, setFilter] = useState('all');
  const [newTask, setNewTask] = useState({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
  const [editingTask, setEditingTask] = useState(null);

  useEffect(() => {
    if (profile) {
      fetchTasks();
      fetchUsers();
    }

    const taskSubscription = supabase
      .channel('tasks-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchTasks)
      .subscribe();

    return () => {
      supabase.removeChannel(taskSubscription);
    };
  }, [filter, profile, isAdmin]);

  const fetchTasks = async () => {
    try {
      let query = supabase
        .from('tasks')
        .select('*, assigned_to(id, full_name, avatar_url, designation, role), created_by(id, full_name)');
      
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
      let query = supabase.from('profiles').select('id, full_name, avatar_url, team_id, designation, role');
      if (!isAdmin && profile?.team_id) {
        query = query.eq('team_id', profile.team_id);
      }
      const { data, error } = await query;
      if (error) throw error;
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
          team_id: profile.team_id,
          status: 'todo',
          progress_percent: 0
        }]);
      
      if (error) throw error;
      
      await supabase.from('activities').insert([{
        user_id: profile?.id,
        team_id: profile?.team_id,
        action: `assigned a new task: ${newTask.title}`,
        details: { task_title: newTask.title }
      }]);

      setShowAddModal(false);
      setNewTask({ title: '', description: '', assigned_to: '', priority: 'medium', due_date: '' });
      fetchTasks();
    } catch (error) {
      alert(error.message);
    }
  };

  const handleUpdateTask = async (taskId, updates) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update(updates)
        .eq('id', taskId);
      
      if (error) throw error;

      if (updates.status || updates.delay_explanation) {
        await supabase.from('activities').insert([{
          user_id: profile?.id,
          task_id: taskId,
          team_id: profile?.team_id,
          action: updates.delay_explanation ? 'added a task explanation' : `updated task status to ${updates.status}`
        }]);
      }
      
      fetchTasks();
      if (selectedTask?.id === taskId) {
        setSelectedTask(prev => ({ ...prev, ...updates }));
      }
      if (showEditModal) setShowEditModal(false);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleDeleteTask = async (taskId, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this task? This cannot be undone.')) return;
    try {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId);
      if (error) throw error;
      if (selectedTask?.id === taskId) setSelectedTask(null);
      fetchTasks();
    } catch (error) {
      alert(error.message);
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high': return 'bg-red-500 text-white';
      case 'medium': return 'bg-amber-500 text-white';
      case 'low': return 'bg-emerald-500 text-white';
      default: return 'bg-slate-500 text-white';
    }
  };

  return (
    <div className="space-y-6 animate-fade-in max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      {/* Header Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Task Command</h1>
          <div className="flex items-center gap-2 text-slate-500">
            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
            <p className="text-sm font-medium">Real-time team synchronization active</p>
          </div>
        </div>
        
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              type="text" 
              placeholder="Quick find..." 
              className="bg-slate-50 border-none rounded-2xl pl-12 pr-4 py-3 text-sm font-medium focus:ring-2 focus:ring-primary/20 w-full sm:w-64 transition-all" 
            />
          </div>
          {canManageTasks && (
            <button 
              onClick={() => setShowAddModal(true)} 
              className="btn-primary py-3 px-6 rounded-2xl shadow-lg shadow-primary/20 hover:shadow-primary/40 transition-all flex items-center gap-2"
            >
              <Plus size={20} />
              <span className="font-bold">New Task</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter Chips */}
      <div className="flex items-center gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {['all', 'todo', 'in-progress', 'done'].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all
              ${filter === s ? 'bg-slate-900 text-white shadow-lg' : 'bg-white text-slate-500 hover:bg-slate-50 border border-slate-100'}
            `}
          >
            {s.replace('-', ' ')}
          </button>
        ))}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-4">
          {loading ? (
            <div className="py-20 text-center space-y-4">
              <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mx-auto"></div>
              <p className="text-slate-500 font-bold">Retrieving Team Tasks...</p>
            </div>
          ) : tasks.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {tasks.map((task) => (
                <div 
                  key={task.id} 
                  onClick={() => setSelectedTask(task)}
                  className={`group relative bg-white rounded-[2.5rem] p-6 border-2 transition-all cursor-pointer
                    ${selectedTask?.id === task.id ? 'border-primary shadow-xl ring-4 ring-primary/5' : 'border-transparent shadow-sm hover:shadow-md hover:border-slate-200'}
                  `}
                >
                  <div className="flex justify-between items-start mb-6">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-sm ${getPriorityColor(task.priority)}`}>
                      {task.priority}
                    </span>
                    <div className="flex items-center gap-2">
                      {canManageTasks && (
                        <button 
                          onClick={(e) => handleDeleteTask(task.id, e)}
                          className="w-8 h-8 rounded-full bg-red-50 text-red-500 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500 hover:text-white"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                      <div className="flex -space-x-2">
                        {task.assigned_to && (
                          <div className="w-8 h-8 rounded-full border-2 border-white overflow-hidden shadow-sm">
                            <img src={task.assigned_to.avatar_url || `https://ui-avatars.com/api/?name=${task.assigned_to.full_name}`} className="w-full h-full object-cover" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <h3 className="text-xl font-black text-slate-900 mb-2 leading-tight">{task.title}</h3>
                  <p className="text-slate-500 text-sm font-medium line-clamp-2 mb-6 min-h-[2.5rem]">{task.description || 'No description provided.'}</p>

                  <div className="space-y-4">
                    <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <span>Progress</span>
                      <span className="text-slate-900">{task.progress_percent}%</span>
                    </div>
                    <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-700 ease-out ${task.progress_percent === 100 ? 'bg-emerald-500' : 'bg-primary'}`} 
                        style={{ width: `${task.progress_percent}%` }}
                      ></div>
                    </div>
                  </div>

                  {task.delay_explanation && (
                    <div className="mt-4 p-3 bg-amber-50 rounded-2xl flex items-start gap-2 border border-amber-100">
                      <AlertCircle size={14} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-[11px] font-bold text-amber-800 line-clamp-2 italic">"{task.delay_explanation}"</p>
                    </div>
                  )}

                  <div className="absolute bottom-4 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                    <ChevronRight size={20} className="text-slate-300" />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-24 text-center bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <BarChart3 className="mx-auto text-slate-300 mb-4" size={48} />
              <h3 className="text-xl font-black text-slate-900">Zero Operations</h3>
              <p className="text-slate-500 font-medium max-w-xs mx-auto mt-2">All tasks are accounted for. Time to plan the next phase.</p>
            </div>
          )}
        </div>

        {/* Details & Actions Sidebar */}
        <div className="space-y-6">
          {selectedTask ? (
            <div className="bg-slate-900 rounded-[3rem] p-8 text-white shadow-2xl sticky top-6 space-y-8 animate-slide-up">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em]">Live Intelligence</span>
                <div className="flex items-center gap-2">
                  {canManageTasks && (
                    <button 
                      onClick={() => { setEditingTask(selectedTask); setShowEditModal(true); }}
                      className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
                    >
                      <Edit3 size={14} />
                    </button>
                  )}
                  <button onClick={() => setSelectedTask(null)}><X size={20} className="text-slate-500 hover:text-white transition-colors" /></button>
                </div>
              </div>

              <div>
                <h2 className="text-2xl font-black mb-2">{selectedTask.title}</h2>
                <div className="flex items-center gap-3 text-slate-400 text-sm font-medium">
                  <div className="flex items-center gap-1.5"><Calendar size={14}/> {selectedTask.due_date ? new Date(selectedTask.due_date).toLocaleDateString() : 'No date'}</div>
                  <div className="flex items-center gap-1.5"><Clock size={14}/> {selectedTask.status.replace('-', ' ')}</div>
                </div>
              </div>

              {/* Progress Control */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-xs font-black uppercase tracking-widest text-slate-400">Task Velocity</label>
                  <span className="text-xl font-black text-primary">{selectedTask.progress_percent}%</span>
                </div>
                {(canManageTasks || selectedTask.assigned_to?.id === profile?.id) && (
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    step="5"
                    value={selectedTask.progress_percent} 
                    onChange={(e) => handleUpdateTask(selectedTask.id, { 
                      progress_percent: parseInt(e.target.value),
                      status: parseInt(e.target.value) === 100 ? 'done' : parseInt(e.target.value) > 0 ? 'in-progress' : 'todo'
                    })}
                    className="w-full h-1.5 bg-slate-800 rounded-full appearance-none cursor-pointer accent-primary"
                  />
                )}
              </div>

              {/* Explanation / Delay Section */}
              <div className="space-y-4">
                <label className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <MessageSquare size={14}/> Intelligence Update
                </label>
                {(selectedTask.assigned_to?.id === profile?.id) ? (
                  <textarea 
                    placeholder="Provide details on progress or reasons for delay..."
                    className="w-full bg-slate-800/50 border border-slate-700 rounded-2xl p-4 text-sm font-medium focus:ring-1 focus:ring-primary transition-all h-32"
                    value={selectedTask.delay_explanation || ''}
                    onBlur={(e) => handleUpdateTask(selectedTask.id, { delay_explanation: e.target.value })}
                    onChange={(e) => setSelectedTask({...selectedTask, delay_explanation: e.target.value})}
                  />
                ) : (
                  <div className="p-4 bg-slate-800/30 rounded-2xl border border-slate-800 italic text-sm text-slate-400">
                    {selectedTask.delay_explanation || 'Waiting for update from assignee...'}
                  </div>
                )}
              </div>

              <div className="pt-6 border-t border-slate-800 flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-slate-800 flex items-center justify-center shadow-inner overflow-hidden">
                  <img src={selectedTask.assigned_to?.avatar_url || `https://ui-avatars.com/api/?name=${selectedTask.assigned_to?.full_name}`} className="w-full h-full object-cover" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Assigned Operative</p>
                  <p className="font-bold text-sm truncate">{selectedTask.assigned_to?.full_name || 'Unassigned'}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-[3rem] p-10 text-center border border-slate-100 shadow-sm space-y-6">
              <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto text-slate-200">
                <BarChart3 size={32} />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-black text-slate-900">Task Intelligence</h3>
                <p className="text-sm text-slate-500 font-medium leading-relaxed">Select a task to review deep metrics, assign operatives, or track real-time progress.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl animate-scale-in flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            <div className="flex-1 p-10 overflow-y-auto">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-slate-900">New Deployment</h2>
                <button onClick={() => setShowAddModal(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
              </div>

              <form onSubmit={handleCreateTask} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Mission Title</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g., Q2 Infrastructure Overhaul"
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-lg font-black focus:ring-2 focus:ring-primary/20 transition-all" 
                      value={newTask.title} 
                      onChange={e => setNewTask({...newTask, title: e.target.value})} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Briefing Details</label>
                    <textarea 
                      placeholder="Define the scope and objectives..."
                      className="w-full bg-slate-50 border-none rounded-3xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all h-32" 
                      value={newTask.description} 
                      onChange={e => setNewTask({...newTask, description: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Priority Tier</label>
                      <div className="flex gap-2">
                        {['low', 'medium', 'high'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setNewTask({...newTask, priority: p})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                              ${newTask.priority === p ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400'}
                            `}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Deadline</label>
                      <input 
                        type="date" 
                        required
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" 
                        value={newTask.due_date} 
                        onChange={e => setNewTask({...newTask, due_date: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full btn-primary py-5 rounded-3xl text-lg font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  <Plus size={24} /> Initiate Task
                </button>
              </form>
            </div>

            <div className="w-full md:w-80 bg-slate-50 p-10 border-l border-slate-100 overflow-y-auto">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Select Operative</h3>
              <div className="space-y-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setNewTask({...newTask, assigned_to: u.id})}
                    className={`w-full flex items-center gap-4 p-3 rounded-2xl border-2 transition-all text-left
                      ${newTask.assigned_to === u.id ? 'bg-white border-primary shadow-xl ring-4 ring-primary/5' : 'bg-transparent border-transparent hover:bg-white'}
                    `}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary font-black text-sm overflow-hidden border border-slate-100">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{u.full_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{u.designation || u.role}</p>
                    </div>
                    {newTask.assigned_to === u.id && <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Task Modal */}
      {showEditModal && editingTask && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-[3rem] w-full max-w-4xl shadow-2xl animate-scale-in flex flex-col md:flex-row overflow-hidden max-h-[90vh]">
            <div className="flex-1 p-10 overflow-y-auto">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-slate-900">Modify Mission</h2>
                <button onClick={() => setShowEditModal(false)} className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center text-slate-400 hover:text-slate-900 transition-colors"><X size={20} /></button>
              </div>

              <form onSubmit={(e) => { e.preventDefault(); handleUpdateTask(editingTask.id, editingTask); }} className="space-y-8">
                <div className="space-y-6">
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Mission Title</label>
                    <input 
                      type="text" 
                      required 
                      className="w-full bg-slate-50 border-none rounded-2xl px-6 py-4 text-lg font-black focus:ring-2 focus:ring-primary/20 transition-all" 
                      value={editingTask.title} 
                      onChange={e => setEditingTask({...editingTask, title: e.target.value})} 
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Briefing Details</label>
                    <textarea 
                      className="w-full bg-slate-50 border-none rounded-3xl px-6 py-4 text-sm font-medium focus:ring-2 focus:ring-primary/20 transition-all h-32" 
                      value={editingTask.description} 
                      onChange={e => setEditingTask({...editingTask, description: e.target.value})} 
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Priority Tier</label>
                      <div className="flex gap-2">
                        {['low', 'medium', 'high'].map(p => (
                          <button
                            key={p}
                            type="button"
                            onClick={() => setEditingTask({...editingTask, priority: p})}
                            className={`flex-1 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all border-2
                              ${editingTask.priority === p ? 'border-primary bg-primary/5 text-primary shadow-sm' : 'border-slate-50 bg-slate-50 text-slate-400'}
                            `}
                          >
                            {p}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-black uppercase tracking-widest text-slate-500 ml-1">Deadline</label>
                      <input 
                        type="date" 
                        className="w-full bg-slate-50 border-none rounded-2xl px-6 py-3.5 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" 
                        value={editingTask.due_date ? editingTask.due_date.split('T')[0] : ''} 
                        onChange={e => setEditingTask({...editingTask, due_date: e.target.value})} 
                      />
                    </div>
                  </div>
                </div>

                <button 
                  type="submit" 
                  className="w-full btn-primary py-5 rounded-3xl text-lg font-black shadow-2xl shadow-primary/30 flex items-center justify-center gap-3 transition-transform hover:scale-[1.02] active:scale-[0.98]"
                >
                  Save Changes
                </button>
              </form>
            </div>

            <div className="w-full md:w-80 bg-slate-50 p-10 border-l border-slate-100 overflow-y-auto">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-8">Reassign Operative</h3>
              <div className="space-y-3">
                {users.map(u => (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setEditingTask({...editingTask, assigned_to: u.id})}
                    className={`w-full flex items-center gap-4 p-3 rounded-2xl border-2 transition-all text-left
                      ${editingTask.assigned_to === u.id || editingTask.assigned_to?.id === u.id ? 'bg-white border-primary shadow-xl ring-4 ring-primary/5' : 'bg-transparent border-transparent hover:bg-white'}
                    `}
                  >
                    <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center text-primary font-black text-sm overflow-hidden border border-slate-100">
                      {u.avatar_url ? <img src={u.avatar_url} className="w-full h-full object-cover" /> : u.full_name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-black text-slate-900 truncate">{u.full_name}</p>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tighter truncate">{u.designation || u.role}</p>
                    </div>
                    {(editingTask.assigned_to === u.id || editingTask.assigned_to?.id === u.id) && <div className="w-2 h-2 rounded-full bg-primary animate-pulse"></div>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Tasks;
;
