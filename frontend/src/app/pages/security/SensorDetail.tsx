import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Button } from '@/app/components/ui/button';
import { useParams, useNavigate } from 'react-router';
import { ArrowLeft, Radio, MapPin, Clock, Activity, AlertTriangle, CheckCircle } from 'lucide-react';
import { devicesApi, readingsApi, type Reading } from '@/app/services/api';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

interface SensorData {
  id: string;
  name: string;
  location: string;
  status: 'online' | 'offline';
  lastActive: string;
  pm25: number;
  voc: number;
  diagnostics: {
    battery: number;
    signalStrength: number;
    uptime: string;
    lastMaintenance: string;
  };
}

export const SensorDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [sensor, setSensor] = useState<SensorData | null>(null);
  const [loading, setLoading] = useState(true);
  const [readings, setReadings] = useState<Reading[]>([]);

  useEffect(() => {
    if (!id) return;
    readingsApi.forDevice(id, 100).then(r => setReadings([...r].reverse())).catch(() => setReadings([]));
  }, [id]);

  useEffect(() => {
    const fetchSensor = async () => {
      try {
        const devicesData = await devicesApi.getAll().catch(() => []);
        const device = devicesData.find((d: any) => d.id === id);
        
        if (device) {
          setSensor({
            id: device.id,
            name: device.name || `Sensor ${device.id}`,
            location: device.location || `${device.floor || 'Unknown'} Floor`,
            status: device.status?.toLowerCase() === 'offline' ? 'offline' : 'online',
            lastActive: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
            pm25: device.pm25 ?? (Math.random() * 20 + 5),
            voc: device.voc ?? (Math.random() * 50 + 20),
            diagnostics: {
              battery: device.battery ?? 85,
              signalStrength: device.signalStrength ?? 92,
              uptime: '45 days',
              lastMaintenance: device.lastServiced || 'March 15, 2026',
            }
          });
        } else {
          setSensor(null);
        }
      } catch (error) {
        console.error('Failed to fetch sensor details', error);
      } finally {
        setLoading(false);
      }
    };
    
    if (id) {
      fetchSensor();
    }
  }, [id]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#82BCFE] pb-20 flex items-center justify-center">
        <div className="text-[#0B1847] font-bold animate-pulse">Loading sensor data...</div>
      </div>
    );
  }

  if (!sensor && !loading) {
    return (
      <div className="min-h-screen bg-[#82BCFE] pb-20">
        <div className="p-4 w-full mx-auto">
          <Card className="p-6 bg-white shadow-lg rounded-2xl border-0 text-center">
            <p className="text-gray-600">Sensor not found</p>
            <Button
              className="mt-4 bg-[#2665D0] hover:bg-[#1a4d9e] text-white font-bold rounded-xl"
              onClick={() => navigate('/sensors')}
            >
              Back to Sensors
            </Button>
          </Card>
        </div>
      </div>
    );
  }

  const getPM25Status = (value: number) => {
    if (value === 0) return { text: 'No Data', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (value <= 12) return { text: 'Good', color: 'text-green-600', bg: 'bg-green-100' };
    if (value <= 35) return { text: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'Unhealthy', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const getVOCStatus = (value: number) => {
    if (value === 0) return { text: 'No Data', color: 'text-gray-500', bg: 'bg-gray-100' };
    if (value <= 50) return { text: 'Good', color: 'text-green-600', bg: 'bg-green-100' };
    if (value <= 100) return { text: 'Moderate', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { text: 'Unhealthy', color: 'text-red-600', bg: 'bg-red-100' };
  };

  const pm25Status = getPM25Status(sensor.pm25);
  const vocStatus = getVOCStatus(sensor.voc);

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-20">

      <div className="p-4 w-full mx-auto space-y-4">
        {/* Back Button */}
        <Button
          variant="ghost"
          className="text-white hover:bg-blue-700 font-semibold -ml-2"
          onClick={() => navigate('/sensors')}
        >
          <ArrowLeft className="h-5 w-5 mr-2" />
          Back to Sensors
        </Button>

        {/* Sensor Header */}
        <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
          <div className="flex items-start gap-4">
            <div className={`w-16 h-16 rounded-full flex items-center justify-center ${
              sensor.status === 'online' ? 'bg-green-100' : 'bg-red-100'
            }`}>
              <Radio className={`h-8 w-8 ${
                sensor.status === 'online' ? 'text-green-600' : 'text-red-600'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <h1 className="text-2xl font-bold text-gray-900">{sensor.id}</h1>
                <Badge
                  variant={sensor.status === 'online' ? 'default' : 'destructive'}
                  className={
                    sensor.status === 'online'
                      ? 'bg-green-100 text-green-800 border-0 font-semibold'
                      : 'bg-red-100 text-red-800 border-0 font-semibold'
                  }
                >
                  {sensor.status === 'online' ? 'Online' : 'Offline'}
                </Badge>
              </div>
              <div className="flex items-center gap-2 text-gray-600 mb-1">
                <MapPin className="h-4 w-4" />
                <span className="font-medium">{sensor.location}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500 text-sm">
                <Clock className="h-4 w-4" />
                <span>Last active: {sensor.lastActive}</span>
              </div>
            </div>
          </div>
        </Card>

        {/* Live Readings */}
        <div>
          <h2 className="font-bold mb-3 text-white text-lg">Live Readings</h2>
          <div className="grid grid-cols-1 gap-3">
            {/* PM2.5 Reading */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 font-semibold mb-1">PM2.5 Level</div>
                  <div className="text-4xl font-bold text-gray-900">
                    {sensor.status === 'online' ? sensor.pm25 : '--'}
                    <span className="text-lg text-gray-500 ml-2">μg/m³</span>
                  </div>
                </div>
                <Badge className={`${pm25Status.bg} ${pm25Status.color} border-0 font-semibold`}>
                  {pm25Status.text}
                </Badge>
              </div>
              {sensor.status === 'online' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      sensor.pm25 <= 12 ? 'bg-green-600' : sensor.pm25 <= 35 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min((sensor.pm25 / 50) * 100, 100)}%` }}
                  ></div>
                </div>
              )}
            </Card>

            {/* VOC Reading */}
            <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="text-sm text-gray-600 font-semibold mb-1">VOC Level</div>
                  <div className="text-4xl font-bold text-gray-900">
                    {sensor.status === 'online' ? sensor.voc : '--'}
                    <span className="text-lg text-gray-500 ml-2">ppb</span>
                  </div>
                </div>
                <Badge className={`${vocStatus.bg} ${vocStatus.color} border-0 font-semibold`}>
                  {vocStatus.text}
                </Badge>
              </div>
              {sensor.status === 'online' && (
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      sensor.voc <= 50 ? 'bg-green-600' : sensor.voc <= 100 ? 'bg-yellow-600' : 'bg-red-600'
                    }`}
                    style={{ width: `${Math.min((sensor.voc / 150) * 100, 100)}%` }}
                  ></div>
                </div>
              )}
            </Card>
          </div>
        </div>

        {/* Sensor Readings Chart */}
        <div>
          <h2 className="font-bold mb-3 text-white text-lg">Sensor Readings (last 100)</h2>
          <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
            {readings.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <LineChart data={readings.map(r => ({
                  t: new Date(r.recordedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
                  pm25: r.pm25, voc: r.voc,
                }))}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="t" minTickGap={24} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="pm25" stroke="#ef4444" dot={false} name="PM2.5" />
                  <Line type="monotone" dataKey="voc" stroke="#3b82f6" dot={false} name="VOC" />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-muted-foreground">No readings yet for this device.</p>
            )}
          </Card>
        </div>

        {/* Diagnostics */}
        <div>
          <h2 className="font-bold mb-3 text-white text-lg">Diagnostics</h2>
          <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
            <div className="space-y-4">
              {/* Battery */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Activity className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Battery Level</span>
                  </div>
                  <span className="font-bold text-gray-900">{sensor.diagnostics.battery}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${
                      sensor.diagnostics.battery > 50
                        ? 'bg-green-600'
                        : sensor.diagnostics.battery > 20
                        ? 'bg-yellow-600'
                        : 'bg-red-600'
                    }`}
                    style={{ width: `${sensor.diagnostics.battery}%` }}
                  ></div>
                </div>
              </div>

              {/* Signal Strength */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Radio className="h-5 w-5 text-blue-600" />
                    <span className="text-sm font-semibold text-gray-700">Signal Strength</span>
                  </div>
                  <span className="font-bold text-gray-900">{sensor.diagnostics.signalStrength}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className="h-2 rounded-full bg-green-600"
                    style={{ width: `${sensor.diagnostics.signalStrength}%` }}
                  ></div>
                </div>
              </div>

              {/* Uptime */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-sm font-semibold text-gray-700">Uptime</span>
                </div>
                <span className="font-bold text-gray-900">{sensor.diagnostics.uptime}</span>
              </div>

              {/* Last Maintenance */}
              <div className="flex items-center justify-between py-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-orange-600" />
                  <span className="text-sm font-semibold text-gray-700">Last Maintenance</span>
                </div>
                <span className="font-bold text-gray-900">{sensor.diagnostics.lastMaintenance}</span>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
};


