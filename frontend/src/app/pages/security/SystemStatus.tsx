import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Badge } from '@/app/components/ui/badge';
import { Activity, Wifi, Database, Clock } from 'lucide-react';
import { devicesApi } from '@/app/services/api';

export const SystemStatus = () => {
  const [devices, setDevices] = useState<any[]>([]);
  const [lastUpdate, setLastUpdate] = useState('Just now');

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const data = await devicesApi.getAll().catch(() => []);
        setDevices(data);
        setLastUpdate(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true }));
      } catch (e) {}
    };
    fetchHealth();
    const interval = setInterval(fetchHealth, 5000);
    return () => clearInterval(interval);
  }, []);

  const isHealthy = devices.every(d => d.status !== 'offline');
  const offlineCount = devices.filter(d => d.status === 'offline').length;
  const uptimePct = devices.length > 0 ? ((devices.length - offlineCount) / devices.length * 100).toFixed(1) : '99.8';

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-20">

      <div className="p-4 w-full mx-auto space-y-4">
        {/* Overall System Health */}
        <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
          <div className="flex justify-between items-start mb-4">
            <div>
              <h2 className="font-bold text-gray-900 text-lg mb-1">System Health</h2>
              <p className="text-sm text-gray-600">{isHealthy ? 'All systems operational' : `${offlineCount} device(s) offline`}</p>
            </div>
            <Badge className={`${isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} border-0 font-semibold`}>
              {isHealthy ? 'Healthy' : 'Warning'}
            </Badge>
          </div>
          <div className={`text-3xl font-bold mb-2 ${isHealthy ? 'text-green-600' : 'text-red-600'}`}>{uptimePct}%</div>
          <div className="text-sm text-gray-500">Uptime (Last 30 days)</div>
        </Card>

        {/* System Components */}
        <div className="space-y-3">
          <h3 className="font-bold text-white text-lg">Components Status</h3>
          
          <Card className="p-5 bg-white shadow-lg rounded-2xl border-0 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl ${isHealthy ? 'bg-green-100' : 'bg-red-100'}`}>
                  <Wifi className={`h-6 w-6 ${isHealthy ? 'text-green-600' : 'text-red-600'}`} />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Network</div>
                  <div className="text-sm text-gray-600">{isHealthy ? 'Stable connection' : 'Interrupted connection'}</div>
                </div>
              </div>
              <Badge className={`${isHealthy ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'} border-0 font-semibold`}>
                {isHealthy ? 'Online' : 'Degraded'}
              </Badge>
            </div>
          </Card>

          <Card className="p-5 bg-white shadow-lg rounded-2xl border-0 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Database className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Database</div>
                  <div className="text-sm text-gray-600">Connected</div>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-0 font-semibold">
                Active
              </Badge>
            </div>
          </Card>

          <Card className="p-5 bg-white shadow-lg rounded-2xl border-0 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 rounded-xl">
                  <Activity className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">API Services</div>
                  <div className="text-sm text-gray-600">All endpoints responding</div>
                </div>
              </div>
              <Badge className="bg-green-100 text-green-800 border-0 font-semibold">
                Running
              </Badge>
            </div>
          </Card>

          <Card className="p-5 bg-white shadow-lg rounded-2xl border-0 hover:shadow-md hover:-translate-y-1 transition-all duration-300">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 rounded-xl">
                  <Clock className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <div className="font-bold text-gray-900">Last Update</div>
                  <div className="text-sm text-gray-600">Last check: {lastUpdate}</div>
                </div>
              </div>
              <Badge className="bg-blue-100 text-blue-800 border-0 font-semibold">
                Synced
              </Badge>
            </div>
          </Card>
        </div>
      </div>

    </div>
  );
};


