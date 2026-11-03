import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  LayoutDashboard,
  Bell,
  User,
  LogOut,
  ClipboardList,
  Search,
  AlertCircle,
  BatteryWarning,
  CheckCircle,
  MapPin,
  PlusCircle,
  X,
} from 'lucide-react';
import { useAuth } from '@/app/context/AuthContext';
import { AeroSenseLogo } from './AeroSenseLogo';
import { QuickReportSheet } from './QuickReportSheet';
import { alertsApi, devicesApi } from '@/app/services/api';
import { toast } from 'sonner';

interface Notification {
  id: string;
  type: 'alert' | 'battery' | 'resolved';
  message: string;
  time: string;
  read: boolean;
}

interface NavLinkProps {
  path: string;
  icon: React.ElementType;
  label: string;
  active: boolean;
}

const DesktopNavItem = ({ path, icon: Icon, label, active }: NavLinkProps) => (
  <Link
    to={path}
    className={`group relative flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 ease-out active:scale-[0.98] ${
      active
        ? 'bg-white text-[#071126] font-semibold shadow-sm'
        : 'bg-transparent text-slate-400 hover:bg-white/5 hover:text-white font-medium'
    }`}
  >
    <Icon
      className={`h-5 w-5 flex-shrink-0 transition-all duration-300 ease-out ${
        active ? 'text-[#071126]' : 'text-slate-400 group-hover:text-white'
      }`}
    />
    <span className="text-sm">{label}</span>
  </Link>
);

const MobileDockTab = ({ path, icon: Icon, label, active }: NavLinkProps) => (
  <Link
    to={path}
    className={`group relative flex-1 min-h-[46px] rounded-full flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] transition-all duration-300 ease-out active:scale-95 ${
      active
        ? 'bg-white text-[#071126] font-semibold shadow-sm'
        : 'bg-transparent text-slate-300/80 hover:text-white hover:bg-white/5 font-medium'
    }`}
  >
    <Icon
      className={`h-5 w-5 transition-all duration-300 ease-out ${
        active ? 'text-[#071126]' : 'text-slate-300/80 group-hover:text-white'
      }`}
    />
    <span>{label}</span>
  </Link>
);

