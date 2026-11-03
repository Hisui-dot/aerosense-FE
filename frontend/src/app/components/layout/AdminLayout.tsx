import { useState, useEffect, useRef } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { motion } from 'motion/react';
import { AdminSidebar } from './AdminSidebar';
import {
  Search,
  Bell,
  Menu,
  ChevronDown,
  X,
  AlertCircle,
  BatteryWarning,
  CheckCircle,
  MapPin,
} from 'lucide-react';
import { toast } from 'sonner';
import { alertsApi, devicesApi, usersApi } from '@/app/services/api';

interface Notification {
  id: string;
  type: 'alert' | 'battery' | 'resolved';
  message: string;
  time: string;
  read: boolean;
}

const PAGE_TITLES: Record<string, string> = {
  '/admin': 'Dashboard',
  '/admin/alerts': 'Alerts',
  '/admin/devices': 'Devices',
  '/admin/analytics': 'Analytics',
  '/admin/users': 'Users',
  '/admin/logs': 'Logs',
  '/admin/settings': 'Settings',
  '/admin/profile': 'Profile',
};

export const AdminLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [globalSearch, setGlobalSearch] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchCache, setSearchCache] = useState<{
    alerts: any[];
    devices: any[];
    users: any[];
  } | null>(null);
  const navigate = useNavigate();
  const location = useLocation();

  const currentTitle =
    Object.entries(PAGE_TITLES).find(([path]) =>
      path === '/admin' ? location.pathname === '/admin' : location.pathname.startsWith(path)
    )?.[1] ?? 'Admin';

  const knownAlertsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowNotifs(false);
        setSidebarOpen(false);
        setShowSearchResults(false);
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
              try {
                const audio = new Audio(
                  'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3'
                );
                audio.play().catch(() => {});
              } catch (e) {}

              toast.custom(
                (t) => (
                  <div
                    className="bg-red-600 text-white p-5 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.8)] border-2 border-red-300 flex items-start gap-4 w-[350px] sm:w-[400px] cursor-pointer animate-in slide-in-from-top-5 duration-300"
                    onClick={() => {
                      toast.dismiss(t);
                      navigate('/admin/alerts', { state: { alertId: a.id } });
                    }}
                  >
                    <div className="bg-white rounded-full p-2 shadow-inner animate-pulse">
                      <AlertCircle className="h-8 w-8 text-red-600" />
                    </div>
                    <div className="flex-1">
                      <h1 className="text-xl font-black uppercase tracking-wider mb-1 drop-shadow-md">
                        🚨 NEW ALERT
                      </h1>
                      <p className="font-bold text-lg leading-tight">
                        {a.type || 'Vaping Detected'}
                      </p>
                      <div className="bg-black/20 rounded-lg p-2.5 mt-2.5 border border-white/20">
                        <p className="text-white font-bold flex items-center gap-1.5 text-sm">
                          <MapPin className="h-4 w-4 flex-shrink-0" />
                          {a.floor ? `${a.floor} — ` : ''}
                          {a.location || 'Unknown'}
                        </p>
                      </div>
                      <p className="text-sm mt-3 font-bold text-red-100 uppercase tracking-wide flex items-center gap-2">
                        Check Dashboard Immediately <ChevronDown className="h-4 w-4 -rotate-90" />
                      </p>
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

    return () => {
      clearInterval(interval);
    };
  }, [navigate]);

  useEffect(() => {
    const loadSearchData = async () => {
      try {
        const [alertsData, devicesData, usersData] = await Promise.all([
          alertsApi.getAll().catch(() => []),
          devicesApi.getAll().catch(() => []),
          usersApi.getAll().catch(() => []),
        ]);
        setSearchCache({ alerts: alertsData, devices: devicesData, users: usersData });
      } catch (error) {}
    };
    loadSearchData();
  }, []);

  useEffect(() => {
    if (!globalSearch.trim() || !searchCache) {
      setSearchResults([]);
      return;
    }

    const query = globalSearch.toLowerCase();
    const results: any[] = [];

    searchCache.devices
      .filter(
        (d: any) =>
          String(d.id || '').toLowerCase().includes(query) ||
          String(d.name || '').toLowerCase().includes(query) ||
          String(d.location || d.floor || '').toLowerCase().includes(query)
      )
      .forEach((d: any) => {
        results.push({
          id: `dev-${d.id}`,
          type: 'Device',
          title: d.name || d.id,
          subtitle: `${d.location || d.floor} • ${d.status}`,
          path: `/admin/devices`,
        });
      });

    searchCache.alerts
      .filter(
        (a: any) =>
          String(a.id || '').toLowerCase().includes(query) ||
          String(a.location || '').toLowerCase().includes(query)
      )
      .forEach((a: any) => {
        results.push({
          id: `alt-${a.id}`,
          type: 'Alert',
          title: a.id.includes('-') ? a.id : `ALT-${a.id.substring(0, 6).toUpperCase()}`,
          subtitle: `${a.location} • ${a.status}`,
          path: '/admin/alerts',
          state: { alertId: a.id },
        });
      });

    searchCache.users
      .filter(
        (u: any) =>
          String(u.name || '').toLowerCase().includes(query) ||
          String(u.email || '').toLowerCase().includes(query) ||
          String(u.username || '').toLowerCase().includes(query)
      )
      .forEach((u: any) => {
        results.push({
          id: `usr-${u.id}`,
          type: 'User',
          title: u.name || u.username,
          subtitle: `${u.email} • ${u.role}`,
          path: `/admin/users`,
        });
      });

    setSearchResults(results.slice(0, 8));
  }, [globalSearch, searchCache]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  return (
    <div className="flex h-screen w-full bg-[#F8FAFC] overflow-hidden relative font-sans">
      {/* Sidebar — desktop always visible */}
      <div className="hidden lg:flex">
        <AdminSidebar />
      </div>

      {/* Mobile sidebar overlay */}
      <div
        className={`fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity duration-300 ease-in-out ${
          sidebarOpen
            ? 'opacity-100 backdrop-blur-sm pointer-events-auto'
            : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setSidebarOpen(false)}
      />
      <div
        className={`fixed inset-y-0 left-0 z-50 lg:hidden transition-transform duration-300 ease-out shadow-2xl shadow-sky-950/40 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <AdminSidebar onClose={() => setSidebarOpen(false)} />
      </div>

      {/* Right content area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Header Bar (Search + Keyboard Hint + Notification Bell) */}
        <header className="flex items-center justify-between px-4 sm:px-8 py-3.5 border-b border-slate-200/80 bg-white flex-shrink-0 z-10">
          {/* Left side: Hamburger (mobile) + Context */}
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-xl hover:bg-slate-100 transition-all duration-150 active:scale-[0.98]"
            >
              <Menu className="h-6 w-6 text-slate-600" />
            </button>

            <div className="hidden lg:block">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {currentTitle}
              </span>
            </div>
          </div>

          {/* Right Utilities: Search & Notification Bell */}
          <div className="flex items-center gap-3 ml-auto">
            {/* Search */}
            <div className="relative hidden sm:block w-64 md:w-72">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search..."
                value={globalSearch}
                onChange={(e) => {
                  setGlobalSearch(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-12 py-2 text-sm text-slate-700 placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#0284C7]/20 focus:border-[#0284C7] transition-all duration-150"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 pointer-events-none">
                <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400">
                  ⌘
                </kbd>
                <kbd className="hidden sm:inline-flex items-center justify-center rounded border border-slate-200 bg-white px-1.5 font-mono text-[10px] font-medium text-slate-400">
                  K
                </kbd>
              </div>

              {showSearchResults && globalSearch.trim() !== '' && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setShowSearchResults(false)} />
                  <div className="absolute top-full right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-100 z-20 overflow-hidden">
                    {searchResults.length > 0 ? (
                      <div className="max-h-[350px] overflow-y-auto py-2">
                        {searchResults.map((res) => (
                          <button
                            key={res.id}
                            onClick={() => {
                              navigate(res.path, { state: res.state });
                              setShowSearchResults(false);
                              setGlobalSearch('');
                            }}
                            className="w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-slate-50 transition-colors last:border-0"
                          >
                            <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-sm text-slate-900">{res.title}</span>
                              <span className="text-[10px] font-bold px-2 py-0.5 bg-slate-100 text-slate-600 rounded-full">
                                {res.type}
                              </span>
                            </div>
                            <div className="text-xs text-slate-500">{res.subtitle}</div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="p-4 text-center text-sm text-slate-500">
                        No results found for "{globalSearch}"
                      </div>
                    )}
                  </div>
                </>
              )}
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

        {/* Page content */}
        <div className="flex-1 overflow-y-auto bg-[#F8FAFC]">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
            className="min-h-full p-4 sm:p-8"
          >
            <Outlet />
          </motion.div>
        </div>
      </div>

      {/* Notification Sheet Backdrop */}
      <div
        className={`fixed inset-0 bg-slate-900/20 backdrop-blur-sm z-40 transition-opacity duration-300 ease-in-out ${
          showNotifs ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        onClick={() => setShowNotifs(false)}
      />

      {/* Notifications Panel Container */}
      <div
        className={`fixed top-0 right-0 h-full w-full max-w-sm sm:max-w-md bg-white shadow-2xl z-50 flex flex-col transition-transform duration-300 ease-out transform ${
          showNotifs ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-4 sm:px-5 py-3 sm:py-4 border-b border-gray-200">
          <div>
            <h2 className="font-bold text-gray-900 text-lg">Notifications</h2>
            {unreadCount > 0 && <p className="text-sm text-gray-500">{unreadCount} unread</p>}
          </div>
          <div className="flex items-center gap-3">
            {notifications.length > 0 && (
              <button
                onClick={() => setNotifications([])}
                className="text-sm text-gray-500 font-semibold hover:text-gray-700 transition-colors"
              >
                Clear all
              </button>
            )}
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-sm text-[#2665D0] font-semibold hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={() => setShowNotifs(false)}
              className="p-1.5 rounded-lg hover:bg-slate-100 hover:text-slate-900 hover:rotate-90 transition-all duration-150"
            >
              <X className="h-5 w-5 text-gray-600 transition-colors" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {notifications.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-gray-400">
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
                  navigate('/admin/alerts', { state: { alertId: n.id } });
                }
              }}
              className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${
                !n.read ? 'bg-blue-50' : 'bg-white'
              }`}
            >
              <div
                className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                  n.type === 'alert'
                    ? 'bg-red-100'
                    : n.type === 'battery'
                    ? 'bg-yellow-100'
                    : 'bg-green-100'
                }`}
              >
                {n.type === 'alert' && <AlertCircle className="h-5 w-5 text-red-600" />}
                {n.type === 'battery' && <BatteryWarning className="h-5 w-5 text-yellow-600" />}
                {n.type === 'resolved' && <CheckCircle className="h-5 w-5 text-green-600" />}
              </div>
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm leading-snug ${
                    !n.read ? 'font-semibold text-gray-900' : 'text-gray-700'
                  }`}
                >
                  {n.message}
                </p>
                <p className="text-xs text-gray-400 mt-1">{n.time}</p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  dismiss(n.id);
                }}
                className="p-1 rounded-full hover:bg-gray-200 flex-shrink-0"
              >
                <X className="h-4 w-4 text-gray-400" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
