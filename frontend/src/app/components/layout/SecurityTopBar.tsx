import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router';
import { ShieldCheck, Bell, X, AlertCircle, BatteryWarning, CheckCircle, MapPin, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { alertsApi, devicesApi } from '@/app/services/api';
import { AeroSenseLogo } from './AeroSenseLogo';

interface Notification {
  id: string;
  type: 'alert' | 'battery' | 'resolved';
  message: string;
  time: string;
  read: boolean;
}

export const SecurityTopBar = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  const knownAlertsRef = useRef<Set<string>>(new Set());
  const isFirstLoad = useRef(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const [alertsData, devicesData] = await Promise.all([
          alertsApi.getAll().catch(() => []),
          devicesApi.getAll().catch(() => [])
        ]);
        const newNotifs: Notification[] = [];
        
        const activeAlerts = alertsData.filter((a: any) => a.status === 'ACTIVE' || a.status === 'REOPENED' || a.status === 'ACKNOWLEDGED' || a.status === 'RESPONDING');

        if (!isFirstLoad.current) {
          activeAlerts.forEach((a: any) => {
            if (!knownAlertsRef.current.has(a.id) && (a.status === 'ACTIVE' || a.status === 'new')) {
              try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(() => {});
              } catch (e) {}
              
              toast.custom((t) => (
                <div className="bg-red-600 text-white p-5 rounded-2xl shadow-[0_0_50px_rgba(220,38,38,0.8)] border-2 border-red-300 flex items-start gap-4 w-[350px] sm:w-[400px] cursor-pointer animate-in slide-in-from-top-5 duration-300" onClick={() => {
                  toast.dismiss(t);
                  navigate(`/alerts/${a.id}`);
                }}>
                  <div className="bg-white rounded-full p-2 shadow-inner animate-pulse">
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  </div>
                  <div className="flex-1">
                    <h1 className="text-xl font-black uppercase tracking-wider mb-1 drop-shadow-md">🚨 NEW ALERT</h1>
                    <p className="font-bold text-lg leading-tight">{a.type || 'Vaping Detected'}</p>
                    <div className="bg-black/20 rounded-lg p-2.5 mt-2.5 border border-white/20">
                      <p className="text-white font-bold flex items-center gap-1.5 text-sm">
                        <MapPin className="h-4 w-4 flex-shrink-0" />
                        {a.floor ? `${a.floor} — ` : ''}{a.location || 'Unknown'}
                      </p>
                    </div>
                    <p className="text-sm mt-3 font-bold text-red-100 uppercase tracking-wide flex items-center gap-2">Respond Immediately <ChevronDown className="h-4 w-4 -rotate-90"/></p>
                  </div>
                </div>
              ), { duration: 15000, position: 'top-center', id: `global-alert-${a.id}` });
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
            read: a.status !== 'ACTIVE'
          });
        });

        devicesData.filter((d: any) => d.battery < 20).forEach((d: any) => {
          newNotifs.push({
            id: `batt-${d.id}`,
            type: 'battery',
            message: `Sensor ${d.name || d.id} battery critical — ${d.battery}% remaining`,
            time: 'Recently',
            read: false
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
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  };

  const dismiss = (id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const displayName = user?.name || (user?.username
    ? user.username.charAt(0).toUpperCase() + user.username.slice(1)
    : 'Officer');

  return (
    <>
      <div className="bg-[#0B1847] shadow-lg sticky top-0 z-40" style={{ height: '64px' }}>
        <div className="flex items-center justify-between h-full px-4 max-w-7xl mx-auto">
          <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <AeroSenseLogo size="md" showText={true} className="text-white" />
          </Link>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setShowNotifs(true)}
              className="relative p-2 rounded-xl hover:bg-white/10 transition-colors"
            >
              <Bell className="h-5 w-5 text-gray-300" />
            {unreadCount > 0 && (
              <span className="absolute top-0 right-0 bg-red-600 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center leading-none border-2 border-[#0B1847]">
                {unreadCount}
              </span>
            )}
            </button>

            <div className="flex items-center gap-2 pl-3 border-l border-white/10">
              <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-sm" style={{ background: '#2665D0' }}>
                {displayName.charAt(0)}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showNotifs && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-[60]"
            onClick={() => setShowNotifs(false)}
          />
          <div className="fixed top-0 right-0 bottom-0 w-full max-w-sm bg-white z-[70] shadow-2xl flex flex-col animate-slide-left">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <div>
                <h2 className="font-bold text-gray-900 text-lg">Notifications</h2>
                {unreadCount > 0 && (
                  <p className="text-sm text-gray-500">{unreadCount} unread</p>
                )}
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
                  className="p-1 rounded-full hover:bg-gray-100"
                >
                  <X className="h-5 w-5 text-gray-600" />
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
              {notifications.map(n => (
                <div
                  key={n.id}
            onClick={() => {
              if (n.type === 'alert') {
                setShowNotifs(false);
                navigate(`/alerts/${n.id}`);
              }
            }}
            className={`flex items-start gap-3 px-5 py-4 cursor-pointer hover:bg-gray-50 transition-colors ${!n.read ? 'bg-blue-50' : 'bg-white'}`}
                >
                  <div className={`mt-0.5 flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center ${
                    n.type === 'alert' ? 'bg-red-100' :
                    n.type === 'battery' ? 'bg-yellow-100' : 'bg-green-100'
                  }`}>
                    {n.type === 'alert' && <AlertCircle className="h-5 w-5 text-red-600" />}
                    {n.type === 'battery' && <BatteryWarning className="h-5 w-5 text-yellow-600" />}
                    {n.type === 'resolved' && <CheckCircle className="h-5 w-5 text-green-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm leading-snug ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {n.message}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">{n.time}</p>
                  </div>
                  <button
              onClick={(e) => { e.stopPropagation(); dismiss(n.id); }}
                    className="p-1 rounded-full hover:bg-gray-200 flex-shrink-0"
                  >
                    <X className="h-4 w-4 text-gray-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
};
