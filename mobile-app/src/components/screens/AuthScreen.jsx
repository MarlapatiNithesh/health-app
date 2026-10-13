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
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-[32px] p-6 sm:p-8 shadow-2xl border border-slate-100 space-y-6">
        
        {/* GOQii Logo & Welcome */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#ED1C24] via-rose-600 to-indigo-700 text-white shadow-xl shadow-rose-500/25">
            <span className="text-2xl font-black tracking-tight">G</span>
          </div>
          <div className="flex items-center justify-center gap-1">
            <span className="text-3xl font-black text-slate-900 tracking-tight">
              GOQ<span className="text-[#ED1C24] inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span><span className="text-[#ED1C24] inline-block relative">i<span className="w-1.5 h-1.5 rounded-full bg-[#ED1C24] absolute -top-1 left-[1px]"></span></span>
            </span>
          </div>
          <p className="text-xs font-bold text-[#ED1C24] uppercase tracking-wider">
            Be the Force • Preventive Healthcare
          </p>
          <p className="text-xs text-slate-400 font-semibold max-w-xs mx-auto">
            Doctor consultations, Health Locker, vitals tracking & Karma rewards
          </p>
        </div>

        {error && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl p-3 text-xs font-semibold flex items-start gap-2 animate-fade-in">
            <AlertTriangle size={16} className="shrink-0 mt-0.5 text-rose-600" />
            <div className="flex-1">
              <p>{error}</p>
              {isExpired && (
                <button
                  type="button"
                  onClick={handleResendOtp}
                  className="mt-1.5 px-3 py-1 bg-rose-600 text-white rounded-lg text-[11px] font-bold hover:bg-rose-700 transition"
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
              <label className="text-xs font-bold text-slate-700 block mb-1.5">
                Mobile Number (E.164)
              </label>
              
              <div className="flex gap-2">
                <select
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value)}
                  className="px-3 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="+1">🇺🇸 +1 (US)</option>
                  <option value="+91">🇮🇳 +91 (IN)</option>
                  <option value="+44">🇬🇧 +44 (UK)</option>
                  <option value="+65">🇸🇬 +65 (SG)</option>
                  <option value="+61">🇦🇺 +61 (AU)</option>
                </select>

                <div className="relative flex-1">
                  <input
                    type="tel"
                    required
                    placeholder="4155552671"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full pl-4 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-orange-500 outline-none"
                  />
                  <Phone size={16} className="absolute right-3.5 top-3.5 text-slate-400" />
                </div>
              </div>

              {/* Delivery Channel Selector */}
              <div className="mt-3">
                <label className="text-[11px] font-bold text-slate-600 block mb-1.5">
                  Delivery Channel:
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setChannel('sms')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      channel === 'sms'
                        ? 'bg-orange-50 border-orange-400 text-orange-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>💬</span>
                    <span>SMS</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('whatsapp')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      channel === 'whatsapp'
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <span>🟢</span>
                    <span>WhatsApp</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setChannel('call')}
                    className={`py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 border ${
                      channel === 'call'
                        ? 'bg-indigo-50 border-indigo-400 text-indigo-700 shadow-xs'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
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
              className="w-full py-3.5 bg-gradient-to-r from-[#ED1C24] to-[#FF6B00] hover:opacity-95 text-white rounded-2xl text-sm font-bold shadow-lg shadow-rose-500/25 transition active:scale-[0.99] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {loading 
                  ? 'Sending Verification Code…' 
                  : channel === 'whatsapp' 
                  ? 'Send via WhatsApp' 
                  : channel === 'call' 
                  ? 'Request Verification Call' 
                  : 'Send SMS Code'}
              </span>
              <ArrowRight size={16} />
            </button>

            {/* Quick Demo Pre-fill */}
            <div className="pt-2 text-center space-y-1">
              <button
                type="button"
                onClick={() => {
                  setCountryCode('+1');
                  setPhoneNumber('4155552671');
                }}
                className="text-[11px] font-bold text-orange-600 hover:underline block mx-auto"
              >
                ⚡ Use Demo Tester Number (+1 415 555 2671)
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
                ? 'bg-rose-50 border-rose-200 text-rose-800' 
                : expiresSeconds < 60 
                ? 'bg-amber-50 border-amber-200 text-amber-800' 
                : 'bg-indigo-50 border-indigo-200 text-indigo-900'
            }`}>
              <div className="flex items-center gap-2">
                <Clock size={16} className={isExpired ? 'text-rose-600 animate-pulse' : 'text-indigo-600'} />
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
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                  resendCooldown > 0 
                    ? 'bg-slate-200/80 text-slate-500 cursor-not-allowed' 
                    : 'bg-orange-500 hover:bg-orange-600 text-white shadow-xs'
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
                <label className="text-xs font-bold text-slate-700">
                  Enter 6-Digit Verification Code
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => { setOtpCode('805296'); setError(''); }}
                    className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg hover:bg-emerald-100 transition"
                  >
                    ⚡ 805 296
                  </button>
                  <button
                    type="button"
                    onClick={autoFillDevOtp}
                    className="text-[10px] font-bold text-orange-600 bg-orange-50 border border-orange-200 px-2 py-0.5 rounded-lg hover:bg-orange-100 transition"
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
                className={`w-full text-center tracking-[0.3em] sm:tracking-[0.5em] text-2xl font-black py-3 bg-slate-50 border rounded-2xl text-slate-900 focus:ring-2 outline-none ${
                  isExpired 
                    ? 'border-rose-300 focus:ring-rose-400 bg-rose-50/30' 
                    : 'border-slate-200 focus:ring-orange-500'
                }`}
              />
              
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-[11px] p-2 bg-slate-100 rounded-xl">
                  <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                    {channel === 'whatsapp' ? (
                      <>
                        <span className="text-emerald-600 font-bold">🟢 WhatsApp</span>
                        <span>sent to</span>
                      </>
                    ) : channel === 'call' ? (
                      <>
                        <span className="text-indigo-600 font-bold">📞 Voice Call</span>
                        <span>to</span>
                      </>
                    ) : (
                      <>
                        <span className="text-orange-600 font-bold">💬 SMS</span>
                        <span>sent to</span>
                      </>
                    )}
                    <strong className="text-slate-900">{fullPhone}</strong>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setStep('phone');
                      setError('');
                    }}
                    className="text-orange-600 hover:underline font-bold text-[11px]"
                  >
                    Edit
                  </button>
                </div>

                {/* Alternative delivery channel switcher */}
                <div className="flex items-center justify-between px-1 text-[11px] text-slate-500 font-medium">
                  <span>Didn't receive?</span>
                  <div className="flex items-center gap-2">
                    {channel !== 'whatsapp' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('whatsapp')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-emerald-700 hover:underline font-bold disabled:opacity-40"
                      >
                        Try WhatsApp 🟢
                      </button>
                    )}
                    {channel !== 'sms' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('sms')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-orange-600 hover:underline font-bold disabled:opacity-40"
                      >
                        Try SMS 💬
                      </button>
                    )}
                    {channel !== 'call' && (
                      <button
                        type="button"
                        onClick={() => handleResendOtp('call')}
                        disabled={resendCooldown > 0 || resending}
                        className="text-indigo-600 hover:underline font-bold disabled:opacity-40"
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
              <div className="p-3.5 bg-emerald-50 border border-emerald-200/80 rounded-2xl flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                  <CheckCircle2 size={18} />
                </div>
                <div className="text-left">
                  <p className="text-xs font-bold text-emerald-950">
                    Welcome back, {existingMemberName || 'Member'}!
                  </p>
                  <p className="text-[11px] text-emerald-700 font-medium">
                    Verified health profile linked. Enter OTP to open your dashboard.
                  </p>
                </div>
              </div>
            ) : (
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                  🌟 New Member Profile Setup
                </span>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">First Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Jane"
                      value={profile.firstName}
                      onChange={(e) => setProfile({ ...profile, firstName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Last Name</label>
                    <input
                      type="text"
                      required
                      placeholder="Doe"
                      value={profile.lastName}
                      onChange={(e) => setProfile({ ...profile, lastName: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none focus:ring-1 focus:ring-orange-500"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Biological Sex</label>
                    <select
                      value={profile.biologicalSex}
                      onChange={(e) => setProfile({ ...profile, biologicalSex: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none"
                    >
                      <option value="female">Female</option>
                      <option value="male">Male</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Date of Birth</label>
                    <input
                      type="date"
                      value={profile.dob}
                      onChange={(e) => setProfile({ ...profile, dob: e.target.value })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Height (cm)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.heightCm}
                      onChange={(e) => setProfile({ ...profile, heightCm: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 block mb-0.5">Weight (kg)</label>
                    <input
                      type="number"
                      step="0.1"
                      value={profile.weightKg}
                      onChange={(e) => setProfile({ ...profile, weightKg: parseFloat(e.target.value) || 0 })}
                      className="w-full px-3 py-2 bg-slate-50 border rounded-xl text-xs font-semibold outline-none"
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setStep('phone')}
                className="py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl text-xs font-bold"
              >
                Back
              </button>
              <button
                type="submit"
                disabled={loading || otpCode.length < 4}
                className="flex-1 py-3 bg-gradient-to-r from-[#ED1C24] to-[#FF6B00] hover:opacity-95 text-white rounded-2xl text-xs font-bold shadow-md shadow-rose-500/25 transition disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <span>{loading ? 'Verifying…' : 'Verify & Enter GOQii'}</span>
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
        <div className="pt-4 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-400 font-semibold">
          <ShieldCheck size={14} className="text-emerald-500" />
          <span>256-bit Encrypted Session • HIPAA / GDPR Compliant</span>
        </div>
      </div>
    </div>
  );
}
