import { useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';

export const useNotifications = (profile) => {
  const notifiedIds = useRef(new Set(JSON.parse(sessionStorage.getItem('notified_events') || '[]')));

  useEffect(() => {
    if (!profile) return;

    // Save notified IDs to session storage when they change
    const updateStorage = () => {
      sessionStorage.setItem('notified_events', JSON.stringify(Array.from(notifiedIds.current)));
    };

    const checkEvents = async () => {
      if (Notification.permission !== 'granted') return;

      const now = new Date();
      const fifteenMinutesLater = new Date(now.getTime() + 15 * 60000);

      try {
        // Check Tasks
        const { data: tasks } = await supabase
          .from('tasks')
          .select('id, title, deadline')
          .eq('status', 'todo')
          .gte('deadline', now.toISOString())
          .lte('deadline', fifteenMinutesLater.toISOString());

        // Check Meetings
        const { data: meetings } = await supabase
          .from('scheduled_meetings')
          .select('id, title, start_time')
          .gte('start_time', now.toISOString())
          .lte('start_time', fifteenMinutesLater.toISOString());

        // Process Tasks
        tasks?.forEach(task => {
          if (!notifiedIds.current.has(task.id)) {
            new Notification('Task Deadline Approaching', {
              body: `"${task.title}" is due soon!`,
              icon: '/logo.png' // Replace with your logo path if available
            });
            notifiedIds.current.add(task.id);
          }
        });

        // Process Meetings
        meetings?.forEach(meeting => {
          if (!notifiedIds.current.has(meeting.id)) {
            new Notification('Meeting Starting Soon', {
              body: `"${meeting.title}" starts in 15 minutes!`,
              icon: '/logo.png'
            });
            notifiedIds.current.add(meeting.id);
          }
        });

        updateStorage();
      } catch (error) {
        console.error('Notification check failed:', error);
      }
    };

    // Initial check
    checkEvents();

    // Check every minute
    const interval = setInterval(checkEvents, 60000);

    return () => clearInterval(interval);
  }, [profile]);

  const requestPermission = async () => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted') return true;
    
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  };

  return { requestPermission };
};
