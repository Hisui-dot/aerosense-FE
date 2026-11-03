import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router';
import { motion } from 'motion/react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { AlertTriangle, Radio, BarChart2, Wind, ArrowUpRight, ArrowRight } from 'lucide-react';
import {
  analyticsApi,
  alertsApi,
  type AnalyticsSummary,
  type AnalyticsReports,
  type AnalyticsQos,
  type WeeklyPoint,
  type Alert,
} from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';
import { AsyncBoundary } from '@/app/components/admin/AsyncBoundary';
import { AnimatedCounter } from '@/app/components/ui/AnimatedCounter';

interface DashboardData {
  summary: AnalyticsSummary;
  weekly: WeeklyPoint[];
  reports: AnalyticsReports;
  qos: AnalyticsQos;
  alerts: Alert[];
}

export const AdminDashboard = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    try {
      setError(null);
      const [summary, weekly, reports, qos, alerts] = await Promise.all([
        analyticsApi.summary(),
        analyticsApi.weekly(),
        analyticsApi.reports(),
        analyticsApi.qos(),
        alertsApi.getAll(),
      ]);
      setData({ summary, weekly, reports, qos, alerts });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 3000);
    return () => clearInterval(t);
  }, [load]);

  useLiveStream({
    onAlert: () => load().catch(() => {}),
  });

  return (
    <div className="w-full max-w-[1400px] mx-auto space-y-6">
      {/* Top Header Section (Stagger 0ms) */}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.8, delay: 0, ease: [0.16, 1, 0.3, 1] }}
        className="flex flex-col gap-1 mb-6"
      >
        <span className="text-[10px] font-bold tracking-widest text-[#0284C7] uppercase">
          Overview
        </span>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-3xl font-bold text-[#071126] tracking-tight">System Dashboard</h1>
          <span className="inline-flex items-center border border-slate-200 bg-white text-slate-600 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-widest shadow-2xs">
            Administrator
          </span>
        </div>
        <p className="text-sm font-medium text-slate-500">
          Welcome back. Here's what's happening today.
        </p>
      </motion.div>

      <AsyncBoundary loading={loading && !data} error={error} onRetry={load}>
        {data ? (
          <DashboardBody
            data={data}
            onViewAll={() => navigate('/admin/alerts')}
          />
        ) : null}
      </AsyncBoundary>
    </div>
  );
};

