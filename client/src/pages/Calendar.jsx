import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon, 
  Clock, 
  Plus, 
  X, 
  CheckSquare, 
  Video,
  Bell,
  MoreVertical,
  AlertCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const Calendar = () => {
  const { profile, isAdmin, isLead } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showModal, setShowModal] = useState(false);
  const [newMeeting, setNewMeeting] = useState({
    title: '',
    description: '',
    start_time: '',
    end_time: ''
  });

  useEffect(() => {
    if (profile) {
      fetchEvents();
      requestNotificationPermission();
    }
  }, [profile, currentDate]);

  const requestNotificationPermission = async () => {
    if ('Notification' in window && Notification.permission === 'default') {
      await Notification.permission === 'default' && Notification.requestPermission();
    }
  };

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).toISOString();
      const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).toISOString();

      // Fetch Tasks with deadlines
      let taskQuery = supabase
        .from('tasks')
        .select('id, title, deadline, status')
        .gte('deadline', startOfMonth)
        .lte('deadline', endOfMonth);

      // Fetch Scheduled Meetings
      let meetingQuery = supabase
        .from('scheduled_meetings')
        .select('*')
        .gte('start_time', startOfMonth)
        .lte('start_time', endOfMonth);

      if (profile.role !== 'admin' && profile.team_id) {
        taskQuery = taskQuery.eq('team_id', profile.team_id);
        meetingQuery = meetingQuery.eq('team_id', profile.team_id);
      }

      const [{ data: tasks }, { data: meetings }] = await Promise.all([
        taskQuery,
        meetingQuery
      ]);

      const formattedEvents = [
        ...(tasks || []).map(t => ({
          id: t.id,
          title: t.title,
          date: new Date(t.deadline),
          type: 'task',
          status: t.status
        })),
        ...(meetings || []).map(m => ({
          id: m.id,
          title: m.title,
          date: new Date(m.start_time),
          endTime: m.end_time ? new Date(m.end_time) : null,
          type: 'meeting',
          description: m.description
        }))
      ];

      setEvents(formattedEvents);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e) => {
    e.preventDefault();
    try {
      const { error } = await supabase.from('scheduled_meetings').insert([{
        title: newMeeting.title,
        description: newMeeting.description,
        start_time: new Date(`${selectedDate.toDateString()} ${newMeeting.start_time}`).toISOString(),
        end_time: newMeeting.end_time ? new Date(`${selectedDate.toDateString()} ${newMeeting.end_time}`).toISOString() : null,
        team_id: profile.team_id,
        created_by: profile.id
      }]);

      if (error) throw error;
      setShowModal(false);
      fetchEvents();
      setNewMeeting({ title: '', description: '', start_time: '', end_time: '' });
    } catch (error) {
      alert(error.message);
    }
  };

  // Calendar Helpers
  const daysInMonth = (year, month) => new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay();
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

  const isToday = (day) => {
    const today = new Date();
    return day === today.getDate() && currentDate.getMonth() === today.getMonth() && currentDate.getFullYear() === today.getFullYear();
  };

  const getEventsForDay = (day) => {
    return events.filter(e => e.date.getDate() === day && e.date.getMonth() === currentDate.getMonth() && e.date.getFullYear() === currentDate.getFullYear());
  };

  return (
    <div className="h-[calc(100vh-12rem)] md:h-[calc(100vh-8rem)] flex flex-col gap-6 animate-fade-in">
      {/* Calendar Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white/80 backdrop-blur-md p-6 rounded-3xl shadow-xl border border-white/20">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-primary/10 text-primary rounded-2xl">
            <CalendarIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-secondary">{monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}</h1>
            <p className="text-sm text-gray-500 font-medium">Manage your team's deadlines and meetings</p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex bg-gray-100 p-1 rounded-xl">
            <button onClick={prevMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"><ChevronLeft size={20} /></button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 text-sm font-bold hover:bg-white hover:shadow-sm rounded-lg transition-all text-secondary">Today</button>
            <button onClick={nextMonth} className="p-2 hover:bg-white hover:shadow-sm rounded-lg transition-all text-gray-600"><ChevronRight size={20} /></button>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="btn-primary"
          >
            <Plus size={18} /> Schedule
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-6 overflow-hidden">
        {/* Main Grid */}
        <div className="flex-1 bg-white/80 backdrop-blur-md rounded-3xl shadow-xl border border-white/20 flex flex-col overflow-hidden">
          <div className="grid grid-cols-7 border-b border-gray-100">
            {days.map(d => (
              <div key={d} className="py-4 text-center text-[10px] font-black uppercase tracking-widest text-gray-400">
                {d}
              </div>
            ))}
          </div>
          
          <div className="flex-1 grid grid-cols-7 overflow-y-auto">
            {Array.from({ length: firstDayOfMonth }).map((_, i) => (
              <div key={`empty-${i}`} className="min-h-[120px] border-b border-r border-gray-50 bg-gray-50/30"></div>
            ))}
            
            {Array.from({ length: daysInMonth(currentDate.getFullYear(), currentDate.getMonth()) }).map((_, i) => {
              const day = i + 1;
              const dayEvents = getEventsForDay(day);
              const active = day === selectedDate.getDate() && currentDate.getMonth() === selectedDate.getMonth();
              
              return (
                <div 
                  key={day} 
                  onClick={() => setSelectedDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), day))}
                  className={`min-h-[120px] border-b border-r border-gray-50 p-2 transition-all cursor-pointer group hover:bg-primary/5 ${
                    active ? 'bg-primary/5' : ''
                  }`}
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className={`w-8 h-8 flex items-center justify-center rounded-lg text-sm font-bold transition-all ${
                      isToday(day) ? 'bg-primary text-white shadow-lg shadow-blue-500/20 scale-110' : 'text-secondary group-hover:text-primary'
                    }`}>
                      {day}
                    </span>
                    {dayEvents.length > 0 && <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>}
                  </div>
                  
                  <div className="space-y-1 overflow-hidden">
                    {dayEvents.slice(0, 3).map(e => (
                      <div 
                        key={e.id}
                        className={`text-[10px] px-2 py-1 rounded-lg truncate font-bold flex items-center gap-1 ${
                          e.type === 'meeting' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {e.type === 'meeting' ? <Video size={10} /> : <CheckSquare size={10} />}
                        {e.title}
                      </div>
                    ))}
                    {dayEvents.length > 3 && (
                      <p className="text-[9px] text-gray-400 font-bold px-2">+{dayEvents.length - 3} more</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Detail Panel */}
        <div className="w-full lg:w-96 flex flex-col gap-6">
          <div className="card h-full bg-white/80 backdrop-blur-md flex flex-col p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-xl font-bold text-secondary">{selectedDate.toLocaleDateString('en-US', { day: 'numeric', month: 'long' })}</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">{selectedDate.toLocaleDateString('en-US', { weekday: 'long' })}</p>
              </div>
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400">
                <Bell size={20} />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-2 custom-scrollbar">
              {getEventsForDay(selectedDate.getDate()).length > 0 ? (
                getEventsForDay(selectedDate.getDate()).map(e => (
                  <motion.div 
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    key={e.id} 
                    className={`p-4 rounded-2xl border transition-all hover:scale-[1.02] ${
                      e.type === 'meeting' ? 'bg-purple-50/50 border-purple-100' : 'bg-blue-50/50 border-blue-100'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className={`p-2 rounded-xl ${e.type === 'meeting' ? 'bg-purple-600 text-white' : 'bg-primary text-white'}`}>
                        {e.type === 'meeting' ? <Video size={16} /> : <CheckSquare size={16} />}
                      </div>
                      <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                        {e.type === 'meeting' ? 'Meeting' : 'Task'}
                      </span>
                    </div>
                    <h4 className="font-bold text-secondary mb-1">{e.title}</h4>
                    {e.description && <p className="text-xs text-gray-500 mb-3 line-clamp-2">{e.description}</p>}
                    
                    <div className="flex items-center gap-4 text-[10px] font-bold text-gray-400">
                      <div className="flex items-center gap-1.5">
                        <Clock size={12} />
                        {e.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </div>
                      {e.status && (
                        <div className="flex items-center gap-1.5 uppercase tracking-tighter">
                          <div className={`w-1.5 h-1.5 rounded-full ${e.status === 'done' ? 'bg-accent' : 'bg-primary'}`}></div>
                          {e.status}
                        </div>
                      )}
                    </div>
                  </motion.div>
                ))
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center py-20">
                  <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center text-gray-200 mb-4 border border-gray-100">
                    <CalendarIcon size={32} />
                  </div>
                  <h3 className="text-sm font-bold text-gray-400">No events scheduled</h3>
                  <p className="text-[10px] text-gray-400 mt-1 max-w-[150px]">Take a break or schedule something new!</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Schedule Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-secondary/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                      <Video size={24} />
                    </div>
                    <div>
                      <h2 className="text-2xl font-black text-secondary">Schedule Meeting</h2>
                      <p className="text-sm text-gray-500 font-medium">For {selectedDate.toDateString()}</p>
                    </div>
                  </div>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-xl transition-all text-gray-400">
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={handleCreateMeeting} className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Meeting Title</label>
                    <input 
                      type="text"
                      required
                      value={newMeeting.title}
                      onChange={e => setNewMeeting({...newMeeting, title: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-4 focus:ring-purple-500/5 transition-all font-medium"
                      placeholder="Project Sync, Design Review, etc."
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Start Time</label>
                      <input 
                        type="time"
                        required
                        value={newMeeting.start_time}
                        onChange={e => setNewMeeting({...newMeeting, start_time: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-4 focus:ring-purple-500/5 transition-all font-medium"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">End Time</label>
                      <input 
                        type="time"
                        value={newMeeting.end_time}
                        onChange={e => setNewMeeting({...newMeeting, end_time: e.target.value})}
                        className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-4 focus:ring-purple-500/5 transition-all font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Description</label>
                    <textarea 
                      value={newMeeting.description}
                      onChange={e => setNewMeeting({...newMeeting, description: e.target.value})}
                      className="w-full bg-gray-50 border-none rounded-2xl py-4 px-6 focus:ring-4 focus:ring-purple-500/5 transition-all font-medium resize-none h-32"
                      placeholder="What's this meeting about?"
                    />
                  </div>

                  <div className="flex gap-4 pt-4">
                    <button type="button" onClick={() => setShowModal(false)} className="flex-1 py-4 px-6 bg-gray-100 hover:bg-gray-200 text-secondary font-bold rounded-2xl transition-all">Cancel</button>
                    <button type="submit" className="flex-1 py-4 px-6 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-2xl shadow-xl shadow-purple-500/20 transition-all">Schedule Meeting</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Calendar;
