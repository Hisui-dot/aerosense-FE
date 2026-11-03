const BASE = import.meta.env.VITE_API_URL || '/api';
export const API_HOST = BASE === '/api' ? '' : BASE.replace('/api', '');

function getToken() {
  return localStorage.getItem('token');
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    let errMsg = 'Request failed';
    try {
      const err = await res.json();
      errMsg = err.message || errMsg;
    } catch (e) {
      errMsg = `Server Error: ${res.status} (Check terminal or restart backend)`;
    }
    throw new Error(errMsg);
  }

  return res.json() as Promise<T>;
}

async function upload(path: string, formData: FormData): Promise<unknown> {
  const token = getToken();
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, { method: 'POST', headers, body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: 'Upload failed' }));
    throw new Error(err.message || 'Upload failed');
  }
  return res.json();
}

export const api = {
  get:    <T>(path: string)              => request<T>('GET',    path),
  post:   <T>(path: string, body?: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body?: unknown) => request<T>('PUT',    path, body),
  delete: <T>(path: string)              => request<T>('DELETE', path),
  upload,
};

// ---- Auth ----
export type UserRole = 'security' | 'supervisor' | 'admin';
export type UserStatus = 'active' | 'suspended' | 'deactivated';
export interface AuthUser { id: string; username: string; role: UserRole; name: string; email?: string; }
export interface AuthResponse { token: string; user: AuthUser; }
export interface SignupInput { username: string; password: string; email: string; name?: string; role?: string; }
// Signup is registration only — the server does NOT return a token (no auto-login).
export interface SignupResponse { message: string; user: AuthUser; }

export const authApi = {
  login:  (username: string, password: string) => api.post<AuthResponse>('/auth/login',  { username, password }),
  signup: (data: SignupInput) => api.post<SignupResponse>('/auth/signup', data),
  me:     () => api.get<AuthUser>('/auth/me'),
};

// ---- Alerts ----
export interface Alert {
  id: string; floor: string; location: string; detectedAt: string;
  sensorId: string;
  status: 'ACTIVE' | 'ACKNOWLEDGED' | 'RESPONDING' | 'ESCALATED' | 'RESOLVED' | 'FALSE_ALARM' | 'REOPENED';
  respondedBy: string | null; resolvedAt: string | null; photoUrl: string | null; createdAt: string;
  // sensor snapshot recorded on auto-generated alerts (backend columns)
  pm25?: number | null; voc?: number | null; deviceId?: string | null; source?: string;
  // optional display/synthetic fields used by dashboard view-mapping
  confidence?: number; priority?: string; type?: string; notes?: unknown;
}

export interface ManualReportInput {
  floor: string;
  location: string;
  severity?: 'low' | 'medium' | 'high';
  note?: string;
}

export const alertsApi = {
  getAll:      () => api.get<Alert[]>('/alerts'),
  getById:     (id: string) => api.get<Alert>(`/alerts/${id}`),
  createManual: (data: ManualReportInput) => api.post<Alert>('/alerts', { ...data, source: 'manual' }),
  resolve:     (id: string) => api.put<Alert>(`/alerts/${id}/resolve`),
  falseAlarm:  (id: string) => api.put<Alert>(`/alerts/${id}/false-alarm`),
  acknowledge:  (id: string) => api.put<Alert>(`/alerts/${id}/acknowledge`),
  respond:      (id: string) => api.put<Alert>(`/alerts/${id}/respond`),
  cancelAck:    (id: string) => api.put<Alert>(`/alerts/${id}/cancel-acknowledge`),
  escalate:     (id: string) => api.put<Alert>(`/alerts/${id}/escalate`),
  reopen:       (id: string) => api.put<Alert>(`/alerts/${id}/reopen`),
  assign:      (id: string, assignedTo: string) => api.put<Alert>(`/alerts/${id}/assign`, { assignedTo }),
  addNote:     (id: string, note: string) => api.post<Alert>(`/alerts/${id}/notes`, { note }),
  uploadPhoto: (id: string, file: File) => {
    const fd = new FormData(); fd.append('photo', file);
    return api.upload(`/alerts/${id}/photo`, fd);
  },
};

