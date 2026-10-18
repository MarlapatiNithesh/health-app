import React, { useState, useEffect, useRef } from 'react';
import { 
  Phone, 
  ShieldCheck, 
  ArrowRight, 
  CheckCircle2, 
  Sparkles, 
  Lock, 
  Heart,
  Activity,
  Bot,
  Clock,
  RefreshCw,
  AlertTriangle,
  RotateCcw
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { HealthPermissionsModal } from '../common/HealthPermissionsModal';
import { getHealthConsentStorageKeys, getHealthMemberId } from '../../utils/healthConsent';

export function AuthScreen() {
  const { loginWithToken, nativeTelemetry } = useAuth();
  const [step, setStep] = useState('phone'); // 'phone' | 'otp' | 'health_permissions'
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneNumber, setPhoneNumber] = useState('4155552671');
  const [otpCode, setOtpCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [channel, setChannel] = useState('sms'); // 'sms' | 'whatsapp' | 'call'
  const [sessionData, setSessionData] = useState(null);
  const [isExistingUser, setIsExistingUser] = useState(false);
  const [pendingAuth, setPendingAuth] = useState(null);
  const [existingMemberName, setExistingMemberName] = useState('');

  // ── OTP Expiration & Resend Timers ──
  const [expiresSeconds, setExpiresSeconds] = useState(300); // 5 minutes countdown
  const [resendCooldown, setResendCooldown] = useState(30);   // 30 seconds resend cooldown
  const timerRef = useRef(null);

  // Profile data collected ONLY for new member first-time onboarding
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    dob: '1995-01-01',
    biologicalSex: 'female',
    heightCm: 170.0,
    weightKg: 65.0,
  });

  const fullPhone = `${countryCode}${phoneNumber.replace(/\D/g, '')}`;

  // Countdown timer for OTP expiration and resend cooldown
  useEffect(() => {
    if (step === 'otp') {
      timerRef.current = setInterval(() => {
        setExpiresSeconds((prev) => (prev > 0 ? prev - 1 : 0));
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  };

  const handleSendOtp = async (e, overrideChannel = null) => {
    if (e) e.preventDefault();
    const activeChannel = overrideChannel || channel;
    setError('');
    setLoading(true);
    try {
      const res = await api.sendOtp(fullPhone, activeChannel);
      setSessionData(res);
      const returnedChannel = res?.channel || activeChannel;
      setChannel(returnedChannel);
      setIsExistingUser(Boolean(res?.isExistingMember));
      setExistingMemberName(res?.existingMemberName || '');
      setStep('otp');
      setOtpCode('');
      setExpiresSeconds(300); // 5 minute fresh window
      setResendCooldown(30);  // 30s cooldown before next resend
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async (overrideChannel = null) => {
    if (resendCooldown > 0 || resending) return;
    const targetChannel = overrideChannel || channel;
    setError('');
    setResending(true);
    try {
      const res = await api.sendOtp(fullPhone, targetChannel);
      setSessionData(res);
      const returnedChannel = res?.channel || targetChannel;
      setChannel(returnedChannel);
      setIsExistingUser(Boolean(res?.isExistingMember));
      setExistingMemberName(res?.existingMemberName || '');
      setOtpCode('');
      setExpiresSeconds(300);
      setResendCooldown(30);
    } catch (err) {
      setError(err.message || 'Failed to resend code');
    } finally {
      setResending(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    if (e) e.preventDefault();
    
    // Check if expired on frontend
    if (expiresSeconds <= 0) {
      setError('This verification code has expired. Please tap "Resend Code" to receive a fresh OTP.');
      return;
    }

    const cleanCode = String(otpCode || '').replace(/[\s-]+/g, '');
    if (!cleanCode) {
      setError('Please enter the 6-digit verification code.');
      return;
    }

    setError('');
    setLoading(true);
    try {
      // Only send profile fields if this is a first-time new user registration
      const verifyPayload = isExistingUser ? {} : {
        fullName: `${profile.firstName} ${profile.lastName}`.trim(),
        ...profile,
      };

      const res = await api.verifyOtp(fullPhone, cleanCode, verifyPayload);

      const token = res.token || res.accessToken;
      if (!token) throw new Error('No authentication token returned by server');
      
      const memberObj = res.member || {
        phone: fullPhone,
        fullName: existingMemberName || `${profile.firstName} ${profile.lastName}`.trim(),
        wellnessScore: 82,
      };

      const memberId = getHealthMemberId(memberObj);

      // Always present the Health Permissions & Data Setup step upon login
      setPendingAuth({ token, member: memberObj, memberId });
      setStep('health_permissions');
    } catch (err) {
      if (err.message?.includes('expired') || err.message?.includes('session_not_found')) {
        setError('Verification session expired. Please tap "Resend Code" below to receive a new OTP.');
      } else {
        setError(err.message || 'Invalid verification code');
      }
    } finally {
      setLoading(false);
    }
  };

  const autoFillDevOtp = () => {
    setOtpCode('123456');
    setError('');
  };

  const isExpired = expiresSeconds <= 0;

  return (
    <div className="min-h-screen glass-canvas relative overflow-hidden flex items-center justify-center p-4">
      {/* Ambient Cyber Aurora Orbs */}
      <div className="pointer-events-none absolute -top-32 -left-28 w-96 h-96 bg-cyan-500/15 rounded-full blur-3xl animate-pulse" />
      <div className="pointer-events-none absolute -bottom-32 -right-28 w-96 h-96 bg-purple-600/15 rounded-full blur-3xl animate-pulse" />

      <div className="w-full max-w-md glass-card rounded-[32px] p-6 sm:p-8 space-y-6 relative z-10 border border-white/[0.12] border-t-white/[0.25] shadow-2xl">
        
        {/* Startup Health AI Logo & Welcome */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 shadow-xl shadow-cyan-500/25 ring-2 ring-white/20">
            <svg className="w-9 h-9 text-slate-950" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 12h3.5l2.5-6 4 12 2.5-6H21" />
            </svg>
          </div>
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-3xl font-black text-white tracking-tight">
              FIT<span className="text-cyan-400 text-glow-cyan">SURE</span>
            </span>
            <span className="px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 text-[10px] font-extrabold uppercase tracking-widest">
              AI
            </span>
          </div>
          <p className="text-xs font-bold text-cyan-400 uppercase tracking-widest text-glow-cyan">
            Next-Gen Autonomous Preventive Care
          </p>
          <p className="text-xs text-slate-400 font-medium max-w-xs mx-auto">
            AI Triage • Continuous Telemetry • S3 Encrypted Medical Vault
          </p>
        </div>

        {error && (
          <div className="glass-subcard bg-rose-950/40 border border-rose-500/40 text-rose-300 rounded-2xl p-3 text-xs font-semibold flex items-start gap-2 animate-fade-in">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-400" />
            <div className="flex-1">
              <p>{error}</p>
              {isExpired && (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="mt-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white rounded-lg text-[11px] font-bold transition shadow-xs cursor-pointer"
                >
                  Request Fresh Code Now
                </button>
              )}
            </div>
          </div>
        )}

        {/* STEP 1: Phone Input */}
        {step === 'phone' && (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                Mobile Number (E.164)
              </label>
              
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-3 glass-subcard bg-slate-900/80 border border-white/10 rounded-2xl text-xs font-bold text-slate-200 outline-none focus:border-cyan-400"
                >
                  <option value="+1" className="bg-slate-900 text-slate-200">🇺🇸 +1 (US)</option>
                  <option value="+91" className="bg-slate-900 text-slate-200">🇮🇳 +91 (IN)</option>
                  <option value="+44" className="bg-slate-900 text-slate-200">🇬🇧 +44 (UK)</option>
                  <option value="+65" className="bg-slate-900 text-slate-200">🇸🇬 +65 (SG)</option>
                  <option value="+61" className="bg-slate-900 text-slate-200">🇦🇺 +61 (AU)</option>
                </select>

                <div className="relative flex-1">
                  <input
                    type="tel"
                    required
                    placeholder="4155552671"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 glass-subcard bg-slate-900/70 border border-white/10 rounded-2xl text-sm font-bold text-white placeholder:text-slate-500 focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 outline-none transition"
                  />
                  <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                </div>
              </div>

              {/* Delivery Channel Selector */}
              <div className="mt-3">
                <label className="text-[11px] font-bold text-slate-400 block mb-1.5">
                  Delivery Channel:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      channel === 'sms'
                        ? 'bg-cyan-500/20 border-cyan-400/60 text-cyan-300 shadow-sm shadow-cyan-500/20'
                        : 'glass-subcard bg-slate-900/40 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>💬</span>
                    <span>SMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('whatsapp')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      channel === 'whatsapp'
                        ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-sm shadow-emerald-500/20'
                        : 'glass-subcard bg-slate-900/40 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>🟢</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('call')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border cursor-pointer ${
                      channel === 'call'
                        ? 'bg-purple-500/20 border-purple-400/60 text-purple-300 shadow-sm shadow-purple-500/20'
                        : 'glass-subcard bg-slate-900/40 border-white/10 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span>📞</span>
                    <span>Call</span>
                  </button>
                </div>
              </div>

              <p className="text-[11px] text-slate-400 mt-2 font-medium">
                We'll issue a 6-digit verification code via {channel === 'whatsapp' ? 'WhatsApp' : channel === 'call' ? 'Phone Call' : 'SMS'}.
              </p>
            </div>

            <button
              type="submit"
              disabled={loading || !phoneNumber}
              className="w-full py-3.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 rounded-2xl text-sm font-black shadow-lg shadow-cyan-500/25 transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading 
                  ? 'Dispatching Secure Token…' 
                  : channel === 'whatsapp' 
                  ? 'Send via WhatsApp' 
                  : channel === 'call' 
                  ? 'Request Verification Call' 
                  : 'Send SMS Code'}
              </span>
              <ArrowRight size={16} />
            </button>

            {/* Quick Demo Pre-fill */}
            <div className="pt-2 text-center space-y-2">
              <button
                type="button"
                onClick={() => {
                  setCountryCode('+1');
                  setPhoneNumber('4155552671');
                }}
                className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 block mx-auto cursor-pointer transition"
              >
                ⚡ Use Investor Demo Number (+1 415 555 2671)
              </button>
            </div>
          </form>
        )}

        {/* STEP 2: OTP Verification & Profile Setup with Expiration Timer */}
        {step === 'otp' && (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            
            {/* Countdown Timer Header Strip */}
            <div className={`p-3 rounded-2xl border flex items-center justify-between transition ${
              isExpired 
                ? 'glass-subcard bg-rose-950/40 border-rose-500/40 text-rose-300' 
                : expiresSeconds < 60 
                ? 'glass-subcard bg-amber-950/40 border-amber-500/40 text-amber-300' 
                : 'glass-subcard bg-cyan-950/30 border-cyan-500/30 text-cyan-300'
            }`}>
              <div className="flex items-center gap-2">
                <Clock size={16} className={isExpired ? 'text-rose-400 animate-pulse' : 'text-cyan-400'} />
                <div>
                  <span className="text-[11px] font-bold block">
                    {isExpired ? 'Code Expired' : 'Code Expiration Timer'}
                  </span>
                  <span className="text-xs font-black tracking-wide font-mono">
                    {isExpired ? '00:00 - Expired' : formatTimer(expiresSeconds)}
                  </span>
                </div>
              </div>

              {/* Resend Action */}
              <button
                type="button"
                onClick={handleResendOtp}
                disabled={resendCooldown > 0 || resending}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  resendCooldown > 0 
                    ? 'bg-slate-800/80 text-slate-500 cursor-not-allowed' 
                    : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-sm font-black'
                }`}
              >
                <RefreshCw size={12} className={resending ? 'animate-spin' : ''} />
                <span>
                  {resending 
                    ? 'Resending…' 
                    : resendCooldown > 0 
                    ? `Resend in ${resendCooldown}s` 
                    : 'Resend Code'}
                </span>
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-300">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setOtpCode('805296'); setError(''); }}
                    className="text-[10px] font-bold text-emerald-300 glass-subcard bg-emerald-500/10 border border-emerald-400/30 px-2 py-0.5 rounded-lg hover:bg-emerald-500/20 transition cursor-pointer"
                  >
                    ⚡ 805 296
                  </button>
                  <button
                    type="button"
                    onClick={autoFillDevOtp}
                    className="text-[10px] font-bold text-cyan-300 glass-subcard bg-cyan-500/10 border border-cyan-400/30 px-2 py-0.5 rounded-lg hover:bg-cyan-500/20 transition cursor-pointer"
                  >
                    ⚡ 123456
                  </button>
                </div>
              </div>

              <input
                type="text"
                required
                maxLength={7}
                placeholder="805 296"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value)}
                className={`w-full text-center tracking-[0.3em] sm:tracking-[0.5em] text-2xl font-black py-3 glass-subcard bg-slate-900/80 border rounded-2xl text-cyan-300 focus:ring-2 outline-none transition ${
                  isExpired 
                    ? 'border-rose-400/60 focus:ring-rose-400 bg-rose-950/20' 
                    : 'border-white/15 focus:border-cyan-400 focus:ring-cyan-400/30'
                }`}
              />
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] p-2 glass-subcard bg-slate-900/60 rounded-xl border border-white/5">
                  <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                    {channel === 'whatsapp' ? (
                      <>
                        <span className="text-emerald-400 font-bold">🟢 WhatsApp</span>
                        <span>sent to</span>
                      </>
                    ) : channel === 'call' ? (
                      <>
                        <span className="text-purple-400 font-bold">📞 Voice Call</span>
                        <span>to</span>
                      </>
                    ) : (
                      <>
                        <span className="text-cyan-400 font-bold">💬 SMS</span>
                        <span>sent to</span>
                      </>
                    )}
                    <strong className="text-white">{fullPhone}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setError('');
                    }}
                    className="text-cyan-400 hover:underline font-bold text-[11px] cursor-pointer"
                  >
                    Edit
                  </button>
                </div>

                {/* Alternative delivery channel switcher */}
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-400 font-medium">
                  <span>Didn't receive?</span>
                  <div className="flex items-center gap-2">
                    {channel !== 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('whatsapp')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-emerald-400 hover:underline font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Try WhatsApp 🟢
                      </button>
                    )}
                    {channel !== 'sms' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('sms')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-cyan-400 hover:underline font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Try SMS 💬
                      </button>
                    )}
                    {channel !== 'call' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('call')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-purple-400 hover:underline font-bold disabled:opacity-40 cursor-pointer"
                      >
                        Try Call 📞
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Conditional Profile Setup: Only shown for brand-new users */}
            {isExistingUser ? (
              <div className="p-3.5 glass-subcard bg-emerald-950/30 border border-emerald-400/40 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 border border-emerald-400/30">
                  <CheckCircle2 size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-300">
                    Welcome back, {existingMemberName || 'Member'}!
                  </p>
                  <p className="text-[11px] text-slate-300 font-medium">
                    Verified health profile linked. Enter OTP to open your dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-white/10 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400 block">
                  🌟 New Member Profile Setup
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/70 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Doe"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/70 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Biological Sex</label>
                    <select
                      value={profile.biologicalSex}
                      onChange={(e) => setProfile({ ...profile, biologicalSex: e.target.value })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none"
                    >
                      <option value="female" className="bg-slate-900 text-white">Female</option>
                      <option value="male" className="bg-slate-900 text-white">Male</option>
                      <option value="other" className="bg-slate-900 text-white">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Date of Birth</label>
                    <input
                      type="date"
                      value={profile.dob}
                      onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/70 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.heightCm}
                      onChange={(e) => setProfile({ ...profile, heightCm: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/70 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-400 block mb-0.5">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.weightKg}
                      onChange={(e) => setProfile({ ...profile, weightKg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 glass-subcard bg-slate-900/70 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="py-3 px-4 glass-subcard bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 rounded-2xl text-xs font-bold transition cursor-pointer"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length < 4}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 rounded-2xl text-xs font-black shadow-md shadow-cyan-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{loading ? 'Verifying Credentials…' : 'Verify & Launch Fitsure'}</span>
                <CheckCircle2 size={15} />
              </button>
            </div>
          </form>
        )}

        {/* STEP 3: Health Data Access & Permissions Step */}
        {step === 'health_permissions' && (
          <HealthPermissionsModal
            isOpen={true}
            isSignupFlow={true}
            memberId={pendingAuth?.memberId}
            authToken={pendingAuth?.token}
            detectedPlatform={nativeTelemetry?.platform || (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '') ? 'android' : 'ios')}
            onGranted={() => {
              if (pendingAuth) {
                loginWithToken(pendingAuth.token, pendingAuth.member);
              }
            }}
            onClose={() => {
              if (pendingAuth) {
                loginWithToken(pendingAuth.token, pendingAuth.member);
              }
            }}
          />
        )}

        {/* Security Footer */}
        <div className="pt-4 border-t border-white/[0.08] flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
          <ShieldCheck size={14} className="text-cyan-400" />
          <span>256-bit Encrypted Session • HIPAA / GDPR Compliant</span>
        </div>
      </div>
    </div>
  );
}
