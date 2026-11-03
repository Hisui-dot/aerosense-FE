import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/app/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/app/components/ui/tabs';
import { LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { MapPin, Clock, Radio, Wind, AlertTriangle } from 'lucide-react';
import { alertsApi, devicesApi } from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';

export const Analytics = () => {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [devices, setDevices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [alertsData, devicesData] = await Promise.all([
        alertsApi.getAll().catch(() => []),
        devicesApi.getAll().catch(() => [])
      ]);
      setAlerts(alertsData || []);
      setDevices(devicesData || []);
    } catch (_e) {
      // silently retain last data on transient errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useLiveStream({ onAlert: () => { fetchData(); } });

  // Dynamic Chart Calculations
  const getDayOfWeek = (dateString?: string) => {
    if (!dateString) return 'Mon';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Mon';
    return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][date.getDay()];
  };
  const dailyCounts: Record<string, number> = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
  alerts.forEach(a => {
    const day = getDayOfWeek(a.createdAt || a.resolvedAt || a.detectedAt);
    dailyCounts[day]++;
  });
  const incidentTrendData = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => ({ date: day, alerts: dailyCounts[day] }));

  const locationCounts = alerts.reduce((acc: Record<string, number>, a) => {
    const loc = a.location ? `${a.floor || 'Unknown'} - ${a.location}` : 'Unknown Location';
    acc[loc] = (acc[loc] || 0) + 1;
    return acc;
  }, {});
  const highRiskLocations = Object.entries(locationCounts)
    .map(([name, count]) => ({ name, alerts: count as number }))
    .sort((a, b) => b.alerts - a.alerts).slice(0, 5);
  if (highRiskLocations.length === 0) highRiskLocations.push({ name: 'No Active Detections', alerts: 0 });

  const getHour = (a: any) => {
    if (a.createdAt) {
      const d = new Date(a.createdAt);
      if (!isNaN(d.getTime())) return d.getHours();
    }
    if (a.detectedAt) {
      const match = String(a.detectedAt).match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (match) {
         let h = parseInt(match[1]);
         if (match[3].toUpperCase() === 'PM' && h < 12) h += 12;
         if (match[3].toUpperCase() === 'AM' && h === 12) h = 0;
         return h;
      }
    }
    return new Date().getHours();
  };

  const peakTimes = [
    { time: 'Morning (12AM-12PM)', level: 'Moderate', count: alerts.filter(a => getHour(a) < 12).length, color: 'bg-yellow-500' },
    { time: 'Afternoon (12PM-5PM)', level: 'Highest', count: alerts.filter(a => getHour(a) >= 12 && getHour(a) < 17).length, color: 'bg-red-500' },
    { time: 'Evening (5PM+)', level: 'Low', count: alerts.filter(a => getHour(a) >= 17).length, color: 'bg-green-500' },
  ];

  const vapeCount = alerts.filter(a => a.type?.toLowerCase().includes('vape')).length;
  const pmCount = alerts.filter(a => a.type?.toLowerCase().includes('pm2.5') || a.pm25 > 50).length;
  const otherCount = Math.max(0, alerts.length - vapeCount - pmCount);
  const total = alerts.length || 1;
  const detectionClassificationData = [
    { name: 'Vape', value: Math.round((vapeCount / total) * 100), color: '#EF4444' },
    { name: 'High PM2.5', value: Math.round((pmCount / total) * 100), color: '#F59E0B' },
    { name: 'Unknown', value: Math.round((otherCount / total) * 100), color: '#9CA3AF' },
  ];

  const sensorActivity = devices.slice(0, 5).map(d => ({
    id: d.id, location: d.location || 'Unknown Room', detections: alerts.filter(a => a.sensorId === d.id).length
  }));
  if (sensorActivity.length === 0) sensorActivity.push({ id: 'None', location: 'No sensors connected', detections: 0 });

  const avgPM25 = alerts.length ? Math.round(alerts.reduce((acc, a) => acc + (a.pm25 || 0), 0) / alerts.length) : null;
  const avgVOC = alerts.length ? Math.round(alerts.reduce((acc, a) => acc + (a.voc || 0), 0) / alerts.length) : null;
  const maxPM25 = alerts.length ? Math.max(...alerts.map(a => a.pm25 || 0)) : null;
  const minPM25 = alerts.length ? Math.min(...alerts.map(a => a.pm25 || 0)) : null;

  const airQualityData = incidentTrendData.map(d => ({
    day: d.date,
    pm25: d.alerts > 0 ? (avgPM25 ?? 0) : 0,
    voc: d.alerts > 0 ? (avgVOC ?? 0) : 0,
  }));

  const deadZones = devices.filter(d => alerts.filter(a => a.sensorId === d.id).length === 0).slice(0, 3).map(d => ({
    location: d.location || 'Unknown', detections: 0, status: 'Blind Spot'
  }));
  if (deadZones.length === 0) deadZones.push({ location: 'All sensors active', detections: alerts.length, status: 'Healthy' });

  const hasData = alerts.length > 0 || devices.length > 0;

  if (loading) {
    return (
      <div className="min-h-screen bg-[#82BCFE] flex items-center justify-center">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-4 border-white border-t-transparent mx-auto mb-3" />
          <p className="font-semibold text-lg">Loading analytics…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-20">

      <div className="p-4 w-full mx-auto">
        <Tabs defaultValue="main" className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4 bg-white/20 rounded-2xl p-1">
            <TabsTrigger 
              value="main"
              className="rounded-xl text-white data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold"
            >
              Main Analytics
            </TabsTrigger>
            <TabsTrigger 
              value="details"
              className="rounded-xl text-white data-[state=active]:bg-white data-[state=active]:text-blue-600 font-bold"
            >
              Details
            </TabsTrigger>
          </TabsList>

          {/* MAIN ANALYTICS TAB */}
          <TabsContent value="main" className="space-y-4">
            {!hasData && (
              <Card className="p-8 bg-white shadow-lg rounded-2xl border-0 text-center">
                <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                <p className="font-semibold text-gray-500">No data yet. Data will appear once alerts are recorded.</p>
              </Card>
            )}
            {/* Top Section - Incident Trends */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Incident Trends</h2>
              <p className="text-sm text-gray-600 mb-4">Number of alerts over the past week</p>
              {!hasData ? (
                <div className="flex items-center justify-center h-[250px] text-gray-400 font-semibold">No data yet</div>
              ) : (
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={incidentTrendData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#6B7280"
                    style={{ fontSize: '12px', fontWeight: '600' }}
                  />
                  <YAxis 
                    stroke="#6B7280"
                    style={{ fontSize: '12px', fontWeight: '600' }}
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#fff', 
                      border: '2px solid #2563EB',
                      borderRadius: '12px',
                      fontWeight: '600'
                    }}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="alerts" 
                    stroke="#2563EB" 
                    strokeWidth={3}
                    dot={{ fill: '#2563EB', strokeWidth: 2, r: 5 }}
                    activeDot={{ r: 7 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              )}
            </Card>

            {/* Middle Section - Key Insights */}
            <div className="space-y-4">
              <h2 className="font-bold text-white text-lg">Key Insights</h2>
              
              {/* High-Risk Locations */}
              <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-red-600" />
                  <h3 className="font-bold text-gray-900">High-Risk Locations</h3>
                </div>
                <div className="space-y-3">
                  {highRiskLocations.map((location, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center text-red-600 font-bold text-sm">
                          {index + 1}
                        </div>
                        <span className="font-semibold text-gray-900">{location.name}</span>
                      </div>
                      <div className="font-bold text-red-600">{location.alerts} alerts</div>
                    </div>
                  ))}
                </div>
              </Card>

              {/* Peak Detection Times */}
              <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-5 w-5 text-blue-600" />
                  <h3 className="font-bold text-gray-900">Peak Detection Times</h3>
                </div>
                <div className="space-y-3">
                  {peakTimes.map((peak, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-gray-900">{peak.time}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-sm text-gray-600">{peak.level}</span>
                          <span className="font-bold text-gray-900">{peak.count}</span>
                        </div>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div 
                          className={`${peak.color} h-2 rounded-full`}
                          style={{ width: `${(peak.count / 25) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            {/* Lower Section - Detection Classification */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <h2 className="font-bold text-gray-900 text-lg mb-4">Detection Classification</h2>
              <div className="flex flex-col items-center">
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie
                      data={detectionClassificationData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {detectionClassificationData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                
                {/* Legend */}
                <div className="flex flex-wrap gap-4 mt-4 justify-center">
                  {detectionClassificationData.map((item, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded-full"
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="text-sm font-semibold text-gray-700">
                        {item.name}: {item.value}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* DETAILS TAB */}
          <TabsContent value="details" className="space-y-4">
            {/* Sensor Activity Summary */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <div className="flex items-center gap-2 mb-4">
                <Radio className="h-5 w-5 text-blue-600" />
                <h2 className="font-bold text-gray-900 text-lg">Sensor Activity Summary</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">Total detections per sensor</p>
              <div className="space-y-3">
                {sensorActivity.map((sensor, index) => (
                  <div key={index} className="space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900">{sensor.id}</span>
                        <span className="text-sm text-gray-600 ml-2">{sensor.location}</span>
                      </div>
                      <span className="font-bold text-blue-600">{sensor.detections}</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-[#82BCFE] h-2 rounded-full"
                        style={{ width: `${(sensor.detections / 45) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Air Quality Overview */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <div className="flex items-center gap-2 mb-4">
                <Wind className="h-5 w-5 text-green-600" />
                <h2 className="font-bold text-gray-900 text-lg">Air Quality Overview</h2>
              </div>
              
              {/* Key Metrics */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
                <div className="bg-blue-50 p-4 rounded-xl">
                  <div className="text-sm text-gray-600 font-semibold mb-1">Avg PM2.5</div>
                  <div className="text-2xl font-bold text-blue-600">{avgPM25 !== null ? `${avgPM25} µg/m³` : '—'}</div>
                  <div className="text-xs text-gray-500 mt-1">Min: {minPM25 ?? '—'} | Max: {maxPM25 ?? '—'}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-xl">
                  <div className="text-sm text-gray-600 font-semibold mb-1">Avg VOC</div>
                  <div className="text-2xl font-bold text-green-600">{avgVOC !== null ? `${avgVOC} ppb` : '—'}</div>
                  <div className="text-xs text-gray-500 mt-1">Weekly average</div>
                </div>
              </div>

              {/* PM2.5 Trend */}
              <div className="mb-4">
                <h3 className="text-sm font-bold text-gray-900 mb-2">PM2.5 Trend (Weekly)</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={airQualityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#6B7280"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '2px solid #2563EB',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pm25" 
                      stroke="#2563EB" 
                      fill="#BFDBFE"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* VOC Trend */}
              <div>
                <h3 className="text-sm font-bold text-gray-900 mb-2">VOC Trend (Weekly)</h3>
                <ResponsiveContainer width="100%" height={150}>
                  <AreaChart data={airQualityData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                    <XAxis 
                      dataKey="day" 
                      stroke="#6B7280"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    />
                    <YAxis 
                      stroke="#6B7280"
                      style={{ fontSize: '11px', fontWeight: '600' }}
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#fff', 
                        border: '2px solid #10B981',
                        borderRadius: '12px',
                        fontSize: '12px',
                        fontWeight: '600'
                      }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="voc" 
                      stroke="#10B981" 
                      fill="#BBF7D0"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Dead Zone Insights */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                <h2 className="font-bold text-gray-900 text-lg">Dead Zone Insights</h2>
              </div>
              <p className="text-sm text-gray-600 mb-4">Low activity zones and possible blind spots</p>
              <div className="space-y-3">
                {deadZones.map((zone, index) => (
                  <div 
                    key={index} 
                    className="p-4 bg-orange-50 rounded-xl border-2 border-orange-200"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-gray-900">{zone.location}</span>
                      <span className={`text-xs font-bold px-3 py-1 rounded-full ${
                        zone.status === 'Blind Spot' 
                          ? 'bg-red-100 text-red-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {zone.status}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <span className="font-semibold">{zone.detections}</span> detection
                      {zone.detections !== 1 ? 's' : ''} this week
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

    </div>
  );
};


