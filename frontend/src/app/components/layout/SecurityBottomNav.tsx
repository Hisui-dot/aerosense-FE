import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router';
import { Home, ClipboardList, User, Plus } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { alertsApi } from '@/app/services/api';
import { QuickReportSheet } from './QuickReportSheet';

interface NavItem {
  path: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
  badge?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/', icon: Home, label: 'Home', exact: true },
  { path: '/alerts', icon: ClipboardList, label: 'History' },
  { path: '/profile', icon: User, label: 'Profile' },
];

export const SecurityBottomNav = () => {
  const location = useLocation();
  const [reportOpen, setReportOpen] = useState(false);
  const [activeCount, setActiveCount] = useState(0);

  // Lightweight poll for the Alerts-tab badge (active or in-progress incidents).
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const alerts = await alertsApi.getAll();
        if (cancelled) return;
        setActiveCount(
          alerts.filter(
            (a) =>
              a.status === 'ACTIVE' ||
              a.status === 'REOPENED' ||
              a.status === 'ACKNOWLEDGED' ||
              a.status === 'RESPONDING'
          ).length
        );
      } catch {
        // Badge is non-critical; leave the last known count on failure.
      }
    };
    load();
    const interval = setInterval(load, 3000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isActive = (item: NavItem) =>
    item.exact ? location.pathname === item.path : location.pathname.startsWith(item.path);

  const renderTab = (item: NavItem) => {
    const Icon = item.icon;
    const active = isActive(item);
    const showBadge = item.badge && activeCount > 0;
    return (
      <Link
        key={item.path}
        to={item.path}
        className={`flex flex-1 flex-col items-center justify-center gap-1 transition-all ${
          active ? 'text-[#0B1847]' : 'text-gray-400 hover:text-gray-600'
        }`}
      >
        <div
          className={`relative flex h-8 w-12 items-center justify-center rounded-full transition-all ${
            active ? 'bg-[#EEF2FE]' : ''
          }`}
        >
          <Icon className={`h-6 w-6 ${active ? 'stroke-[2.5px]' : ''}`} />
          {showBadge && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-500 px-1 text-[10px] font-bold leading-none text-white">
              {activeCount > 9 ? '9+' : activeCount}
            </span>
          )}
        </div>
        <span className={`text-xs leading-none ${active ? 'font-bold text-[#0B1847]' : 'font-medium'}`}>
          {item.label}
        </span>
      </Link>
    );
  };

  return (
    <>
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white shadow-[0_-4px_20px_rgba(11,24,71,0.10)]"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-around px-2">
          {renderTab(NAV_ITEMS[0])}
          {renderTab(NAV_ITEMS[1])}

          {/* Center slot — raised Quick Report action button */}
          <div className="flex flex-1 flex-col items-center justify-center">
            <button
              type="button"
              onClick={() => setReportOpen(true)}
              aria-label="Quick report"
              className="-mt-8 flex h-14 w-14 items-center justify-center rounded-full bg-[#0B1847] text-white shadow-[0_6px_16px_rgba(11,24,71,0.4)] ring-4 ring-[#EEF2FE] transition-transform active:scale-95"
            >
              <Plus className="h-7 w-7 stroke-[2.5px]" />
            </button>
            <span className="mt-0.5 text-xs font-semibold leading-none text-[#0B1847]">Report</span>
          </div>

          {renderTab(NAV_ITEMS[2])}
          
        </div>
      </nav>

      <QuickReportSheet open={reportOpen} onOpenChange={setReportOpen} />
    </>
  );
};

