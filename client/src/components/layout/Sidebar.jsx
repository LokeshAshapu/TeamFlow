import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  CheckSquare, 
  Video, 
  MessageSquare, 
  Users, 
  Settings, 
  LogOut,
  ChevronRight,
  User,
  Zap
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const { profile, signOut, isAdmin } = useAuth();

  const navItems = [
    { name: 'Dashboard', icon: LayoutDashboard, path: '/' },
    { name: 'Tasks', icon: CheckSquare, path: '/tasks' },
    { name: 'Meetings', icon: Video, path: '/meetings' },
    { name: 'Team Chat', icon: MessageSquare, path: '/chat' },
    { name: 'My Profile', icon: User, path: '/profile' },
  ];

  if (isAdmin) {
    navItems.push({ name: 'Manage Team', icon: Users, path: '/team' });
  }

  return (
    <div className="w-64 h-screen bg-secondary text-white flex flex-col fixed left-0 top-0 z-50">
      <div className="p-6 flex items-center gap-3">
        <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
          <Zap size={24} className="text-white fill-white" />
        </div>
        <span className="text-xl font-black tracking-tight text-white">TeamFlow</span>
      </div>

      <nav className="flex-1 px-4 py-4 space-y-2">
        {navItems.map((item) => (
          <NavLink
            key={item.name}
            to={item.path}
            className={({ isActive }) => `
              flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group
              ${isActive 
                ? 'bg-primary text-white shadow-lg shadow-blue-500/20' 
                : 'text-gray-400 hover:bg-white/5 hover:text-white'}
            `}
          >
            <item.icon size={20} />
            <span className="font-medium">{item.name}</span>
            <ChevronRight size={16} className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-white/10">
        <div className="flex items-center gap-3 mb-4 px-2">
          <div className="w-10 h-10 rounded-xl bg-gray-700 flex items-center justify-center text-sm font-bold border border-white/10 overflow-hidden shadow-inner">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} className="w-full h-full object-cover" />
            ) : (
              profile?.full_name?.charAt(0) || profile?.email?.charAt(0)
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{profile?.full_name}</p>
            <p className="text-xs text-gray-500 truncate capitalize">{profile?.role}</p>
          </div>
        </div>
        
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-200"
        >
          <LogOut size={20} />
          <span className="font-medium">Logout</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
