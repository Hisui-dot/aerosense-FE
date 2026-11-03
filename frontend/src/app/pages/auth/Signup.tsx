import React, { useState, useEffect } from 'react';
import { useNavigate, Link, Navigate } from 'react-router';
import { User, Lock, Mail, AtSign, ArrowRight, Loader2, Eye, EyeOff } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/app/context/AuthContext';
import { AeroSenseLogo } from '@/app/components/layout/AeroSenseLogo';

type AnimStage = 'splash-init' | 'splash-in' | 'splash-out' | 'sliding' | 'ready' | 'switching';

const SPLASH_STORAGE_KEY = 'hasSeenSplash';

export const Signup = () => {
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

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
  const { signup, user, loading } = useAuth();

  useEffect(() => {
    let hasSeen = false;
    try {
      hasSeen = Boolean(sessionStorage.getItem(SPLASH_STORAGE_KEY));
    } catch {
      hasSeen = false;
    }

    if (hasSeen) {
      // Skip splash: immediately slide panels into their inverted positions and reveal form
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

    // First visit directly on /signup: run splash once then save flag
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

  const handleSwitchToLogin = (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    if (stage === 'switching') return;
    setStage('switching');
    setPanelsEntered(false);
    setTimeout(() => {
      navigate('/login');
    }, 420);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      return toast.error('Username and password are required');
    }
    if (!email) {
      return toast.error('Email is required');
    }
    if (password.length < 6) {
      return toast.error('Password must be at least 6 characters');
    }
    if (password !== confirmPassword) {
      return toast.error('Passwords do not match');
    }

    setIsLoading(true);
    try {
      const result = await signup({ username, password, email, name, role: 'security' });
      if (result.ok) {
        // Registration does not log the user in — send them to sign in.
        toast.success('Account created! Please sign in.');
        handleSwitchToLogin();
      } else {
        toast.error(result.message || 'Could not create account');
      }
    } catch (error: any) {
      toast.error(error?.message || 'Cannot connect to the server.');
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
          DARK NAVY HERO PANEL (Top on Mobile, LEFT on Desktop — Inverted!)
      ===================================================================== */}
      <div
        className={`relative order-1 lg:order-1 w-full h-[21dvh] sm:h-[24dvh] lg:h-full lg:w-[50%] bg-gradient-to-br from-[#071126] via-[#0b1835] to-[#060d1f] text-white flex flex-col justify-center lg:justify-between items-center lg:items-start px-6 pb-3 lg:py-14 lg:pl-16 lg:pr-24 xl:pl-24 xl:pr-32 shrink-0 z-20 lg:z-30 transition-transform duration-650 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          arePanelsDocked
            ? 'translate-y-0 lg:translate-x-0'
            : 'max-lg:-translate-y-full lg:-translate-x-full'
        }`}
      >
        {/* Ambient Radial Glows & Subtle Tech Grid */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <div className="absolute top-[25%] left-[20%] w-[280px] sm:w-[360px] lg:w-[460px] h-[280px] sm:h-[360px] lg:h-[460px] rounded-full bg-[#003882] blur-3xl opacity-35" />
          <div className="absolute bottom-[18%] right-[20%] w-[180px] lg:w-[280px] h-[180px] lg:h-[280px] rounded-full bg-sky-500 blur-3xl opacity-15" />
          <div className="absolute inset-0 opacity-[0.035] bg-[linear-gradient(rgba(255,255,255,1)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,1)_1px,transparent_1px)] bg-[size:44px_44px]" />
        </div>

        {/* Desktop Curved Blade SVG Divider (Attached to RIGHT Edge of Dark Panel) */}
        <svg
          className="hidden lg:block absolute top-0 -right-24 xl:-right-32 h-full w-24 xl:w-32 pointer-events-none z-20"
          viewBox="0 0 120 800"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          {/* Subtle Translucent Secondary Curve for Depth */}
          <path
            d="M0,0 L98,0 C25,240 125,540 45,800 L0,800 Z"
            fill="rgba(56, 189, 248, 0.12)"
          />
          {/* Main Dark Adamson Navy Blade Curve */}
          <path
            d="M0,0 L80,0 C5,240 105,540 25,800 L0,800 Z"
            fill="#071126"
          />
        </svg>

        {/* Top AeroSense Brand Header */}
        <div
          className={`relative z-20 flex items-center gap-3 lg:gap-4 transition-all duration-500 ease-out delay-[40ms] ${
            isContentVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-2 scale-95'
          }`}
        >
          <AeroSenseLogo
            iconSize={56}
            showText={false}
            className="drop-shadow-[0_10px_28px_rgba(56,189,248,0.28)] lg:scale-115 transition-transform"
          />
          <div className="flex flex-col items-start">
            <span className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-none">
              Aero<span className="bg-[linear-gradient(to_right,#00b6bd,#03a3d9,#38bdf8)] bg-clip-text text-transparent">Sense</span>
            </span>
            <span className="text-[9px] sm:text-xs uppercase tracking-[0.25em] text-sky-400/90 font-semibold mt-1">
              Intelligent Environments
            </span>
          </div>
        </div>

        {/* Desktop Hero Headline & Subtitle */}
        <div
          className={`hidden lg:block relative z-20 max-w-md my-auto transition-all duration-500 ease-out delay-[110ms] ${
            isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <h1 className="text-4xl xl:text-5xl font-extrabold tracking-tight text-white leading-[1.12] mb-4">
            Join the <br />Security Network<span className="text-sky-400">.</span>
          </h1>
          <p className="text-base xl:text-lg font-medium text-slate-300/85 leading-relaxed">
            Create your security officer account to start monitoring facilities in real-time.
          </p>
        </div>

        {/* Desktop Bottom Subtle Telemetry Anchor Line */}
        <div
          className={`hidden lg:flex relative z-20 items-center gap-3 text-xs font-medium text-slate-400/80 transition-all duration-500 ease-out delay-[170ms] ${
            isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
          }`}
        >
          <span className="w-8 h-[2px] rounded-full bg-sky-400/60" />
          <span>Adamson Security &amp; Telemetry Network</span>
        </div>
      </div>

      {/* =====================================================================
          WHITE CREATE ACCOUNT FORM PANEL (Bottom on Mobile, RIGHT on Desktop)
      ===================================================================== */}
      <div
        className={`relative order-2 lg:order-2 flex-1 lg:w-[50%] h-[79dvh] sm:h-[76dvh] lg:h-full flex flex-col justify-center items-center px-6 sm:px-12 lg:pl-20 lg:pr-16 xl:pl-28 xl:pr-24 bg-[#F7F9FC] text-slate-900 z-30 lg:z-20 transition-transform duration-650 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${
          arePanelsDocked
            ? 'translate-y-0 lg:translate-x-0'
            : 'max-lg:translate-y-full lg:translate-x-full'
        }`}
      >
        {/* Mobile Curved Blade SVG Divider (Attached to Top Edge of Light Panel) */}
        <svg
          className="lg:hidden absolute -top-8 sm:-top-10 left-0 w-full h-8 sm:h-10 text-[#F7F9FC] pointer-events-none z-20"
          viewBox="0 0 800 90"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <path
            d="M0,45 C260,-15 540,95 800,25 L800,90 L0,90 Z"
            fill="rgba(56, 189, 248, 0.12)"
          />
          <path
            d="M0,58 C260,0 540,105 800,40 L800,90 L0,90 Z"
            fill="currentColor"
          />
        </svg>

        <div className="w-full max-w-[360px] sm:max-w-[390px] mx-auto flex flex-col justify-center">
          
          {/* Form Heading: "Create account" + Subtitle + Accent Bar (Stagger 1) */}
          <div
            className={`mb-3 sm:mb-5 lg:mb-6 transition-all duration-500 ease-out delay-[100ms] ${
              isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#071126] leading-tight">
              Create account<span className="text-sky-500">.</span>
            </h2>
            <p className="text-xs sm:text-sm font-medium text-slate-500 mt-0.5 sm:mt-1">
              Fill in your details to get started
            </p>
            <div className="w-10 h-1 rounded-full bg-[#0b1835] mt-2 sm:mt-2.5" />
          </div>

          {/* Sign Up Form */}
          <form onSubmit={handleSubmit} className="space-y-2.5 sm:space-y-3 lg:space-y-3.5">
            
            {/* Full Name (Stagger 2) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[150ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <User className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type="text"
                id="name"
                name="name"
                autoComplete="name"
                placeholder="Full name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={50}
                className="w-full pl-11 pr-4 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
              />
            </div>

            {/* Username (Stagger 3) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[200ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <AtSign className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type="text"
                id="username"
                name="username"
                autoComplete="username"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                maxLength={20}
                minLength={3}
                className="w-full pl-11 pr-4 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
                required
              />
            </div>

            {/* Email Address (Stagger 4) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[250ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Mail className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type="email"
                id="email"
                name="email"
                autoComplete="email"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={100}
                className="w-full pl-11 pr-4 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
                required
              />
            </div>

            {/* Password (Stagger 5) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[300ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type={showPassword ? 'text' : 'password'}
                id="password"
                name="password"
                autoComplete="new-password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={100}
                minLength={6}
                className="w-full pl-11 pr-11 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
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

            {/* Confirm Password (Stagger 6) */}
            <div
              className={`relative group transition-all duration-500 ease-out delay-[350ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Lock className="h-4 w-4 sm:h-4.5 sm:w-4.5 text-slate-400 group-focus-within:text-[#0b1835] transition-colors" />
              </div>
              <input
                type={showConfirm ? 'text' : 'password'}
                id="confirmPassword"
                name="confirmPassword"
                autoComplete="new-password"
                placeholder="Confirm password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full pl-11 pr-11 py-2 sm:py-2.5 lg:py-3 bg-white border border-slate-200/90 rounded-2xl text-slate-900 text-sm font-medium placeholder:text-slate-400 shadow-[0_2px_10px_rgba(15,23,42,0.03)] focus:outline-none focus:border-[#0b1835] focus:ring-2 focus:ring-[#0b1835]/10 transition-all duration-200"
                required
              />
              <button
                type="button"
                onClick={() => setShowConfirm(v => !v)}
                aria-label={showConfirm ? 'Hide confirm password' : 'Show confirm password'}
                className="absolute inset-y-0 right-0 pr-4 flex items-center text-slate-400 hover:text-[#0b1835] transition-colors cursor-pointer"
              >
                {showConfirm ? <EyeOff className="h-4 w-4 sm:h-4.5 sm:w-4.5" /> : <Eye className="h-4 w-4 sm:h-4.5 sm:w-4.5" />}
              </button>
            </div>

            {/* Submit Button (Stagger 7) */}
            <div
              className={`pt-1 transition-all duration-500 ease-out delay-[400ms] ${
                isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
              }`}
            >
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 sm:py-3.5 px-6 rounded-full bg-gradient-to-r from-[#071126] via-[#0b1835] to-[#10234d] hover:from-[#0b1835] hover:via-[#10234d] hover:to-[#17326b] text-white font-semibold text-sm sm:text-base tracking-wide shadow-lg shadow-[#071126]/25 hover:shadow-xl hover:shadow-[#071126]/35 active:scale-[0.99] transition-all duration-200 flex items-center justify-center gap-2 group disabled:opacity-70 disabled:cursor-not-allowed cursor-pointer"
              >
                {isLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    <span>Create Account</span>
                    <ArrowRight className="h-4 w-4 sm:h-5 sm:w-5 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
              </button>
            </div>
          </form>

          {/* Footer Prompt (Stagger 8) */}
          <p
            className={`mt-3.5 sm:mt-5 text-center text-xs sm:text-sm font-medium text-slate-500 transition-all duration-500 ease-out delay-[450ms] ${
              isContentVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'
            }`}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              onClick={handleSwitchToLogin}
              className="text-[#0b1835] font-bold hover:text-sky-600 hover:underline transition-colors"
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>

    </div>
  );
};
