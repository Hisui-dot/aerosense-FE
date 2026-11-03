import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router';
import { motion } from 'motion/react';
import {
  ArrowLeft,
  MapPin,
  Clock,
  Activity,
  AlertCircle,
  User,
  ShieldCheck,
  RotateCcw,
  Camera,
  FileText,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { alertsApi, devicesApi, API_HOST } from '@/app/services/api';
import { useLiveStream } from '@/app/hooks/useLiveStream';
import { MOCK_HISTORY_DATA } from './Alerts';

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-slate-100 text-slate-700 border border-slate-200/80',
  medium: 'bg-slate-100 text-slate-600 border border-slate-200/80',
  low:    'bg-slate-50 text-slate-500 border border-slate-200/80',
};
const STATUS_COLORS: Record<string, string> = {
  new:          'bg-rose-50 text-rose-700 border border-rose-200/70',
  acknowledged: 'bg-amber-50 text-amber-700 border border-amber-200/70',
  responding:   'bg-blue-50 text-blue-700 border border-blue-200/70',
  resolved:     'bg-emerald-50 text-emerald-700 border border-emerald-200/70',
};

const PM25_SAFE = 35;
const VOC_SAFE  = 150;

function CameraCapture({
  capturedImage,
  onCapture,
  onRetake,
}: {
  capturedImage: string | null;
  onCapture: (dataUrl: string) => void;
  onRetake: () => void;
}) {
  const videoRef   = useRef<HTMLVideoElement>(null);
  const canvasRef  = useRef<HTMLCanvasElement>(null);
  const streamRef  = useRef<MediaStream | null>(null);
  const [isLive,     setIsLive]     = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [camError,   setCamError]   = useState('');

  const stopStream = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    setIsLive(false);
  };

  useEffect(() => () => { stopStream(); }, []);

  const startCamera = async () => {
    setCamError('');
    setIsStarting(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API is not supported in this browser (HTTPS might be required).');
      }
      const ms = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = ms;
      setIsLive(true);
    } catch (err: any) {
      try {
        const ms = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        streamRef.current = ms;
        setIsLive(true);
      } catch (fallbackErr) {
        console.error('Camera error:', fallbackErr);
        setCamError(err.message || 'Camera access was denied. Please allow camera permission and try again.');
      }
    }
    setIsStarting(false);
  };

  useEffect(() => {
    if (isLive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [isLive]);

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width  = v.videoWidth  || 640;
    c.height = v.videoHeight || 480;
    c.getContext('2d')?.drawImage(v, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.88);
    stopStream();
    onCapture(dataUrl);
  };

  const handleRetake = () => {
    onRetake();
    startCamera();
  };

  if (capturedImage) {
    return (
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Camera Verification
        </label>
        <div className="border border-emerald-200 rounded-xl overflow-hidden relative">
          <img src={capturedImage} alt="Captured evidence" className="w-full object-cover" style={{ maxHeight: '220px' }} />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-600/90 backdrop-blur-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
            <span className="text-white font-semibold text-[11px]">Photo Captured</span>
          </div>
        </div>
        <button type="button" onClick={handleRetake} className="mt-2.5 w-full flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-200 rounded-xl font-medium text-slate-700 hover:bg-slate-100 transition-all bg-slate-50 cursor-pointer">
          <RotateCcw className="h-4 w-4" />
          <span className="text-sm">Retake Photo</span>
        </button>
      </div>
    );
  }

  if (isLive) {
    return (
      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          Camera Verification
        </label>
        <div className="border border-slate-200 rounded-xl overflow-hidden bg-black relative">
          <video ref={videoRef} playsInline muted autoPlay className="w-full object-cover block" style={{ maxHeight: '220px' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ padding: '10px' }}>
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-white/60 rounded-tl-sm" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-white/60 rounded-tr-sm" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-white/60 rounded-bl-sm" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-white/60 rounded-br-sm" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <button type="button" onClick={capturePhoto} className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#071126] hover:bg-blue-900 text-white font-semibold py-3 rounded-xl shadow-xs transition-colors cursor-pointer">
          <Camera className="h-4 w-4" />
          <span className="text-sm">Capture Photo</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-slate-700 mb-2">
        Camera Verification
        <span className="ml-1.5 text-slate-400 font-semibold">*</span>
      </label>
      <div className="border border-slate-200 rounded-xl bg-slate-50 p-5 flex flex-col items-center gap-3">
        <div className="w-12 h-12 rounded-2xl bg-white border border-slate-200 flex items-center justify-center shadow-2xs">
          <Camera className="h-6 w-6 text-slate-700" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-slate-900 text-sm">Photo Evidence Required</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Take a live photo of the incident scene to validate this report
          </p>
        </div>
        {camError && <p className="text-xs font-medium text-rose-600 text-center px-2">{camError}</p>}
        <button type="button" onClick={startCamera} disabled={isStarting} className="w-full flex items-center justify-center gap-2 border border-slate-200 bg-white hover:bg-slate-100 text-slate-900 font-semibold py-2.5 rounded-xl transition-all disabled:opacity-50 cursor-pointer">
          {isStarting ? (
            <>
              <span className="w-4 h-4 border-2 border-slate-300 border-t-slate-900 rounded-full animate-spin" />
              <span className="text-sm">Starting camera…</span>
            </>
          ) : (
            <>
              <Camera className="h-4 w-4" />
              <span className="text-sm">Open Camera</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}

export const AlertDetails = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();

  const [alert, setAlert] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const [verificationResult, setVerificationResult] = useState('');
  const [actionTaken, setActionTaken] = useState('');
  const [notes, setNotes] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);

  const officerName = user?.name || user?.username
    ? 'Officer ' + (user.name || user.username).charAt(0).toUpperCase() + (user.name || user.username).slice(1)
    : 'Officer On Duty';

  const fetchAlert = async () => {
    if (!id) return;
    try {
      const alertsData = await alertsApi.getAll().catch(() => []);
      const a = alertsData.find((al: any) => al.id === id);
      if (a) {
        let deviceData: any = null;
        if (a.sensorId) {
          const devicesData = await devicesApi.getAll().catch(() => []);
          deviceData = devicesData.find((d: any) => d.id === a.sensorId);
        }

        let dateObj = a.createdAt ? new Date(a.createdAt) : new Date();
        if (isNaN(dateObj.getTime())) dateObj = new Date();

        const rawNotes = Array.isArray((a as any).notes)
          ? (a as any).notes
              .map((n: any) => (typeof n === 'string' ? n : n?.text))
              .filter(Boolean)
              .join(' — ')
          : typeof (a as any).notes === 'string'
          ? (a as any).notes
          : '';

        setAlert({
          id: a.id,
          location: a.floor || 'Unknown Floor',
          room: a.location || 'Unknown Room',
          timeDetected: a.detectedAt || dateObj.toLocaleString([], { hour: '2-digit', minute: '2-digit', hour12: true }),
          sensorId: a.sensorId || 'Unknown',
          status: a.status === 'ACTIVE' || a.status === 'REOPENED' ? 'new' : (a.status === 'RESPONDING' || a.status === 'ESCALATED') ? 'responding' : a.status === 'ACKNOWLEDGED' ? 'acknowledged' : 'resolved',
          pm25: a.pm25 ?? deviceData?.pm25 ?? 45,
          voc: a.voc ?? deviceData?.voc ?? 150,
          confidence: a.confidence ?? 95,
          type: a.type ?? 'Vaping Detected',
          priority: a.priority || 'high',
          assignedResponder: a.respondedBy || null,
          responderNotes: rawNotes || null,
          photoUrl: a.photoUrl || null,
        });
      } else {
        const mockItem = MOCK_HISTORY_DATA.find((m) => m.id === id);
        if (mockItem) {
          const pm25Match = mockItem.telemetrySummary.match(/PM2\.5:\s*(\d+)/);
          const vocMatch = mockItem.telemetrySummary.match(/VOC:\s*(\d+)/);
          const confMatch = mockItem.telemetrySummary.match(/Confidence:\s*(\d+)/);
          setAlert({
            id: mockItem.id,
            location: mockItem.floor,
            room: mockItem.room,
            timeDetected: mockItem.detectedAt,
            sensorId: mockItem.sensorId,
            status: mockItem.status === 'ACK' ? 'acknowledged' : 'resolved',
            pm25: pm25Match ? Number(pm25Match[1]) : 180,
            voc: vocMatch ? Number(vocMatch[1]) : 140,
            confidence: confMatch ? Number(confMatch[1]) : 92,
            type: mockItem.type,
            priority: 'high',
            assignedResponder: mockItem.responder,
            responderNotes: mockItem.notes || null,
            photoUrl: null,
          });
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlert();
  }, [id]);

  useLiveStream({ onAlert: () => { fetchAlert().catch(() => {}); } });

  const handleAcknowledge = async () => {
    if (!alert) return;
    try {
      // acknowledge() records the responder server-side and sets status ACKNOWLEDGED.
      const updated = await (alertsApi as any).acknowledge(alert.id);
      toast.success('Alert acknowledged');
      setAlert({ ...alert, status: 'acknowledged', assignedResponder: updated?.respondedBy || officerName });
    } catch (e) {
      toast.error('Failed to acknowledge');
    }
  };

  const handleResponding = async () => {
    if (!alert) return;
    try {
      const updated = await (alertsApi as any).respond(alert.id);
      setAlert({ ...alert, status: 'responding', assignedResponder: updated?.respondedBy || officerName });
      toast.success('Status updated to responding');
    } catch (e) {
      toast.error('Failed to update status');
    }
  };

  // P10 — undo a mistaken acknowledgment: returns the alert to active and clears the responder.
  const handleCancelAck = async () => {
    if (!alert) return;
    try {
      await (alertsApi as any).cancelAck(alert.id);
      setAlert({ ...alert, status: 'new', assignedResponder: null });
      toast.success('Acknowledgment cancelled — alert returned to active');
    } catch (e) {
      toast.error('Failed to cancel acknowledgment');
    }
  };

  const handleSubmitResolve = async () => {
    if (!alert || !verificationResult) {
      toast.error('Please select a verification result');
      return;
    }
    if (!capturedPhoto) {
      toast.error('A photo is required to verify the incident before resolving');
      return;
    }

    try {
      const resultStr = verificationResult === 'false_alarm' ? 'False Alarm'
                      : verificationResult === 'not_confirmed' ? 'Not Confirmed'
                      : verificationResult === 'escalated' ? 'Escalated'
                      : 'Confirmed';

      const formattedNote = `Result: ${resultStr} | Action Taken: ${actionTaken || 'None'} | Notes: ${notes || 'None'}`;

      if (capturedPhoto) {
        try {
          const blob = await (await fetch(capturedPhoto)).blob();
          const file = new File([blob], 'evidence.jpg', { type: 'image/jpeg' });
          await (alertsApi as any).uploadPhoto(alert.id, file);
        } catch (_uploadErr) {
          toast.warning('Alert resolved, but the evidence photo failed to upload — it was not saved.');
        }
      }

      if (verificationResult === 'false_alarm') {
        await (alertsApi as any).falseAlarm(alert.id);
      } else if (verificationResult === 'escalated') {
        await (alertsApi as any).escalate(alert.id);
      } else {
        await (alertsApi as any).resolve(alert.id);
      }

      if (notes || actionTaken) {
        await (alertsApi as any).addNote(alert.id, formattedNote);
      }

      setAlert({ ...alert, status: 'resolved', photoUrl: capturedPhoto });
      toast.success(verificationResult === 'escalated' ? 'Alert escalated successfully' : 'Alert resolved successfully');
      setTimeout(() => navigate('/'), 1500);
    } catch (e) {
      toast.error('Failed to process alert');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 flex items-center justify-center font-semibold text-slate-700">
        Loading details...
      </div>
    );
  }

  if (!alert) {
    return (
      <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 flex flex-col items-center justify-center gap-3">
        <p className="font-semibold text-slate-800">Alert not found.</p>
        <button
          type="button"
          onClick={() => navigate('/alerts')}
          className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 hover:bg-slate-200/60 px-3.5 py-2 rounded-xl text-sm font-medium transition-all cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          <span>Back to Response History</span>
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 sm:p-8 pb-28 lg:pb-10">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.75, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl mx-auto space-y-5"
      >
        {/* Clean Back Button */}
        <div>
          <button
            type="button"
            onClick={() => navigate('/alerts')}
            className="inline-flex items-center gap-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 px-3 py-1.5 -ml-3 rounded-xl text-sm font-medium transition-all cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Back to Response History</span>
          </button>
        </div>

        {/* ════════════════════════════════════════════════════
            ALERT DETAILS CARD
        ════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-4xl">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-center">
                <Activity className="h-5 w-5 text-slate-700" />
              </div>
              <div>
                <h1 className="font-bold text-slate-900 text-lg">Alert Details</h1>
                <p className="text-xs text-slate-500">
                  Full incident telemetry &amp; response log
                </p>
              </div>
            </div>

            <span className="inline-flex items-center bg-slate-100 text-slate-700 border border-slate-200/80 px-3 py-1 rounded-lg text-xs font-mono font-semibold">
              Alert ID: {alert.id}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Alert ID
              </div>
              <div className="font-mono text-slate-900 font-semibold text-sm">{alert.id}</div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Alert Type
              </div>
              <div className="text-slate-900 font-semibold text-sm">{alert.type}</div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Status &amp; Priority
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
                    STATUS_COLORS[alert.status] || STATUS_COLORS.resolved
                  }`}
                >
                  {alert.status}
                </span>
                <span
                  className={`inline-flex items-center text-[11px] font-semibold px-2.5 py-0.5 rounded-full uppercase tracking-wide ${
                    PRIORITY_COLORS[alert.priority] || PRIORITY_COLORS.high
                  }`}
                >
                  {alert.priority}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Location
              </div>
              <div className="font-semibold text-slate-900 text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-slate-400 shrink-0" />
                <span>
                  {alert.location} — {alert.room}
                </span>
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Sensor ID
              </div>
              <div className="font-semibold text-slate-900 text-sm">{alert.sensorId}</div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                Timestamp
              </div>
              <div className="font-semibold text-slate-900 text-sm">{alert.timeDetected}</div>
            </div>
          </div>

          {/* Full Telemetry Breakdown (PM2.5, VOC Level, AI Confidence) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                PM2.5
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {alert.pm25} <span className="text-sm font-medium text-slate-500">µg/m³</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                {alert.pm25 > PM25_SAFE ? 'Above standard threshold' : 'Within standard threshold'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                VOC Level
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {alert.voc} <span className="text-sm font-medium text-slate-500">ppb</span>
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                {alert.voc > VOC_SAFE ? 'Above standard threshold' : 'Within standard threshold'}
              </div>
            </div>

            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 text-center">
              <div className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                AI Confidence
              </div>
              <div className="text-2xl font-bold text-slate-900">
                {alert.confidence}%
              </div>
              <div className="mt-1.5 text-xs text-slate-500">
                Detection certainty
              </div>
            </div>
          </div>

          {/* Responder & Responder Notes */}
          <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-3">
            {alert.assignedResponder && (
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white border border-slate-200 rounded-full flex items-center justify-center shrink-0">
                  <User className="h-4 w-4 text-slate-600" />
                </div>
                <div>
                  <div className="text-xs text-slate-500 font-medium">
                    {alert.status === 'resolved' ? 'Resolved by' : 'Assigned Responder'}
                  </div>
                  <div className="text-sm font-semibold text-slate-900">
                    {alert.assignedResponder}
                  </div>
                </div>
              </div>
            )}

            <div className={alert.assignedResponder ? 'pt-3 border-t border-slate-200/70' : ''}>
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-500 uppercase tracking-wider mb-1">
                <FileText className="h-3.5 w-3.5 text-slate-400" />
                <span>Responder Notes</span>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">
                {alert.responderNotes || 'No responder notes recorded for this incident.'}
              </p>
            </div>
          </div>
        </div>

        {/* ════════════════════════════════════════════════════
            NEXT STEP PROGRESSION
        ════════════════════════════════════════════════════ */}
        {(alert.status === 'new' || alert.status === 'acknowledged') && (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-4xl">
            <h2 className="font-bold text-slate-900 text-base mb-4">Next Step</h2>
            <div className="flex gap-3">
              {alert.status === 'new' ? (
                <button
                  type="button"
                  onClick={handleAcknowledge}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-[#071126] text-white hover:bg-blue-900 cursor-pointer"
                >
                  <AlertCircle className="h-4 w-4" />
                  <span>Acknowledge Alert</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleResponding}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl font-semibold text-sm transition-all bg-[#071126] text-white hover:bg-blue-900 cursor-pointer"
                >
                  <Clock className="h-4 w-4" />
                  <span>Mark as Responding</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════════
            VERIFICATION FORM / EVIDENCE
        ════════════════════════════════════════════════════ */}
        {alert.status === 'resolved' ? (
          alert.photoUrl && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-4xl">
              <h2 className="font-bold text-slate-900 text-base mb-4">Evidence Photo</h2>
              <div className="rounded-xl overflow-hidden border border-slate-100 bg-slate-50 flex justify-center">
                <img
                  src={alert.photoUrl.startsWith('http') ? alert.photoUrl : API_HOST + alert.photoUrl}
                  alt="Alert Evidence"
                  className="max-h-[400px] w-auto object-contain"
                />
              </div>
            </div>
          )
        ) : (
          alert.status !== 'new' && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-6 max-w-4xl">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-bold text-slate-900 text-base">Verification Form</h2>
                <button
                  type="button"
                  onClick={handleCancelAck}
                  className="flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Cancel acknowledgment
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label
                    htmlFor="verificationResult"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Verification Result
                  </label>
                  <select
                    id="verificationResult"
                    name="verificationResult"
                    value={verificationResult}
                    onChange={(e) => setVerificationResult(e.target.value)}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-400 bg-slate-50 text-slate-900"
                  >
                    <option value="">Select result...</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="not_confirmed">Not confirmed</option>
                    <option value="false_alarm">False alarm</option>
                    <option value="escalated">Escalated</option>
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="actionTaken"
                    className="block text-sm font-semibold text-slate-700 mb-2"
                  >
                    Action Taken
                  </label>
                  <input
                    id="actionTaken"
                    name="actionTaken"
                    type="text"
                    value={actionTaken}
                    onChange={(e) => setActionTaken(e.target.value)}
                    placeholder="e.g., Student escorted to office"
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-400 bg-slate-50 text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                <div>
                  <label htmlFor="notes" className="block text-sm font-semibold text-slate-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    id="notes"
                    name="notes"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Brief description of what happened..."
                    rows={3}
                    className="w-full px-4 py-2.5 border border-slate-200 rounded-xl text-sm font-medium focus:outline-none focus:border-slate-400 bg-slate-50 text-slate-900 placeholder:text-slate-400 resize-none"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <div className="flex-1 h-px bg-slate-100" />
                  <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
                    Step 2 of 2
                  </span>
                  <div className="flex-1 h-px bg-slate-100" />
                </div>

                <CameraCapture
                  capturedImage={capturedPhoto}
                  onCapture={(url) => setCapturedPhoto(url)}
                  onRetake={() => setCapturedPhoto(null)}
                />

                <button
                  type="button"
                  onClick={handleSubmitResolve}
                  disabled={!capturedPhoto || !verificationResult}
                  className={`w-full font-semibold text-sm py-3 rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 ${
                    capturedPhoto && verificationResult
                      ? 'bg-[#071126] hover:bg-blue-900 text-white cursor-pointer'
                      : 'bg-slate-100 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  <ShieldCheck className="h-4 w-4" />
                  Submit &amp; {verificationResult === 'escalated' ? 'Escalate' : 'Resolve'} Alert
                </button>

                {(!capturedPhoto || !verificationResult) && (
                  <p className="text-center text-xs text-slate-400 -mt-1">
                    {!verificationResult
                      ? 'Select a verification result to continue'
                      : 'Capture a photo above to enable submission'}
                  </p>
                )}
              </div>
            </div>
          )
        )}
      </motion.div>
    </div>
  );
};