export const SecurityLayout = () => {
  const [reportOpen, setReportOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const isNavActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const knownAlertsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  const displayName =
    user?.name ||
    (user?.username
      ? user.username === 'guard'
        ? 'Security Guard'
        : user.username.charAt(0).toUpperCase() + user.username.slice(1)
      : 'Security Guard');

  const initialBadge = displayName.charAt(0).toUpperCase() || 'S';

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/login');
    }
  };

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifs(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, []);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [alertsData, devicesData] = await Promise.all([
          alertsApi.getAll().catch(() => []),
          devicesApi.getAll().catch(() => []),
        ]);

        const newNotifs: Notification[] = [];
        const activeAlerts = alertsData.filter(
          (a: any) =>
            a.status === 'ACTIVE' ||
            a.status === 'REOPENED' ||
            a.status === 'ACKNOWLEDGED' ||
            a.status === 'RESPONDING'
        );

        if (!isFirstLoad.current) {
          activeAlerts.forEach((a: any) => {
            if (!knownAlertsRef.current.has(a.id) && (a.status === 'ACTIVE' || a.status === 'new')) {
              toast.custom(
                (t) => (
                  <div
                    className="bg-red-600 text-white p-5 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.8)] border-2 border-red-300 flex items-start gap-4 w-[350px] sm:w-[400px] cursor-pointer animate-in slide-in-from-top-5 duration-300"
                    onClick={() => {
                      toast.dismiss(t);
                      navigate(`/alerts/${a.id}`);
                    }}
                  >
                    <div className="bg-white rounded-full p-2 shadow-inner animate-pulse">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-xl font-black uppercase tracking-wider mb-1 drop-shadow-md">
                        🚨 NEW ALERT
                      </h1>
                      <p className="font-bold text-lg leading-tight">{a.type || 'Vaping Detected'}</p>
                      <div className="bg-black/20 rounded-lg p-2.5 mt-2.5 border border-white/20">
                        <p className="text-white font-bold flex items-center gap-1.5 text-sm">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          {a.floor ? `${a.floor} — ` : ''}
                          {a.location || 'Unknown'}
                        </p>
                      </div>
                    </div>
                  </div>
                ),
                { duration: 15000, position: 'top-center', id: `global-alert-${a.id}` }
              );
              knownAlertsRef.current.add(a.id);
            }
          });
        } else {
          activeAlerts.forEach((a: any) => knownAlertsRef.current.add(a.id));
          isFirstLoad.current = false;
        }

        activeAlerts.forEach((a: any) => {
          newNotifs.push({
            id: a.id,
            type: 'alert',
            message: `Vape detected — ${a.location}`,
            time: a.detectedAt || 'Recently',
            read: a.status !== 'ACTIVE',
          });
        });

        devicesData
          .filter((d: any) => d.battery < 20)
          .forEach((d: any) => {
            newNotifs.push({
              id: `batt-${d.id}`,
              type: 'battery',
              message: `Sensor ${d.name || d.id} battery critical — ${d.battery}% remaining`,
              time: 'Recently',
              read: false,
            });
          });

        setNotifications(newNotifs);
      } catch (error) {}
    };
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 5000);
    return () => clearInterval(interval);
  }, [navigate]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden relative font-sans">
      {/* =====================================================================
          DESKTOP LEFT SIDEBAR (Adamson Dark Navy #071126 -> #0b1b3d)
      ===================================================================== */}
      <aside className="hidden lg:flex flex-col w-72 bg-gradient-to-b from-[#071126] to-[#0b1b3d] border-r border-white/5 flex-shrink-0 z-20">
        {/* Brand Header */}
        <div className="h-20 flex items-center justify-center px-6 border-b border-white/10 relative">
          <Link to="/" className="flex items-center justify-center w-full">
            <AeroSenseLogo size="md" showText={true} className="text-white" />
          </Link>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <button
            onClick={() => setReportOpen(true)}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 mb-6 bg-gradient-to-r from-[#003882] to-[#0284C7] hover:brightness-110 text-white font-semibold rounded-full shadow-md shadow-blue-950/40 transition-all active:scale-95 border border-cyan-400/25 cursor-pointer"
          >
            <PlusCircle className="h-5 w-5" />
            <span>File Manual Report</span>
          </button>

          <div className="text-[11px] font-bold text-slate-400/80 uppercase tracking-wider mb-3 px-4">
            Dispatch
          </div>
          <DesktopNavItem path="/" icon={LayoutDashboard} label="Live Monitor" active={isNavActive('/')} />
          <DesktopNavItem path="/alerts" icon={ClipboardList} label="Response History" active={isNavActive('/alerts')} />

          <div className="text-[11px] font-bold text-slate-400/80 uppercase tracking-wider mb-3 px-4 mt-8">
            Account
          </div>
          <DesktopNavItem path="/profile" icon={User} label="Profile Settings" active={isNavActive('/profile')} />
        </nav>

        {/* Bottom Guard User Card & Integrated Sign Out */}
        <div className="p-4 border-t border-white/10 bg-[#071126]/60">
          <div className="flex items-center justify-between gap-3 p-2.5 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-colors">
            <Link to="/profile" className="flex items-center gap-3 min-w-0 flex-1">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#0284C7] to-[#0b1b3d] border border-cyan-400/30 flex items-center justify-center text-white font-extrabold text-sm shadow-inner flex-shrink-0">
                {initialBadge}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold text-white truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[11px] font-medium text-cyan-400/90 truncate mt-0.5">
                  Guard Operator
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
      </aside>

      {/* =====================================================================
          MAIN WORKSPACE AREA
      ===================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar (Search + Notification Bell Only) */}
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200/80 bg-white flex-shrink-0 z-10">
          <div className="flex items-center gap-4">
            <div className="lg:hidden">
              <AeroSenseLogo size="sm" showText={true} className="text-[#071126]" />
            </div>
          </div>

          {/* Right Utilities: Search & Notification Bell */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Search Input */}
            <div className="relative hidden sm:block w-64 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search alerts, sensors, floors..."
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-4 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:border-[#0284C7] transition-all duration-150"
              />
            </div>

            {/* Notification Bell */}
            <button
              onClick={() => setShowNotifs(true)}
              aria-label="Notifications"
              className="relative p-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-all duration-150 active:scale-[0.98] shadow-xs cursor-pointer"
            >
              <Bell className="h-5 w-5 text-slate-600" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center border-2 border-white shadow-xs">
                  {unreadCount}
                </span>
              )}
            </button>
          </div>
        </header>

        {/* Page Content with Smooth Cross-Fade & Rise on Route Switch */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-full"
          >
            <Outlet />
          </motion.div>
        </div>
      </div>

      {/* =====================================================================
          FLOATING GLASSMORPHIC MOBILE NAVIGATION DOCK (Mobile < lg)
      ===================================================================== */}
      <div className="fixed bottom-4 inset-x-4 max-w-md mx-auto z-50 lg:hidden">
        <nav
          aria-label="Mobile Navigation"
          className="backdrop-blur-md bg-[#071126]/85 border border-white/10 rounded-full shadow-2xl px-2.5 py-2 flex items-center justify-between gap-1"
        >
          <MobileDockTab path="/" icon={LayoutDashboard} label="Monitor" active={isNavActive('/')} />
          <MobileDockTab path="/alerts" icon={ClipboardList} label="History" active={isNavActive('/alerts')} />

          {/* Quick Manual Report */}
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex-1 min-h-[46px] rounded-full flex flex-col items-center justify-center gap-0.5 px-2 py-1.5 text-[11px] font-semibold text-cyan-300 hover:bg-white/10 border border-transparent transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <PlusCircle className="h-5 w-5 text-cyan-400" />
            <span>Report</span>
          </button>

          <MobileDockTab path="/profile" icon={User} label="Profile" active={isNavActive('/profile')} />

          {/* Mobile Sign Out */}
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Sign Out"
            className="min-h-[46px] px-3 rounded-full flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-rose-400/90 hover:bg-rose-500/15 transition-all duration-200 active:scale-95 cursor-pointer"
          >
            <LogOut className="h-5 w-5" />
            <span>Exit</span>
          </button>
        </nav>
      </div>

      {/* =====================================================================
          NOTIFICATIONS SLIDE-OVER DRAWER
      ===================================================================== */}
      <div
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ease-in-out ${
          showNotifs ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowNotifs(false)}
      />
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out transform ${
          showNotifs ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <h2 className="font-bold text-slate-900 text-lg">Notifications</h2>
            {unreadCount > 0 && <p className="text-sm text-slate-500">{unreadCount} unread</p>}
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-sm text-slate-500 font-semibold hover:text-slate-700 transition-colors"
              >
                Clear all
              </button>
            )}
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-sm text-[#0284C7] font-semibold hover:underline">
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowNotifs(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 hover:rotate-90 transition-all duration-150"
            >
              <X className="h-5 w-5 text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-slate-400">
              <Bell className="h-10 w-10 mb-3 opacity-40" />
              <p className="font-semibold">No notifications</p>
            </div>
          )}
          {notifications.map((n) => (
            <div
              key={n.id}
              onClick={() => {
                if (n.type === 'alert') {
                  setShowNotifs(false);
                  navigate(`/alerts/${n.id}`);
                }
              }}
              className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-slate-50 transition-colors ${
                !n.read ? 'bg-sky-50' : 'bg-white'
              }`}
            >
              <div
                className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  n.type === 'alert'
                    ? 'bg-red-100'
                    : n.type === 'battery'
                    ? 'bg-amber-100'
                    : 'bg-emerald-100'
                }`}
              >
                {n.type === 'alert' && <AlertCircle className="h-5 w-5 text-red-600" />}
                {n.type === 'battery' && <BatteryWarning className="h-5 w-5 text-amber-600" />}
                {n.type === 'resolved' && <CheckCircle className="h-5 w-5 text-emerald-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-slate-900' : 'text-slate-700'}`}>
                  {n.message}
                </p>
                <p className="text-xs text-slate-400 mt-1">{n.time}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(n.id);
                }}
                className="p-1 rounded-full hover:bg-slate-200 flex-shrink-0"
              >
                <X className="h-4 w-4 text-slate-400" />
              </button>
            </div>
          ))}
        </div>
      </div>

      <QuickReportSheet open={reportOpen} onOpenChange={setReportOpen} />
    </div>
  );
};