// ---- Sensors ----
export interface Sensor {
  id: string; name: string; floor: string; location: string; battery: number;
  status: 'online' | 'offline' | 'maintenance'; sensorHealth: number;
  lastServiced: string; replaceIn: string; nextService: string; notes: string | null;
}

export const sensorsApi = {
  getAll:      () => api.get<Sensor[]>('/sensors'),
  submitMaint: (id: string) => api.post(`/sensors/${id}/maintenance`),
};

// ---- Assignments ----
export interface Assignment {
  id: string; floor: string; zones: string[]; guardName: string; badge: string;
  shift: 'Morning' | 'Afternoon' | 'Night'; status: 'on-duty' | 'off-duty' | 'break'; contact: string;
}

export const assignmentsApi = {
  getAll:  () => api.get<Assignment[]>('/assignments'),
  update:  (id: string, data: Partial<Assignment>) => api.put<Assignment>(`/assignments/${id}`, data),
};

// ---- Devices ----
export interface Device {
  id: string; name: string; location: string; floor: string; status: 'online' | 'offline' | 'warning';
  pm25: number; voc: number; temperature: number | null; humidity: number | null;
  lastUpdate: string; lastSeen: string; responseTime: string; signalStrength: number;
  battery: number; firmware: string; powerStatus: string; networkSignal: string; issue: string | null;
  apiKey?: string; pm25Threshold?: number | null; vocThreshold?: number | null; updatedAt?: string;
  events?: DeviceEvent[];
}

export interface DeviceEvent { id: string; type: string; title: string; timestamp: string; severity: string; }

export const devicesApi = {
  getAll:       () => api.get<Device[]>('/devices'),
  getById:      (id: string) => api.get<Device>(`/devices/${id}`),
  restart:      (id: string) => api.post(`/devices/${id}/restart`),
  disable:      (id: string) => api.post(`/devices/${id}/disable`),
  recalibrate:  (id: string) => api.post(`/devices/${id}/recalibrate`),
  update:       (id: string, data: Partial<Device>) => api.put<Device>(`/devices/${id}`, data),
  create:       (data: { name: string; location?: string; floor?: string; pm25Threshold?: number; vocThreshold?: number }) =>
                  api.post<Device & { apiKey: string }>('/devices', data),
  rotateKey:    (id: string) => api.post<{ id: string; apiKey: string }>(`/devices/${id}/rotate-key`),
  delete:       (id: string) => api.delete(`/devices/${id}`),
};

// ---- Readings (time series) ----
export interface Reading {
  id: string; deviceId: string; pm25: number; voc: number;
  temperature: number | null; humidity: number | null; recordedAt: string; createdAt: string;
}

export const readingsApi = {
  forDevice: (id: string, limit = 100) => api.get<Reading[]>(`/devices/${id}/readings?limit=${limit}`),
};

// ---- Users ----
export interface UserRecord {
  id: string; username: string; role: UserRole; name: string; email: string;
  badge: string; contact: string; status: UserStatus; createdAt: string;
}

export const usersApi = {
  getAll:  () => api.get<UserRecord[]>('/users'),
  getById: (id: string) => api.get<UserRecord>(`/users/${id}`),
  create:  (data: Partial<UserRecord> & { password: string }) => api.post<UserRecord>('/users', data),
  update:  (id: string, data: Partial<UserRecord & { password: string }>) => api.put<UserRecord>(`/users/${id}`, data),
  remove:  (id: string) => api.delete(`/users/${id}`),
};

// ---- Logs ----
export interface LogEntry {
  id: string; type: string; title: string; description: string; timestamp: string;
  status: string; location: string | null; deviceId: string | null; user: string | null;
  severity: string; metadata: Record<string, unknown>;
}

