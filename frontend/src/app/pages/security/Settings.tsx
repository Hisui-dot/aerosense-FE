import { useState, useEffect } from 'react';
import { Card } from '@/app/components/ui/card';
import { Switch } from '@/app/components/ui/switch';
import { Label } from '@/app/components/ui/label';
import { Input } from '@/app/components/ui/input';
import { Button } from '@/app/components/ui/button';
import { useAuth } from '@/app/context/AuthContext';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { Bell, Settings as SettingsIcon, Activity } from 'lucide-react';
import { settingsApi } from '@/app/services/api';

export const Settings = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  
  // Notifications Settings
  const [notifications, setNotifications] = useState(() => JSON.parse(localStorage.getItem('user_notifications') || 'true'));
  const [alertType, setAlertType] = useState<'critical' | 'all'>(() => (localStorage.getItem('user_alertType') as any) || 'all');
  
  // Detection Settings
  const [pm25Threshold, setPm25Threshold] = useState('50');
  const [vocThreshold, setVocThreshold] = useState('300');
  const [sensitivity, setSensitivity] = useState<'low' | 'normal' | 'high'>('normal');
  
  // Alert Behavior
  const [alertPrioritization, setAlertPrioritization] = useState(() => JSON.parse(localStorage.getItem('user_prioritization') || 'true'));

  useEffect(() => {
    const loadSettings = async () => {
      try {
        const data: any = await settingsApi.get();
        if (data.pm25Threshold) setPm25Threshold(String(data.pm25Threshold));
        if (data.vocThreshold) setVocThreshold(String(data.vocThreshold));
        if (data.sensitivityLevel) setSensitivity(data.sensitivityLevel as 'low' | 'normal' | 'high');
      } catch (error) {
        console.error('Failed to load settings', error);
      }
    };
    loadSettings();
  }, []);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      logout();
      navigate('/login');
    }
  };

  const handleSaveThresholds = async () => {
    try {
      await (settingsApi as any).save({
        pm25Threshold: Number(pm25Threshold),
        vocThreshold: Number(vocThreshold),
        sensitivityLevel: sensitivity
      });
      toast.success('Detection settings updated successfully');
    } catch (e) {
      toast.error('Failed to update detection settings');
    }
  };

  const handleNotificationToggle = (checked: boolean) => {
    setNotifications(checked);
    localStorage.setItem('user_notifications', JSON.stringify(checked));
    toast.success(checked ? 'Notifications enabled' : 'Notifications disabled');
  };

  const handleAlertTypeChange = (type: 'critical' | 'all') => {
    setAlertType(type);
    localStorage.setItem('user_alertType', type);
    toast.success(`Showing ${type === 'critical' ? 'critical alerts only' : 'all alerts'}`);
  };

  const handleSensitivityChange = async (level: 'low' | 'normal' | 'high') => {
    setSensitivity(level);
    try {
      await (settingsApi as any).save({ sensitivityLevel: level });
      toast.success(`Sensitivity set to ${level}`);
    } catch(e) {
      toast.error('Failed to update sensitivity');
    }
  };

  const handlePrioritizationToggle = (checked: boolean) => {
    setAlertPrioritization(checked);
    localStorage.setItem('user_prioritization', JSON.stringify(checked));
    toast.success(checked ? 'Alert prioritization enabled' : 'Alert prioritization disabled');
  };

  return (
    <div className="min-h-screen bg-[#82BCFE] pb-20">

      <div className="p-4 w-full mx-auto space-y-4">
        {/* Section 1: Notifications */}
        <Card className="p-6 bg-white shadow-lg rounded-2xl border-0">
          <div className="flex items-center gap-2 mb-4">
            <Bell className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Notifications</h2>
          </div>
          
          <div className="space-y-4">
            {/* Toggle Notifications */}
            <div className="flex items-center justify-between py-3 border-b border-gray-200">
              <Label htmlFor="notifications" className="cursor-pointer text-gray-900 font-semibold">
                Enable Notifications
              </Label>
              <Switch
                id="notifications"
                checked={notifications}
                onCheckedChange={handleNotificationToggle}
              />
            </div>

            {/* Alert Type Options */}
            <div>
              <div className="text-sm text-gray-600 font-semibold mb-3">Alert Type</div>
              <div className="space-y-2">
                <button
                  onClick={() => handleAlertTypeChange('critical')}
                  className={`w-full p-4 rounded-xl border-2 font-semibold text-left transition-all ${
                    alertType === 'critical'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Critical Alerts Only
                </button>
                <button
                  onClick={() => handleAlertTypeChange('all')}
                  className={`w-full p-4 rounded-xl border-2 font-semibold text-left transition-all ${
                    alertType === 'all'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  All Alerts
                </button>
              </div>
            </div>
          </div>
        </Card>

        {/* Section 2: Detection Settings */}
        <Card className="p-6 bg-white shadow-lg rounded-2xl border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <SettingsIcon className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Detection Settings</h2>
          </div>
          
          <div className="space-y-4">
            {/* PM2.5 Threshold */}
            <div>
              <Label htmlFor="pm25" className="text-gray-900 font-semibold">PM2.5 Threshold</Label>
              <div className="flex gap-2 items-center mt-2">
                <Input
                  id="pm25"
                  type="number"
                  value={pm25Threshold}
                  onChange={(e) => setPm25Threshold(e.target.value)}
                  className="flex-1 border-2 border-gray-300 rounded-xl"
                />
                <span className="text-sm text-gray-600 font-semibold w-16">µg/m³</span>
              </div>
            </div>

            {/* VOC Threshold */}
            <div>
              <Label htmlFor="voc" className="text-gray-900 font-semibold">VOC Threshold</Label>
              <div className="flex gap-2 items-center mt-2">
                <Input
                  id="voc"
                  type="number"
                  value={vocThreshold}
                  onChange={(e) => setVocThreshold(e.target.value)}
                  className="flex-1 border-2 border-gray-300 rounded-xl"
                />
                <span className="text-sm text-gray-600 font-semibold w-16">ppb</span>
              </div>
            </div>

            {/* Sensitivity Preset */}
            <div>
              <div className="text-sm text-gray-600 font-semibold mb-3">Sensitivity Preset</div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <button
                  onClick={() => handleSensitivityChange('low')}
                  className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                    sensitivity === 'low'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Low
                </button>
                <button
                  onClick={() => handleSensitivityChange('normal')}
                  className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                    sensitivity === 'normal'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  Normal
                </button>
                <button
                  onClick={() => handleSensitivityChange('high')}
                  className={`p-4 rounded-xl border-2 font-semibold transition-all ${
                    sensitivity === 'high'
                      ? 'border-blue-600 bg-blue-50 text-blue-900'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  High
                </button>
              </div>
            </div>

            <Button
              className="w-full bg-[#2665D0] hover:bg-[#1a4d9e] text-white font-bold rounded-xl shadow-md"
              onClick={handleSaveThresholds}
            >
              Save Detection Settings
            </Button>
          </div>
        </Card>

        {/* Section 3: Alert Behavior */}
        <Card className="p-6 bg-white shadow-lg rounded-2xl border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-blue-600" />
            <h2 className="font-bold text-gray-900 text-lg">Alert Behavior</h2>
          </div>
          
          <div className="flex items-center justify-between py-3">
            <div>
              <Label htmlFor="prioritization" className="cursor-pointer text-gray-900 font-semibold">
                Enable Alert Prioritization
              </Label>
              <p className="text-sm text-gray-600 mt-1">
                Automatically prioritize critical alerts
              </p>
            </div>
            <Switch
              id="prioritization"
              checked={alertPrioritization}
              onCheckedChange={handlePrioritizationToggle}
            />
          </div>
        </Card>

        {/* Admin: Sensor Management */}
        {user?.role === 'admin' && (
          <Card className="p-6 bg-white shadow-lg rounded-2xl border-0 hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
            <h2 className="font-bold mb-4 text-gray-900 text-lg">Sensor Management</h2>
            <div className="space-y-3">
              <Button
                variant="outline"
                className="w-full border-2 border-gray-300 text-gray-700 hover:bg-gray-50 font-bold rounded-xl"
                onClick={() => navigate('/admin/devices')}
              >
                Manage Sensors
              </Button>
            </div>
          </Card>
        )}

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-md"
          onClick={handleLogout}
        >
          Logout
        </Button>
      </div>

    </div>
  );
};

