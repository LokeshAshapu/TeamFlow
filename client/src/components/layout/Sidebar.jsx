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
  Zap,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const Sidebar = () => {
  const { profile, signOut, isAdmin } = useAuth();
  const [isOpen, setIsOpen] = React.useState(false);

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
    <>
      {/* Mobile Top Bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-secondary flex items-center justify-between px-6 z-50 border-b border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={18} className="text-white fill-white" />
          </div>
          <span className="text-lg font-black tracking-tight text-white">TeamFlow</span>
        </div>
        <button 
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 text-gray-400 hover:text-white transition-colors"
        >
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[55] animate-in fade-in duration-300"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Sidebar Container */}
      <div className={`
        fixed left-0 top-0 h-screen bg-secondary text-white flex flex-col z-[60] transition-transform duration-300 ease-out w-64
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}>
        <div className="p-6 hidden md:flex items-center gap-3">
          <div className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Zap size={24} className="text-white fill-white" />
          </div>
          <span className="text-xl font-black tracking-tight text-white">TeamFlow</span>
        </div>

        {/* Mobile Sidebar Close Button */}
        <div className="md:hidden p-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Zap size={18} className="text-white fill-white" />
            </div>
            <span className="text-lg font-black tracking-tight text-white">TeamFlow</span>
          </div>
          <button onClick={() => setIsOpen(false)} className="p-2 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 px-4 py-4 space-y-2 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.name}
              to={item.path}
              onClick={() => setIsOpen(false)}
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
            onClick={() => {
              setIsOpen(false);
              signOut();
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-red-400 hover:bg-red-400/5 rounded-xl transition-all duration-200"
          >
            <LogOut size={20} />
            <span className="font-medium">Logout</span>
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;