export interface LogsResponse {
  logs: LogEntry[];
  total: number;
}

export const logsApi = {
  getAll: (params?: { type?: string; severity?: string; search?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams(params as any).toString();
    return api.get<LogsResponse>(`/logs${qs ? `?${qs}` : ''}`);
  },
  clear: () => api.delete('/logs'),
};

// ---- Settings ----
export const settingsApi = {
  get:  () => api.get<Record<string, unknown>>('/settings'),
  save: (data: Record<string, unknown>) => api.put<Record<string, unknown>>('/settings', data),
};

// ---- Analytics ----
export interface WeeklyPoint { id: number; day: string; date: number; count: number; }

export interface AnalyticsSummary {
  alerts: { total: number; confirmed: number; falseAlarms: number; active: number };
  devices: { total: number; online: number; offline: number; warning: number; avgSignal: number };
  sensors: { total: number; online: number; needAttention: number };
  // performance.* are hardcoded server-side placeholders — do not surface as real metrics
  performance: { uptime: string; accuracy: string; responseTime: string; falsePositiveRate: string };
}

export interface HighRiskArea { location: string; incidents: number; percentage: number; }
export interface PeakTimePeriod { time: string; incidents: number; }
export interface DevicePerformance { id: string; detections: number; offlineEvents: number; avgResponse: string; }
export interface UserActivity { name: string; handled: number; avgAck: string; resolved: number; }

export interface AnalyticsReports {
  summary: {
    totalDetections: number; confirmedIncidents: number; falseAlarms: number;
    avgResponseTime: string; successRate: string; period: string;
  };
  detectionTrend: { id: number; day: string; count: number }[];
  highRiskAreas: HighRiskArea[];
  peakTimePeriods: PeakTimePeriod[];
  devicePerformance: DevicePerformance[];
  userActivity: UserActivity[];
  airQuality: { avgPm25: number; avgVoc: number };
}

export interface QosSummaryMetric { label: string; value: string; }
export interface QosActiveIssue {
  id: string; location: string; severity: string; issue: string;
  lastSeen: string; canResolve: boolean; canInvestigate: boolean;
}
export interface QosPerfPoint { id: number; time: string; response: number; }

export interface AnalyticsQos {
  systemStatus: { status: string; devicesOnline: number; totalDevices: number; avgResponse: string; uptime: string };
  summaryMetrics: QosSummaryMetric[];
  activeIssues: QosActiveIssue[];
  performanceData: QosPerfPoint[];
  recentEvents: { time: string; event: string; severity: string }[];
}

export const analyticsApi = {
  summary: () => api.get<AnalyticsSummary>('/analytics/summary'),
  weekly:  () => api.get<WeeklyPoint[]>('/analytics/weekly'),
  reports: () => api.get<AnalyticsReports>('/analytics/reports'),
  qos:     () => api.get<AnalyticsQos>('/analytics/qos'),
};

// ---- Live stream (SSE) ----
export interface StreamHandlers {
  onReading?: (r: Reading) => void;
  onAlert?: (a: Alert) => void;
  onError?: (e: Event) => void;
}

export const streamApi = {
  subscribe(handlers: StreamHandlers): () => void {
    const token = getToken();
    if (!token) return () => {};
    const es = new EventSource(`${BASE}/stream?token=${encodeURIComponent(token)}`);
    const onReading = handlers.onReading;
    const onAlert = handlers.onAlert;
    if (handlers.onError) es.onerror = handlers.onError;
    const parse = (e: Event): unknown => {
      try { return JSON.parse((e as MessageEvent).data); }
      catch { return null; }
    };
    if (onReading) es.addEventListener('reading', (e) => { const d = parse(e); if (d) onReading(d as Reading); });
    if (onAlert) es.addEventListener('alert', (e) => { const d = parse(e); if (d) onAlert(d as Alert); });
    return () => es.close();
  },
};







