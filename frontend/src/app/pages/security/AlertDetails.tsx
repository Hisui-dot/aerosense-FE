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

const PRIORITY_COLORS: Record<string, string> = {
  high:   'bg-red-100 text-red-700',
  medium: 'bg-orange-100 text-orange-700',
  low:    'bg-yellow-100 text-yellow-700',
};
const STATUS_COLORS: Record<string, string> = {
  new:          'bg-red-100 text-red-700',
  acknowledged: 'bg-amber-100 text-amber-700',
  responding:   'bg-blue-100 text-blue-700',
  resolved:     'bg-green-100 text-green-700',
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
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          Camera Verification
        </label>
        <div className="border-2 border-green-400 rounded-xl overflow-hidden relative">
          <img src={capturedImage} alt="Captured evidence" className="w-full object-cover" style={{ maxHeight: '220px' }} />
          <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 px-2.5 py-1 rounded-full" style={{ background: 'rgba(22,163,74,0.90)', backdropFilter: 'blur(4px)' }}>
            <ShieldCheck className="h-3.5 w-3.5 text-white" />
            <span className="text-white font-bold" style={{ fontSize: '11px' }}>Photo Captured</span>
          </div>
        </div>
        <button type="button" onClick={handleRetake} className="mt-2.5 w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-gray-200 rounded-xl font-semibold text-gray-600 hover:border-[#2665D0] hover:text-[#2665D0] transition-all bg-[#EEF2FE]">
          <RotateCcw className="h-4 w-4" />
          <span className="text-sm">Retake Photo</span>
        </button>
      </div>
    );
  }

  if (isLive) {
    return (
      <div>
        <label className="block text-sm font-semibold text-gray-600 mb-2">
          Camera Verification
        </label>
        <div className="border-2 border-[#2665D0] rounded-xl overflow-hidden bg-black relative">
          <video ref={videoRef} playsInline muted autoPlay className="w-full object-cover block" style={{ maxHeight: '220px' }} />
          <div className="absolute inset-0 pointer-events-none" style={{ padding: '10px' }}>
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-white/60 rounded-tl-sm" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-white/60 rounded-tr-sm" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-white/60 rounded-bl-sm" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-white/60 rounded-br-sm" />
          </div>
        </div>
        <canvas ref={canvasRef} className="hidden" />
        <button type="button" onClick={capturePhoto} className="mt-2.5 w-full flex items-center justify-center gap-2 bg-[#0B1847] hover:bg-[#162366] text-white font-bold py-3 rounded-xl shadow-sm transition-colors">
          <Camera className="h-4 w-4" />
          <span className="text-sm">Capture Photo</span>
        </button>
      </div>
    );
  }

  return (
    <div>
      <label className="block text-sm font-semibold text-gray-600 mb-2">
        Camera Verification
        <span className="ml-1.5 text-red-500 font-bold">*</span>
      </label>
      <div className="border-2 border-gray-200 rounded-xl bg-[#EEF2FE] p-5 flex flex-col items-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-white border-2 border-gray-200 flex items-center justify-center shadow-sm">
          <Camera className="h-7 w-7 text-[#2665D0]" />
        </div>
        <div className="text-center">
          <p className="font-semibold text-[#0B1847] text-sm">Photo Evidence Required</p>
          <p className="text-xs text-gray-400 mt-0.5">
            Take a live photo of the incident scene to validate this report
          </p>
        </div>
        {camError && <p className="text-xs font-semibold text-red-600 text-center px-2">{camError}</p>}
        <button type="button" onClick={startCamera} disabled={isStarting} className="w-full flex items-center justify-center gap-2 border-2 border-[#0B1847] bg-white hover:bg-[#EEF2FE] text-[#0B1847] font-bold py-3 rounded-xl transition-all disabled:opacity-50">
          {isStarting ? (
            <>
              <span className="w-4 h-4 border-2 border-[#0B1847]/30 border-t-[#0B1847] rounded-full animate-spin" />
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
          photoUrl: a.photoUrl || null,
        });
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
    return <div className="min-h-screen bg-[#EEF2FE] pb-24 flex items-center justify-center font-bold text-[#0B1847]">Loading details...</div>;
  }

  if (!alert) {
    return <div className="min-h-screen bg-[#EEF2FE] pb-24 flex items-center justify-center font-bold text-[#0B1847]">Alert not found.</div>;
  }

  return (
    <div className="min-h-screen bg-[#EEF2FE] pb-24">
      {/* Top Bar */}
      <div className="bg-[#0B1847] sticky top-0 z-30 shadow-lg" style={{ height: '64px' }}>
        <div className="flex items-center gap-3 h-full px-5 max-w-3xl mx-auto">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-xl hover:bg-white/10 text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-bold text-white">Alert Details</h1>
            <p className="text-blue-300 text-xs">Sensor {alert.sensorId}</p>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(2px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ duration: 0.75, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-3xl mx-auto px-4 pt-5 space-y-5"
      >
        {/* ════════════════════════════════════════════════════
            ALERT DETAILS CARD
        ════════════════════════════════════════════════════ */}
        <div className="bg-white rounded-2xl shadow-sm p-5 border border-[#2665D0]/20">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-[#0B1847] rounded-xl flex items-center justify-center">
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="font-bold text-[#0B1847] text-lg">Alert Details</h2>
              <p className="text-xs text-gray-500">Sensor data &amp; incident info</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-[#EEF2FE] rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Alert Type</div>
              <div className="font-bold text-[#0B1847] text-sm">{alert.type}</div>
            </div>
            <div className="bg-[#EEF2FE] rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Priority</div>
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full uppercase ${PRIORITY_COLORS[alert.priority]}`}>
                {alert.priority}
              </span>
            </div>
            <div className="bg-[#EEF2FE] rounded-xl p-3 col-span-2">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Location</div>
              <div className="font-bold text-[#0B1847] text-sm flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#2665D0]" />
                {alert.location} — {alert.room}
              </div>
            </div>
            <div className="bg-[#EEF2FE] rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Time Detected</div>
              <div className="font-bold text-[#0B1847] text-sm">{alert.timeDetected}</div>
            </div>
            <div className="bg-[#EEF2FE] rounded-xl p-3">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">Status</div>
              <span className={`inline-block text-xs font-bold px-2 py-0.5 rounded-full uppercase ${STATUS_COLORS[alert.status]}`}>
                {alert.status}
              </span>
            </div>
          </div>

          {/* Sensor Readings */}
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="bg-red-50 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">PM2.5</div>
              <div className="text-3xl font-bold text-red-600">{alert.pm25}</div>
              <div className="text-xs text-gray-500 mt-0.5">µg/m³</div>
              <div className="mt-2 text-xs text-red-500 font-semibold">
                {alert.pm25 > PM25_SAFE ? '▲ Above safe limit' : '✓ Within limit'}
              </div>
            </div>
            <div className="bg-orange-50 rounded-xl p-4 text-center">
              <div className="text-xs font-semibold text-gray-500 uppercase mb-1">VOC Level</div>
              <div className="text-3xl font-bold text-orange-600">{alert.voc}</div>
              <div className="text-xs text-gray-500 mt-0.5">ppb</div>
              <div className="mt-2 text-xs text-orange-500 font-semibold">
                {alert.voc > VOC_SAFE ? '▲ Above safe limit' : '✓ Within limit'}
              </div>
            </div>
          </div>

          {alert.assignedResponder && (
            <div className="flex items-center gap-3 bg-blue-50 rounded-xl px-4 py-3">
              <div className="w-8 h-8 bg-[#2665D0] rounded-full flex items-center justify-center">
                <User className="h-4 w-4 text-white" />
              </div>
              <div>
                <div className="text-xs text-blue-600 font-semibold">
                  {alert.status === 'resolved' ? 'Resolved by' : 'Acknowledged by'}
                </div>
                <div className="text-sm font-bold text-[#0B1847]">{alert.assignedResponder}</div>
              </div>
            </div>
          )}

        </div>

        {/* ════════════════════════════════════════════════════
            NEXT STEP PROGRESSION
        ════════════════════════════════════════════════════ */}
        {(alert.status === 'new' || alert.status === 'acknowledged') && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <h2 className="font-bold text-[#0B1847] text-lg mb-4">Next Step</h2>
            <div className="flex gap-3">
              {alert.status === 'new' ? (
                <button
                  onClick={handleAcknowledge}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold transition-all border-2 border-[#0B1847] bg-[#EEF2FE] text-[#0B1847] hover:bg-[#dde4f9]"
                >
                  <AlertCircle className="h-5 w-5" />
                  <span>Acknowledge Alert</span>
                </button>
              ) : (
                <button
                  onClick={handleResponding}
                  className="w-full flex items-center justify-center gap-2 p-4 rounded-xl font-bold transition-all border-2 border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100"
                >
                  <Clock className="h-5 w-5" />
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
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <h2 className="font-bold text-[#0B1847] text-lg mb-4">Evidence Photo</h2>
              <div className="rounded-xl overflow-hidden border-2 border-gray-200 bg-gray-50 flex justify-center">
                <img src={alert.photoUrl.startsWith('http') ? alert.photoUrl : API_HOST + alert.photoUrl} alt="Alert Evidence" className="max-h-[400px] w-auto object-contain" />
              </div>
            </div>
          )
        ) : alert.status !== 'new' && (
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-bold text-[#0B1847] text-lg">Verification Form</h2>
              <button
                type="button"
                onClick={handleCancelAck}
                className="flex items-center gap-1.5 text-sm font-semibold text-gray-500 hover:text-red-600 transition-colors"
              >
                <RotateCcw className="h-4 w-4" />
                Cancel acknowledgment
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label htmlFor="verificationResult" className="block text-sm font-semibold text-gray-600 mb-2">
                  Verification Result
                </label>
                <select
                  id="verificationResult"
                  name="verificationResult"
                  value={verificationResult}
                  onChange={e => setVerificationResult(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#2665D0] bg-[#EEF2FE] text-[#0B1847]"
                >
                  <option value="">Select result...</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="not_confirmed">Not confirmed</option>
                  <option value="false_alarm">False alarm</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>

              <div>
                <label htmlFor="actionTaken" className="block text-sm font-semibold text-gray-600 mb-2">
                  Action Taken
                </label>
                <input
                  id="actionTaken"
                  name="actionTaken"
                  type="text"
                  value={actionTaken}
                  onChange={e => setActionTaken(e.target.value)}
                  placeholder="e.g., Student escorted to office"
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#2665D0] bg-[#EEF2FE] text-[#0B1847] placeholder:text-gray-400"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-semibold text-gray-600 mb-2">Notes</label>
                <textarea
                  id="notes"
                  name="notes"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  placeholder="Brief description of what happened..."
                  rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl font-medium focus:outline-none focus:border-[#2665D0] bg-[#EEF2FE] text-[#0B1847] placeholder:text-gray-400 resize-none"
                />
              </div>

              <div className="flex items-center gap-3">
                <div className="flex-1 h-px bg-gray-100" />
                <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Step 2 of 2
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>

              <CameraCapture
                capturedImage={capturedPhoto}
                onCapture={url => setCapturedPhoto(url)}
                onRetake={() => setCapturedPhoto(null)}
              />

              <button
                onClick={handleSubmitResolve}
                disabled={!capturedPhoto || !verificationResult}
                className={`w-full font-bold py-3 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-2 ${
                  capturedPhoto && verificationResult
                    ? 'bg-[#2665D0] hover:bg-[#1a4d9e] text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
              >
                <ShieldCheck className="h-4 w-4" />
                Submit &amp; {verificationResult === 'escalated' ? 'Escalate' : 'Resolve'} Alert
              </button>

              {(!capturedPhoto || !verificationResult) && (
                <p className="text-center text-xs text-gray-400 -mt-1">
                  {!verificationResult
                    ? 'Select a verification result to continue'
                    : 'Capture a photo above to enable submission'}
                </p>
              )}
            </div>
          </div>
        )}

      </motion.div>
    </div>
  );
};




