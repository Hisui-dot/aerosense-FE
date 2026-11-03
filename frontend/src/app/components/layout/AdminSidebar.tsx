import { Link, useLocation, useNavigate } from 'react-router';
import {
  LayoutDashboard,
  Radio,
  History,
  BarChart3,
  Settings,
  LogOut,
  X,
  Bell,
  Shield,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { AeroSenseLogo } from './AeroSenseLogo';

const OVERVIEW_NAV = [
  { path: '/admin', icon: LayoutDashboard, label: 'Dashboard' },
  { path: '/admin/alerts', icon: Bell, label: 'Live Alerts' },
  { path: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
];

const MANAGEMENT_NAV = [
  { path: '/admin/devices', icon: Radio, label: 'Sensor Devices' },
  { path: '/admin/users', icon: Shield, label: 'Guard Roster' },
];

const SYSTEM_NAV = [
  { path: '/admin/logs', icon: History, label: 'Activity Logs' },
  { path: '/admin/settings', icon: Settings, label: 'Settings' },
];

interface AdminSidebarProps {
  onClose?: () => void;
}

interface SidebarNavItemProps {
  path: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
  onClose?: () => void;
}

const SidebarNavItem = ({ path, icon: Icon, label, active, onClose }: SidebarNavItemProps) => (
  <Link
    to={path}
    onClick={onClose}
    className={`group relative flex items-center gap-3 px-4 py-2.5 rounded-xl mb-1 transition-all duration-300 ease-out active:scale-[0.98] ${
      active
        ? 'bg-white text-[#071126] font-semibold shadow-sm'
        : 'bg-transparent text-slate-400 hover:text-white hover:bg-white/5 font-medium'
    }`}
  >
    <Icon
      className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ease-out ${
        active ? 'text-[#071126]' : 'text-slate-400 group-hover:text-white'
      }`}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

export const AdminSidebar = ({ onClose }: AdminSidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const displayName = user?.name || 'System Admin';

  const isActive = (path: string) => {
    if (path === '/admin') return location.pathname === '/admin';
    return location.pathname.startsWith(path);
  };

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/login');
    }
  };

  return (
    <div className="w-[268px] flex-shrink-0 flex flex-col h-full bg-gradient-to-b from-[#071126] to-[#0b1835] border-r border-white/5">
      {/* Logo Header */}
      <div className="px-6 pt-7 pb-6 border-b border-white/10 flex items-center justify-between">
        <Link
          to="/admin"
          onClick={onClose}
          className="flex items-center gap-3 hover:opacity-90 transition-opacity active:scale-[0.98]"
        >
          <AeroSenseLogo iconSize={40} showText={false} />
          <div className="flex flex-col">
            <span className="text-xl font-bold text-white tracking-tight leading-none">
              Aero<span className="text-cyan-400">Sense</span>
            </span>
            <span className="text-[9px] uppercase tracking-[0.2em] text-cyan-400 font-bold mt-1">
              IOT SECURITY
            </span>
          </div>
        </Link>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1.5 rounded-lg hover:bg-white/10 transition-colors active:scale-[0.98]"
          >
            <X className="w-5 h-5 text-slate-400" />
          </button>
        )}
      </div>

      {/* Nav sections */}
      <div className="px-4 flex-1 overflow-y-auto space-y-6 mt-5">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400/80 px-3 mb-2.5">
            Overview
          </p>
          <nav>
            {OVERVIEW_NAV.map((item) => (
              <SidebarNavItem
                key={item.path}
                {...item}
                active={isActive(item.path)}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400/80 px-3 mb-2.5">
            Management
          </p>
          <nav>
            {MANAGEMENT_NAV.map((item) => (
              <SidebarNavItem
                key={item.path}
                {...item}
                active={isActive(item.path)}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>

        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400/80 px-3 mb-2.5">
            System
          </p>
          <nav>
            {SYSTEM_NAV.map((item) => (
              <SidebarNavItem
                key={item.path}
                {...item}
                active={isActive(item.path)}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>
      </div>

      {/* Bottom Admin User Card & Integrated Sign Out */}
      <div className="p-4 border-t border-white/10 bg-[#071126]/60">
        <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors">
          <Link
            to="/admin/profile"
            onClick={onClose}
            className="flex items-center gap-3 min-w-0 flex-1"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#003882] to-[#0284C7] border border-cyan-400/30 flex items-center justify-center text-white font-extrabold text-xs shadow-inner flex-shrink-0">
              SA
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold text-white truncate leading-tight">
                {displayName}
              </p>
              <p className="text-[11px] font-medium text-cyan-400/90 truncate mt-0.5">
                Administrator
              </p>
            </div>
          </Link>

          <button
            type="button"
            onClick={handleLogout}
            title="Sign Out"
            aria-label="Sign Out"
            className="p-2.5 rounded-xl text-slate-300 hover:text-rose-400 hover:bg-rose-500/15 border border-transparent hover:border-rose-500/25 transition-all active:scale-95 flex-shrink-0 cursor-pointer"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
