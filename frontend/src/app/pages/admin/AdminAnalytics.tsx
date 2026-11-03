import { useState, useEffect, useCallback } from 'react';
import { motion } from 'motion/react';
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { Download } from 'lucide-react';
import { analyticsApi, type AnalyticsReports, type AnalyticsQos } from '../../services/api';
import { PageHeader } from '../../components/admin/PageHeader';
import { MetricCard } from '../../components/admin/MetricCard';
import { ChartCard } from '../../components/admin/ChartCard';
import { AsyncBoundary } from '../../components/admin/AsyncBoundary';
import { Button } from '../../components/ui/button';
import { downloadCsv } from '../../lib/csv';
import { classifyReading, DEFAULT_PM25_THRESHOLD } from '../../lib/thresholds';
import { chart, status as statusColors, type StatusTone } from '../../theme/tokens';

interface AnalyticsData {
  reports: AnalyticsReports;
  qos: AnalyticsQos;
}

function pm25Tone(value: number): StatusTone {
  const level = classifyReading(value, DEFAULT_PM25_THRESHOLD);
  return level === 'critical' ? 'danger' : level === 'warning' ? 'warning' : 'success';
}

function EmptyNote({ label }: { label: string }) {
  return <div className="flex h-[160px] items-center justify-center text-sm text-muted-foreground">{label}</div>;
}

export const AdminAnalytics = () => {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [reports, qos] = await Promise.all([analyticsApi.reports(), analyticsApi.qos()]);
      setData({ reports, qos });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const exportHighRisk = () => {
    if (!data) return;
    downloadCsv('high-risk-areas.csv', data.reports.highRiskAreas);
  };

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="admin-page-container w-full max-w-7xl mx-auto space-y-4 md:space-y-6">
        <PageHeader
          title="Analytics"
          subtitle={data ? data.reports.summary.period : undefined}
          actions={
            <Button variant="outline" size="sm" onClick={exportHighRisk} disabled={!data}>
              <Download className="mr-1.5 h-4 w-4" /> Export CSV
            </Button>
          }
        />

        <AsyncBoundary loading={loading && !data} error={error} onRetry={load}>
          {data ? <AnalyticsBody data={data} /> : null}
        </AsyncBoundary>
      </div>
    </div>
  );
};

function AnalyticsBody({ data }: { data: AnalyticsData }) {
  const { reports, qos } = data;

  return (
    <div className="space-y-4 md:space-y-6">
      {/* KPI strip */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3"
      >
        <MetricCard label="Total detections" value={reports.summary.totalDetections} />
        <MetricCard label="Confirmed" value={reports.summary.confirmedIncidents} tone="warning" />
        <MetricCard label="False alarms" value={reports.summary.falseAlarms} tone="neutral" />
        <MetricCard label="Success rate" value={reports.summary.successRate} tone="success" />
        <MetricCard label="Avg PM2.5" value={`${reports.airQuality.avgPm25} µg/m³`} tone={pm25Tone(reports.airQuality.avgPm25)} />
        <MetricCard label="Avg VOC" value={reports.airQuality.avgVoc} />
      </motion.div>

      {/* Trend + peak hours */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.16, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <ChartCard title="Detection trend — this week">
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={reports.detectionTrend} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 11 }} stroke={chart.grid} />
              <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={chart.grid} width={28} />
              <Tooltip />
              <Bar dataKey="count" name="Detections" fill={chart.pm25} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1200} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Peak hours">
          {reports.peakTimePeriods.some((p) => p.incidents > 0) ? (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={reports.peakTimePeriods} margin={{ top: 5, right: 12, left: -16, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 9 }} stroke={chart.grid} interval={0} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} stroke={chart.grid} width={28} />
                <Tooltip />
                <Bar dataKey="incidents" name="Incidents" fill={chart.voc} radius={[4, 4, 0, 0]} isAnimationActive={true} animationDuration={1200} />
              </BarChart>
            </ResponsiveContainer>
          ) : <EmptyNote label="No incidents recorded" />}
        </ChartCard>
      </motion.div>

      {/* High-risk areas + recent PM2.5 */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.24, ease: [0.16, 1, 0.3, 1] }}
        className="grid grid-cols-1 lg:grid-cols-2 gap-4"
      >
        <ChartCard title="High-risk areas">
          {reports.highRiskAreas.length ? (
            <div className="space-y-3">
              {reports.highRiskAreas.map((a, i) => (
                <div key={a.location}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="truncate">{a.location}</span>
                    <span className="text-muted-foreground">{a.incidents} ({a.percentage}%)</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${a.percentage}%`, background: i === 0 ? statusColors.danger : statusColors.warning }} />
                  </div>
                </div>
              ))}
            </div>
          ) : <EmptyNote label="No incidents recorded" />}
        </ChartCard>
        <ChartCard title="Air quality — recent PM2.5">
          {qos.performanceData.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={qos.performanceData} margin={{ top: 5, right: 12, left: -12, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={chart.grid} vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 11 }} stroke={chart.grid} />
                <YAxis tick={{ fontSize: 11 }} stroke={chart.grid} width={34} />
                <Tooltip />
                <ReferenceLine y={DEFAULT_PM25_THRESHOLD} stroke={chart.threshold} strokeDasharray="5 4" />
                <Line type="monotone" dataKey="response" name="PM2.5 (µg/m³)" stroke={chart.pm25} strokeWidth={2} dot={false} isAnimationActive={true} animationDuration={1200} />
              </LineChart>
            </ResponsiveContainer>
          ) : <EmptyNote label="No readings yet" />}
        </ChartCard>
      </motion.div>

      {/* Device performance */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.32, ease: [0.16, 1, 0.3, 1] }}
      >
        <ChartCard title="Device performance">
          {reports.devicePerformance.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Device</th>
                    <th className="py-2 px-3 font-medium">Detections</th>
                    <th className="py-2 px-3 font-medium">Offline events</th>
                    <th className="py-2 px-3 font-medium">Avg response</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.devicePerformance.map((d) => (
                    <tr key={d.id} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{d.id}</td>
                      <td className="py-2 px-3">{d.detections}</td>
                      <td className="py-2 px-3">{d.offlineEvents}</td>
                      <td className="py-2 px-3">{d.avgResponse}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyNote label="No devices" />}
        </ChartCard>
      </motion.div>

      {/* Officer activity */}
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.38, ease: [0.16, 1, 0.3, 1] }}
      >
        <ChartCard title="Officer activity">
          {reports.userActivity.length ? (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2 pr-3 font-medium">Officer</th>
                    <th className="py-2 px-3 font-medium">Alerts handled</th>
                    <th className="py-2 px-3 font-medium">Resolved</th>
                  </tr>
                </thead>
                <tbody>
                  {reports.userActivity.map((u) => (
                    <tr key={u.name} className="border-b border-border/60">
                      <td className="py-2 pr-3 font-medium">{u.name}</td>
                      <td className="py-2 px-3">{u.handled}</td>
                      <td className="py-2 px-3">{u.resolved}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyNote label="No officer activity" />}
        </ChartCard>
      </motion.div>
    </div>
  );
}

