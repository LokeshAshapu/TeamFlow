import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  TrendingUp, 
  CheckCircle2, 
  Clock, 
  Users,
  Calendar,
  ArrowRight,
  CheckSquare,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const StatCard = ({ title, value, icon: Icon, color }) => (
  <div className="card hover:border-primary/50 transition-colors group">
    <div className="flex items-start justify-between">
      <div>
        <p className="text-gray-500 text-sm font-medium">{title}</p>
        <h3 className="text-2xl font-bold mt-1">{value}</h3>
      </div>
      <div className={`p-3 rounded-xl ${color} text-white shadow-lg`}>
        <Icon size={20} />
      </div>
    </div>
  </div>
);

const Dashboard = () => {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState([]);
  const [activities, setActivities] = useState([]);
  const [stats, setStats] = useState({ active: 0, completed: 0, team: 0, progress: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (profile) {
      fetchData();
    } else {
      setLoading(false);
    }

    // Set up real-time subscriptions
    const taskSubscription = supabase
      .channel('dashboard-tasks')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, fetchData)
      .subscribe();

    const activitySubscription = supabase
      .channel('dashboard-activities')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' }, (payload) => {
        setActivities(prev => [payload.new, ...prev].slice(0, 5));
      })
      .subscribe();

    return () => {
      supabase.removeChannel(taskSubscription);
      supabase.removeChannel(activitySubscription);
    };
  }, []);

  const fetchData = async () => {
    try {
      // Fetch Tasks
      let taskQuery = supabase.from('tasks').select('*, assigned_to(full_name)').order('updated_at', { ascending: false }).limit(5);
      let activityQuery = supabase.from('activities').select('*, profiles(full_name)').order('created_at', { ascending: false }).limit(5);
      let statsQuery = supabase.from('tasks').select('status, progress_percent');
      let teamQuery = supabase.from('profiles').select('*', { count: 'exact', head: true });

      // Multi-tenancy scoping
      if (profile?.role !== 'admin' && profile?.team_id) {
        taskQuery = taskQuery.eq('team_id', profile.team_id);
        activityQuery = activityQuery.eq('team_id', profile.team_id);
        statsQuery = statsQuery.eq('team_id', profile.team_id);
        teamQuery = teamQuery.eq('team_id', profile.team_id);
      }

      const { data: taskData } = await taskQuery;
      const { data: activityData } = await activityQuery;
      const { data: allTasks } = await statsQuery;
      const { count: teamCount } = await teamQuery;

      const active = allTasks?.filter(t => t.status !== 'done').length || 0;
      const completed = allTasks?.filter(t => t.status === 'done').length || 0;
      const avgProgress = allTasks?.length 
        ? Math.round(allTasks.reduce((acc, t) => acc + t.progress_percent, 0) / allTasks.length) 
        : 0;

      setTasks(taskData || []);
      setActivities(activityData || []);
      setStats({ active, completed, team: teamCount || 0, progress: avgProgress });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 animate-slide-in">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-secondary">Welcome back, {profile?.full_name}!</h1>
          <p className="text-gray-500">Here's the real-time status of your projects.</p>
        </div>
        <button 
          onClick={() => navigate('/calendar')}
          className="btn-primary"
        >
          <Calendar size={18} />
          Full Schedule
        </button>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Active Tasks" value={stats.active} icon={Clock} color="bg-blue-500" />
        <StatCard title="Completed" value={stats.completed} icon={CheckCircle2} color="bg-accent" />
        <StatCard title="Team Members" value={stats.team} icon={Users} color="bg-purple-500" />
        <StatCard title="Avg. Progress" value={`${stats.progress}%`} icon={TrendingUp} color="bg-orange-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">Recent Updates</h2>
              <button 
                onClick={() => navigate('/tasks')}
                className="text-primary hover:underline text-sm font-medium flex items-center gap-1"
              >
                View All <ArrowRight size={14} />
              </button>
            </div>
            
            <div className="space-y-4">
              {tasks.length > 0 ? tasks.map((task) => (
                <div key={task.id} className="flex items-center justify-between p-4 hover:bg-gray-50 rounded-xl transition-colors border border-transparent hover:border-gray-100">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${task.status === 'done' ? 'bg-green-50 text-accent' : 'bg-blue-50 text-primary'}`}>
                      <CheckSquare size={20} />
                    </div>
                    <div>
                      <h4 className="font-semibold">{task.title}</h4>
                      <p className="text-sm text-gray-500">
                        {task.assigned_to?.full_name ? `Assigned to: ${task.assigned_to.full_name}` : 'Unassigned'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 text-[10px] font-bold rounded-full uppercase ${
                      task.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                    }`}>
                      {task.status.replace('-', ' ')}
                    </span>
                    <div className="w-12 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 ${task.status === 'done' ? 'bg-accent' : 'bg-primary'}`} 
                        style={{ width: `${task.progress_percent}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              )) : (
                <div className="py-10 text-center text-gray-400">No recent task activity.</div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className="card">
            <h2 className="text-lg font-bold mb-4">Activity Feed</h2>
            <div className="space-y-6 relative before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-100">
              {activities.length > 0 ? activities.map((activity) => (
                <div key={activity.id} className="relative pl-8">
                  <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-white border-2 border-primary z-10 shadow-sm"></div>
                  <p className="text-sm">
                    <span className="font-bold">{activity.profiles?.full_name || 'System'}</span> {activity.action}
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(activity.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )) : (
                <div className="py-10 text-center text-gray-400 text-sm">No recent activities.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