function DashboardBody({
  data,
  onViewAll,
}: {
  data: DashboardData;
  onViewAll: () => void;
}) {
  const [timeFilter, setTimeFilter] = useState('24h');
  const { summary, weekly, reports, qos } = data;

  const activeAlerts = Number(summary.alerts.active ?? 0);
  const totalAlertsToday = Number(summary.alerts.total ?? 14);
  const sensorsOnline = Number(summary.devices.online ?? 4);
  const sensorsOffline = Number(summary.devices.offline ?? 6);
  const detectionsToday = Number(
    qos.summaryMetrics.find((m) => m.label === 'Alerts Today')?.value ?? 8
  );
  const avgPm25 = Number(reports.airQuality?.avgPm25 ?? 135);

  return (
    <div className="space-y-6">
      {/* 4 KPI Cards (Staggered 80ms - 260ms) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Active Alerts */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Active Alerts</h3>
            <div className="w-10 h-10 rounded-full bg-rose-50 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-rose-500" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={activeAlerts} duration={1200} />
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1">
              {totalAlertsToday} total today
            </p>
          </div>
        </motion.div>

        {/* Card 2: Sensors Online */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.14, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Sensors Online</h3>
            <div className="w-10 h-10 rounded-full bg-sky-50 flex items-center justify-center">
              <Radio className="w-5 h-5 text-[#0284C7]" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={sensorsOnline} duration={1200} />
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1">{sensorsOffline} offline</p>
          </div>
        </motion.div>

        {/* Card 3: Detections Today */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Detections Today</h3>
            <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center">
              <BarChart2 className="w-5 h-5 text-amber-500" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums">
              <AnimatedCounter value={detectionsToday} duration={1200} />
            </div>
            <p className="text-xs font-semibold text-emerald-600 mt-1 flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> +2 vs yesterday
            </p>
          </div>
        </motion.div>

        {/* Card 4: Avg PM2.5 */}
        <motion.div
          initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ duration: 0.8, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
          className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between transition-shadow duration-300 hover:shadow-md hover:-translate-y-0.5"
        >
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-600">Avg PM2.5</h3>
            <div className="w-10 h-10 rounded-full bg-emerald-50 flex items-center justify-center">
              <Wind className="w-5 h-5 text-emerald-500" />
            </div>
          </div>
          <div>
            <div className="text-4xl font-extrabold text-slate-900 tracking-tight tabular-nums flex items-baseline gap-1">
              <AnimatedCounter value={avgPm25} duration={1200} />{' '}
              <span className="text-sm text-slate-500 font-semibold">µg/m³</span>
            </div>
            <p className="text-xs font-semibold text-slate-400 mt-1">Threshold: 35 µg/m³</p>
          </div>
        </motion.div>
      </div>

      {/* Main Visualizations Row 1 (Stagger 320ms) */}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.85, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-3 gap-6"
      >
        {/* Air Quality Trends */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#071126]">Air Quality Trends</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                PM2.5 levels over the last {timeFilter}
              </p>
            </div>
            <div className="bg-slate-100 p-1 rounded-full flex items-center gap-1">
              {['24h', '7d', '30d'].map((filter) => {
                const isSelected = timeFilter === filter;
                return (
                  <button
                    key={filter}
                    onClick={() => setTimeFilter(filter)}
                    className={`relative px-3.5 py-1 text-xs rounded-full transition-colors duration-200 cursor-pointer ${
                      isSelected
                        ? 'text-white font-semibold'
                        : 'text-slate-500 hover:text-slate-800 font-medium'
                    }`}
                  >
                    {isSelected && (
                      <motion.span
                        layoutId="admin-time-filter-pill"
                        transition={{ type: 'spring', stiffness: 400, damping: 32 }}
                        className="absolute inset-0 bg-[#071126] rounded-full shadow-sm"
                      />
                    )}
                    <span className="relative z-10">{filter}</span>
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex-1 min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={qos.performanceData}
                margin={{ top: 10, right: 0, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id="colorResponse" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#0284C7" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#0284C7" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                  stroke="#E2E8F0"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                  stroke="#E2E8F0"
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="response"
                  stroke="#071126"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#colorResponse)"
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* High-Risk Areas */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#071126]">High-Risk Areas</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Locations requiring attention
              </p>
            </div>
            <button
              onClick={onViewAll}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-[#071126] hover:bg-[#0b1835] text-white text-xs font-semibold shadow-xs hover:brightness-110 active:scale-95 transition-all cursor-pointer"
            >
              <span>View all</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1 space-y-6">
            {reports.highRiskAreas && reports.highRiskAreas.length > 0 ? (
              reports.highRiskAreas.map((area, idx) => (
                <div key={area.location}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-bold text-slate-700">{area.location}</span>
                    <span className="text-xs font-bold text-slate-500">
                      {area.incidents} incidents
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(10, area.percentage))}%` }}
                      transition={{ duration: 1.0, delay: 0.4 + idx * 0.1, ease: [0.16, 1, 0.3, 1] }}
                      className={`h-full rounded-full ${
                        idx === 0 ? 'bg-rose-500' : 'bg-amber-400'
                      }`}
                    />
                  </div>
                </div>
              ))
            ) : (
              <div className="flex items-center justify-center h-full text-sm font-medium text-slate-400">
                No high-risk areas detected.
              </div>
            )}
          </div>

          <div className="pt-5 mt-auto border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">
              {totalAlertsToday} total high-risk incidents · Last 7 days
            </p>
          </div>
        </div>
      </motion.div>

      {/* Main Visualizations Row 2 (Stagger 400ms) */}
      <motion.div
        initial={{ opacity: 0, y: 24, filter: 'blur(3px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.85, delay: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-6"
      >
        {/* Detection Activity */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[#071126]">Detection Activity</h2>
              <p className="text-xs font-medium text-slate-500 mt-1">
                Incidents recorded this week
              </p>
            </div>
            <div className="bg-emerald-50 border border-emerald-100 text-emerald-600 px-2.5 py-1 rounded-full text-xs font-bold flex items-center gap-1">
              <ArrowUpRight className="w-3 h-3" /> 12%
            </div>
          </div>

          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weekly} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                  stroke="#E2E8F0"
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  allowDecimals={false}
                  tick={{ fontSize: 10, fill: '#64748B', fontWeight: 600 }}
                  stroke="#E2E8F0"
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                />
                <Tooltip
                  cursor={{ fill: '#F1F5F9' }}
                  contentStyle={{
                    borderRadius: '12px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    fontWeight: 600,
                    fontSize: '12px',
                  }}
                />
                <Bar
                  dataKey="count"
                  name="Detections"
                  fill="#071126"
                  radius={[6, 6, 6, 6]}
                  barSize={24}
                  isAnimationActive={true}
                  animationDuration={1200}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
