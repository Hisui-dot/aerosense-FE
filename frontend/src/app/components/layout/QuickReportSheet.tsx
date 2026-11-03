import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { AlertCircle, Camera, Loader2, MapPin, RotateCcw, Send, ShieldCheck, X } from 'lucide-react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/app/components/ui/sheet';
import { useAuth } from '@/app/context/AuthContext';
import { alertsApi, assignmentsApi } from '@/app/services/api';

type Severity = 'low' | 'medium' | 'high';

interface QuickReportSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const SEVERITY_OPTIONS: { value: Severity; label: string; active: string }[] = [
  { value: 'low', label: 'Low', active: 'bg-yellow-500 text-white border-yellow-500' },
  { value: 'medium', label: 'Medium', active: 'bg-orange-500 text-white border-orange-500' },
  { value: 'high', label: 'High', active: 'bg-red-600 text-white border-red-600' },
];

/**
 * QuickReportSheet — the action behind the center button of the security bottom nav.
 * Lets an on-scene guard file a manual incident report (no sensor required) with a
 * real-time proof photo captured directly via camera, then routes them to the new alert.
 */
export const QuickReportSheet = ({ open, onOpenChange }: QuickReportSheetProps) => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [floor, setFloor] = useState('');
  const [location, setLocation] = useState('');
  const [severity, setSeverity] = useState<Severity>('medium');
  const [note, setNote] = useState('');
  const [capturedPhoto, setCapturedPhoto] = useState<string | null>(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isStartingCamera, setIsStartingCamera] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Stop camera tracks cleanly
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setIsCameraActive(false);
  };

  const startCamera = async () => {
    setCameraError('');
    setIsStartingCamera(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera is not supported or requires a secure context (HTTPS / localhost).');
      }
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
      }
      streamRef.current = stream;
      setIsCameraActive(true);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Camera access was denied.';
      setCameraError(msg || 'Unable to access camera. Please allow camera permissions.');
    } finally {
      setIsStartingCamera(false);
    }
  };

  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(console.error);
    }
  }, [isCameraActive]);

  // Clean up media stream when component unmounts or sheet closes
  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const v = videoRef.current;
    const c = canvasRef.current;
    c.width = v.videoWidth || 640;
    c.height = v.videoHeight || 480;
    const ctx = c.getContext('2d');
    if (ctx) {
      ctx.drawImage(v, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL('image/jpeg', 0.88);
      setCapturedPhoto(dataUrl);
    }
    stopCamera();
  };

  const handleRetake = () => {
    setCapturedPhoto(null);
    startCamera();
  };

  const handleRemovePhoto = () => {
    setCapturedPhoto(null);
    stopCamera();
  };

  // Prefill floor/location from the guard's own assignment when the sheet opens.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      try {
        const assignments = await assignmentsApi.getAll();
        const mine = assignments.find(
          (a) => user?.name && a.guardName?.toLowerCase() === user.name.toLowerCase()
        );
        if (!cancelled && mine) {
          setFloor((prev) => prev || mine.floor || '');
          setLocation((prev) => prev || (mine.zones && mine.zones[0]) || '');
        }
      } catch {
        // Prefill is best-effort; an empty form is still fine.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, user?.name]);

  const resetForm = () => {
    setFloor('');
    setLocation('');
    setSeverity('medium');
    setNote('');
    setCapturedPhoto(null);
    setCameraError('');
    stopCamera();
  };

  const handleClose = (next: boolean) => {
    if (submitting) return;
    if (!next) resetForm();
    onOpenChange(next);
  };

  const handleSubmit = async () => {
    if (!floor.trim() || !location.trim()) {
      toast.error('Please enter the floor and location.');
      return;
    }
    setSubmitting(true);
    try {
      const alert = await alertsApi.createManual({
        floor: floor.trim(),
        location: location.trim(),
        severity,
        note: note.trim() || undefined,
      });

      if (capturedPhoto) {
        try {
          const blob = await (await fetch(capturedPhoto)).blob();
          const file = new File([blob], `proof-${Date.now()}.jpg`, { type: 'image/jpeg' });
          await alertsApi.uploadPhoto(alert.id, file);
        } catch {
          toast.warning('Report filed, but the photo failed to upload.');
        }
      }

      toast.success('Incident reported.');
      resetForm();
      onOpenChange(false);
      navigate(`/alerts/${alert.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to file report';
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={handleClose}>
      <SheetContent
        side="bottom"
        className="rounded-t-3xl max-w-2xl mx-auto pb-[calc(16px+env(safe-area-inset-bottom))]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="text-[#0B1847] text-xl font-bold">Quick Report</SheetTitle>
          <SheetDescription>
            File an incident you witnessed in person — no sensor needed.
          </SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-2 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Floor</span>
              <input
                value={floor}
                onChange={(e) => setFloor(e.target.value)}
                placeholder="e.g. 2nd Floor"
                className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2665D0] focus:outline-none focus:ring-2 focus:ring-[#2665D0]/20"
              />
            </label>
            <label className="block">
              <span className="text-xs font-semibold text-gray-600">Location / Zone</span>
              <div className="relative mt-1">
                <MapPin className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Restroom"
                  className="w-full rounded-xl border border-gray-200 pl-8 pr-3 py-2.5 text-sm focus:border-[#2665D0] focus:outline-none focus:ring-2 focus:ring-[#2665D0]/20"
                />
              </div>
            </label>
          </div>

          <div>
            <span className="text-xs font-semibold text-gray-600">Severity</span>
            <div className="mt-1 grid grid-cols-3 gap-2">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setSeverity(opt.value)}
                  className={`rounded-xl border py-2.5 text-sm font-semibold transition-colors ${
                    severity === opt.value
                      ? opt.active
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <label className="block">
            <span className="text-xs font-semibold text-gray-600">Note (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="What did you observe?"
              className="mt-1 w-full resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-[#2665D0] focus:outline-none focus:ring-2 focus:ring-[#2665D0]/20"
            />
          </label>

          {/* Real-time Proof Photo Section */}
          <div>
            {capturedPhoto ? (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Proof photo (real-time only)</span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                    <ShieldCheck className="h-3 w-3" /> Live Capture
                  </span>
                </div>
                <div className="relative rounded-2xl border-2 border-emerald-500 overflow-hidden bg-black shadow-inner">
                  <img
                    src={capturedPhoto}
                    alt="Captured proof"
                    className="w-full object-cover max-h-[200px]"
                  />
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="absolute top-2 right-2 rounded-full bg-black/60 p-1.5 text-white hover:bg-black/80 transition-colors"
                    aria-label="Remove photo"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="h-3.5 w-3.5 text-[#2665D0]" />
                  Retake live photo
                </button>
              </div>
            ) : isCameraActive ? (
              <div className="space-y-1.5">
                <span className="text-xs font-semibold text-gray-600">Proof photo (real-time camera)</span>
                <div className="relative rounded-2xl border-2 border-[#2665D0] overflow-hidden bg-black shadow-inner">
                  <video
                    ref={videoRef}
                    playsInline
                    muted
                    autoPlay
                    className="w-full object-cover max-h-[220px] block"
                  />
                  {/* Viewfinder corner brackets */}
                  <div className="pointer-events-none absolute inset-0 p-3">
                    <div className="absolute top-3 left-3 h-5 w-5 border-t-2 border-l-2 border-white/70 rounded-tl-sm" />
                    <div className="absolute top-3 right-3 h-5 w-5 border-t-2 border-r-2 border-white/70 rounded-tr-sm" />
                    <div className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-white/70 rounded-bl-sm" />
                    <div className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-white/70 rounded-br-sm" />
                    <div className="absolute top-2.5 left-1/2 -translate-x-1/2 rounded-full bg-black/50 backdrop-blur-xs px-2 py-0.5 text-[10px] font-semibold text-white/90">
                      Live Camera
                    </div>
                  </div>
                </div>
                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCapture}
                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#0B1847] py-2.5 text-xs font-bold text-white hover:bg-[#16205c] transition-colors shadow-sm"
                  >
                    <Camera className="h-4 w-4" />
                    Capture Photo
                  </button>
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl border border-gray-200 px-3 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-gray-600">Proof photo (optional)</span>
                  <span className="text-[11px] text-gray-400">Real-time camera only</span>
                </div>
                {cameraError && (
                  <div className="mt-1.5 flex items-start gap-1.5 rounded-xl bg-red-50 p-2.5 text-xs text-red-700 border border-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-red-500" />
                    <span>{cameraError}</span>
                  </div>
                )}
                <button
                  type="button"
                  onClick={startCamera}
                  disabled={isStartingCamera}
                  className="mt-1.5 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:border-[#2665D0] hover:text-[#2665D0] hover:bg-blue-50/50 transition-colors disabled:opacity-60"
                >
                  {isStartingCamera ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin text-[#2665D0]" />
                      <span>Opening camera…</span>
                    </>
                  ) : (
                    <>
                      <Camera className="h-4 w-4 text-[#2665D0]" />
                      <span>Take live photo</span>
                    </>
                  )}
                </button>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#0B1847] py-3.5 text-base font-bold text-white shadow-lg transition-colors hover:bg-[#16205c] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                Filing report…
              </>
            ) : (
              <>
                <Send className="h-5 w-5" />
                File report
              </>
            )}
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
