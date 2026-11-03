import React, { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router';
import { User, Lock, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { AeroSenseLogo } from '@/app/components/layout/AeroSenseLogo';

type AnimStage = 'splash-init' | 'splash-in' | 'splash-out' | 'sliding' | 'ready' | 'switching';

const SPLASH_STORAGE_KEY = 'hasSeenSplash';

export const Login = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [remember, setRemember] = useState(false);

  // Only play the splash screen once per browser session
  const [stage, setStage] = useState<AnimStage>(() => {
    try {
      return sessionStorage.getItem(SPLASH_STORAGE_KEY) ? 'sliding' : 'splash-init';
    } catch {
      return 'splash-init';
    }
  });
  const [panelsEntered, setPanelsEntered] = useState(false);

  const navigate = useNavigate();
  const { login, user, loading } = useAuth();

  useEffect(() => {
    let hasSeen = false;
    try {
      hasSeen = Boolean(sessionStorage.getItem(SPLASH_STORAGE_KEY));
    } catch {
      hasSeen = false;
    }

    if (hasSeen) {
      // Skip splash: immediately trigger smooth panel slide-in and staggered content reveal
      const raf = requestAnimationFrame(() => {
        setPanelsEntered(true);
      });
      const readyTimer = setTimeout(() => {
        setStage('ready');
      }, 520);

      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(readyTimer);
      };
    }

    // First visit: run 3-step splash -> panel slide -> staggered reveal sequence
    try {
      sessionStorage.setItem(SPLASH_STORAGE_KEY, 'true');
    } catch {
      // ignore storage errors
    }

    const t1 = requestAnimationFrame(() => {
      setStage('splash-in');
    });

    const t2 = setTimeout(() => {
      setStage('splash-out');
    }, 850);

    const t3 = setTimeout(() => {
      setStage('sliding');
      requestAnimationFrame(() => {
        setPanelsEntered(true);
      });
    }, 1150);

    const t4 = setTimeout(() => {
      setStage('ready');
    }, 1850);

    return () => {
      cancelAnimationFrame(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, []);

  if (!loading && user) {
    return <Navigate to={user.role === 'admin' ? '/admin' : '/'} replace />;
  }

  const handleSwitchToSignup = (e: React.MouseEvent) => {
    e.preventDefault();
    if (stage === 'switching') return;
    setStage('switching');
    setPanelsEntered(false);
    setTimeout(() => {
      navigate('/signup');
    }, 420);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      return toast.error('Please enter both username and password');
    }

    setIsLoading(true);

    try {
      const result = await login(username, password);
      if (result.ok && result.user) {
        toast.success(`Welcome, ${result.user.name || result.user.username}!`);
        setTimeout(() => { navigate(result.user.role === 'admin' ? '/admin' : '/'); }, 100);
        try {
          let perm = window.Notification.permission;
          if (perm !== 'granted') perm = await window.Notification.requestPermission();
          if (perm === 'granted' && navigator.serviceWorker) {
            const reg = await navigator.serviceWorker.ready;
            let sub = await reg.pushManager.getSubscription();
            if (!sub) {
              const vapidRes = await fetch('https://aerosense-u67m.onrender.com/api/push/vapid-public-key');
              const vapidKey = await vapidRes.text();
              const padding = '='.repeat((4 - vapidKey.length % 4) % 4);
              const base64 = (vapidKey + padding).replace(/\-/g, '+').replace(/_/g, '/');
              const rawData = window.atob(base64);
              const outputArray = new Uint8Array(rawData.length);
              for (let i = 0; i < rawData.length; ++i) { outputArray[i] = rawData.charCodeAt(i); }
              sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: outputArray });
            }
            await fetch('https://aerosense-u67m.onrender.com/api/push/subscribe', {
              method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + localStorage.getItem('token') }, body: JSON.stringify(sub)
            });
          }
        } catch (e) { console.error('Push fail', e); }
      } else {
        const msg = result?.message?.toLowerCase() || '';
        if (msg.includes('not active') || msg.includes('deactivated')) {
          toast.error('Account has been deactivated. Please proceed to OSA for reactivation.');
        } else {
          toast.error(result.message || 'Invalid username or password');
        }
      }
    } catch (error: any) {
      const msg = error?.message?.toLowerCase() || '';
      if (msg.includes('not active') || msg.includes('deactivated')) {
        toast.error('Account has been deactivated. Please proceed to OSA for reactivation.');
      } else {
        toast.error(error?.message || 'Cannot connect to the server.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isSplashVisible = stage === 'splash-init' || stage === 'splash-in' || stage === 'splash-out';
  const arePanelsDocked = panelsEntered && stage !== 'switching';
  const isContentVisible = stage === 'ready';

  return (
    <div className="relative w-screen h-[100dvh] overflow-hidden flex flex-col lg:flex-row bg-[#050c1a] font-sans select-none lg:select-auto">
      
      {/* =====================================================================
          STEP 1: ONE-TIME FULL-SCREEN SPLASH INTRO OVERLAY (~1.2s)
      ===================================================================== */}
      {isSplashVisible && (
        <div
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gradient-to-br from-[#050c1a] via-[#071126] to-[#0b1835] transition-opacity duration-300 ease-out ${
            stage === 'splash-out' ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Subtle Ambient Glow behind Splash Logo */}
          <div className="absolute w-72 h-72 rounded-full bg-sky-500/20 blur-3xl pointer-events-none" />

          <div
            className={`relative flex flex-col items-center text-center transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
              stage === 'splash-init'
                ? 'scale-75 opacity-0 translate-y-4'
                : stage === 'splash-in'
                ? 'scale-100 opacity-100 translate-y-0'
                : 'scale-110 opacity-0 -translate-y-2'
            }`}
          >
            <AeroSenseLogo
              iconSize={92}
              showText={false}
              className="mb-3 drop-shadow-[0_10px_28px_rgba(56,189,248,0.35)]"
            />
            <span className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white">
              Aero<span className="bg-[linear-gradient(to_right,#00b6bd,#03a3d9,#38bdf8)] bg-clip-text text-transparent">Sense</span>
            </span>
            <span className="text-xs uppercase tracking-[0.25em] text-sky-400/90 font-semibold mt-2">
              Intelligent Environments
            </span>
          </div>
        </div>
      )}

      {/* =====================================================================
          STEP 2 & 3: DARK NAVY BRANDING PANEL (Top on Mobile, Right on Desktop)
      ===================================================================== */}
      <div
        className={`relative order-1 lg:order-2 w-full h-[25dvh] sm:h-[28dvh] lg:h-full lg:w-[54%] bg-gradient-to-br from-[#071126] via-[#0b1835] to-[#060d1f] text-white flex items-center justify-center lg:flex-col lg:items-start lg:justify-between px-6 pb-4 lg:py-14 lg:pl-28 lg:pr-16 xl:pl-36 xl:pr-24 shrink-0 z-20 lg:z-30 transition-transform duration-650 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          arePanelsDocked
            ? 'translate-y-0 lg:translate-x-0'
            : 'max-lg:-translate-y-full lg:translate-x-full'
        }`}
      >
        {/* Ambient Radial Glows & Subtle Tech Grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[280px] sm:w-[360px] lg:w-[480px] h-[280px] sm:h-[360px] lg:h-[480px] rounded-full bg-[#003882] blur-3xl opacity-35" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[180px] lg:w-[280px] h-[180px] lg:h-[280px] rounded-full bg-sky-500 blur-3xl opacity-15" />
          <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:44px_44px]" />
        </div>

        {/* Desktop Curved Blade SVG Divider (Attached to Left Edge of Dark Panel) */}
        <svg
          className="hidden lg:block absolute top-0 -left-24 xl:-left-32 h-full w-24 xl:w-32 pointer-events-none z-20"
          viewBox="0 0 120 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Subtle Translucent Secondary Curve for Depth */}
          <path
            d="M120,0 L22,0 C95,240 -5,540 75,800 L120,800 Z"
            fill="rgba(56, 189, 248, 0.12)"
          />
          {/* Main Dark Adamson Navy Blade Curve */}
          <path
            d="M120,0 L40,0 C115,240 15,540 95,800 L120,800 Z"
            fill="#071126"
          />
        </svg>

        {/* Mobile Centered Logo (< lg) & Desktop Top-Aligned Brand Header (lg+) */}
        <div
          className={`relative z-20 flex flex-col items-center justify-center text-center lg:flex-row lg:items-center lg:justify-start lg:text-left lg:gap-4 transition-all duration-500 ease-out delay-[40ms] ${
            isContentVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
          }`}
        >
          <AeroSenseLogo
            iconSize={76}
            showText={false}
            className="mb-2 sm:mb-3 lg:mb-0 drop-shadow-[0_10px_28px_rgba(56,189,248,0.28)] transition-transform"
          />
          <div className="flex flex-col items-center lg:items-start">
            <span className="text-3xl sm:text-4xl lg:text-4xl font-extrabold tracking-tight text-white leading-none">
              Aero<span className="bg-[linear-gradient(to_right,#00b6bd,#03a3d9,#38bdf8)] bg-clip-text text-transparent">Sense</span>
            </span>
            <span className="text-[10px] sm:text-xs uppercase tracking-[0.25em] text-sky-400/90 font-semibold mt-1.5">
              Intelligent Environments
            </span>
          </div>
        </div>

        {/* Desktop Bottom Subtle Telemetry Anchor Line */}
        <div
          className={`hidden lg:flex relative z-20 items-center gap-3 text-xs font-medium text-slate-400/80 transition-all duration-500 ease-out delay-[140ms] ${
            isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="w-8 h-[2px] rounded-full bg-sky-400/60" />
          <span>Adamson Security &amp; Telemetry Network</span>
        </div>
      </div>

      {/* =====================================================================
          STEP 2 & 3: WHITE FORM PANEL (Bottom on Mobile, Left on Desktop)
      ===================================================================== */}
      <div
        className={`relative order-2 lg:order-1 flex-1 lg:w-[46%] h-[75dvh] sm:h-[72dvh] lg:h-full flex flex-col justify-center items-center px-6 sm:px-12 lg:px-16 xl:px-24 bg-[#F7F9FC] text-slate-900 z-30 lg:z-20 transition-transform duration-650 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          arePanelsDocked
            ? 'translate-y-0 lg:translate-x-0'
            : 'max-lg:translate-y-full lg:-translate-x-full'
        }`}
      >
        {/* Mobile Curved Blade SVG Divider (Attached to Top Edge of Light Panel) */}
        <svg
          className="lg:hidden absolute -top-9 sm:-top-11 left-0 w-full h-9 sm:h-11 text-[#F7F9FC] pointer-events-none z-20"
          viewBox="0 0 800 90"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,25 C260,95 540,-15 800,45 L800,90 L0,90 Z"
            fill="rgba(56, 189, 248, 0.12)"
          />
          <path
            d="M0,40 C260,105 540,0 800,58 L800,90 L0,90 Z"
            fill="currentColor"
          />
        </svg>

        <div className="w-full max-w-[360px] sm:max-w-[380px] mx-auto flex flex-col justify-center">
          
          {/* Form Heading: "Welcome back." + Subtitle + Accent Bar (Stagger 1) */}
          <div
            className={`mb-4 sm:mb-6 lg:mb-7 transition-all duration-500 ease-out delay-[100ms] ${
              isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#071126] leading-tight">
              Welcome back<span className="text-sky-500">.</span>
            </h1>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-1">
              Advanced IoT Detection System — Sign in to continue
            </p>
            <div className="w-10 h-1 rounded-full bg-[#0b1835] mt-2.5 sm:mt-3" />
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4 lg:space-y-4.5">
            
            {/* Username Input (Stagger 2) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[160ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type="text"
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pl-11 sm:pl-12 pr-4 py-2.5 sm:py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
                required
              />
            </div>

            {/* Password Input (Stagger 3) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[220ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="current-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-11 sm:pl-12 pr-11 py-2.5 sm:py-3.5 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(v => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#0b1835] transition-colors cursor-pointer"
              >
                {showPassword ? <EyeOff className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> : <Eye className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
              </button>
            </div>

            {/* Keep me signed in & Forgot password (Stagger 4) */}
            <div
              className={`flex items-center justify-between px-1 pt-0.5 text-xs sm:text-sm transition-all duration-500 ease-out delay-[280ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-[#0b1835] focus:ring-[#0b1835] bg-white cursor-pointer"
                />
                <span className="font-medium text-slate-600 group-hover:text-slate-900 transition-colors">
                  Keep me signed in
                </span>
              </label>
              <a
                href="#forgot-password"
                onClick={(e) => {
                  e.preventDefault();
                  toast.info('Please contact your system administrator to reset your credentials.');
                }}
                className="font-semibold text-[#0b1835] hover:text-sky-600 transition-colors"
              >
                Forgot password?
              </a>
            </div>

            {/* Primary Submit Button (Stagger 5) */}
            <div
              className={`transition-all duration-500 ease-out delay-[340ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 sm:py-3.5 px-6 rounded-full bg-gradient-to-r from-[#071126] via-[#0b1835] to-[#10234d] hover:from-[#0b1835] hover:via-[#10234d] hover:to-[#17326b] text-white font-semibold text-sm sm:text-base tracking-wide shadow-lg shadow-[#071126]/25 hover:shadow-xl hover:shadow-[#071126]/35 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Sign in</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Divider + Google Login Button (Stagger 6) */}
          <div
            className={`transition-all duration-500 ease-out delay-[400ms] ${
              isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <div className="relative my-3 sm:my-4.5 flex items-center justify-center">
              <div className="border-t border-slate-200 w-full" />
              <span className="bg-[#F7F9FC] px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                or
              </span>
            </div>

            <button
              type="button"
              onClick={() => toast.info('Google SSO is managed by your organization.')}
              className="w-full py-2.5 sm:py-3 px-5 rounded-full bg-white hover:bg-slate-50 border border-slate-200/90 text-slate-700 font-semibold text-xs sm:text-sm shadow-xs hover:shadow-sm active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                <path
                  fill="#EA4335"
                  d="M12 5c1.6 0 3 .6 4.1 1.7l3.1-3.1C17.3 1.8 14.8 1 12 1 7.4 1 3.5 3.6 1.6 7.4l3.7 2.8C6.2 7.2 8.9 5 12 5z"
                />
                <path
                  fill="#4285F4"
                  d="M23.5 12.3c0-.8-.1-1.6-.2-2.3H12v4.5h6.5c-.3 1.5-1.1 2.8-2.4 3.6l3.7 2.9c2.2-2 3.7-5 3.7-8.7z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.3 14.8c-.2-.8-.4-1.6-.4-2.5s.2-1.7.4-2.5L1.6 7C.6 9 0 11.2 0 13.5s.6 4.5 1.6 6.5l3.7-2.9c-.1-.8 0-1.5 0-2.3z"
                />
                <path
                  fill="#34A853"
                  d="M12 24c3.2 0 6-1.1 8-3l-3.7-2.9c-1.1.7-2.5 1.2-4.3 1.2-3.1 0-5.8-2.1-6.7-5l-3.7 2.9C3.5 21.4 7.4 24 12 24z"
                />
              </svg>
              <span>Continue with Google</span>
            </button>
          </div>

          {/* Footer Prompt (Stagger 7) */}
          <p
            className={`mt-4 sm:mt-5 text-center text-xs sm:text-sm font-medium text-slate-500 transition-all duration-500 ease-out delay-[460ms] ${
              isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            New to AeroSense?{' '}
            <Link
              to="/signup"
              onClick={handleSwitchToSignup}
              className="text-[#0b1835] font-bold hover:text-sky-600 hover:underline transition-colors"
            >
              Create an account
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
};
