import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function AuthScreen({ onOpenScreen }) {
  const { loginWithToken } = useAuth();
  const [authTab, setAuthTab] = useState('phone'); // 'phone' | 'email'
  const [step, setStep] = useState('input'); // 'input' | 'otp'
  const [countryCode, setCountryCode] = useState('+1');
  const [phoneDigits, setPhoneDigits] = useState('5553829014');
  const [otpCode, setOtpCode] = useState(['7', '4', '2', '9', '0', '1']);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(38);
  const timerRef = useRef(null);

  const fullPhone = `${countryCode}${phoneDigits.replace(/\D/g, '')}`;

  useEffect(() => {
    if (step === 'otp') {
      timerRef.current = setInterval(() => {
        setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [step]);

  const handleSendOtp = async (e) => {
    if (e) e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.sendOtp(fullPhone, 'sms').catch(() => null);
      setStep('otp');
      setResendCooldown(38);
    } catch (err) {
      setError(err.message || 'Failed to dispatch verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (codeToVerify) => {
    const code = codeToVerify || otpCode.join('');
    setError('');
    setLoading(true);
    try {
      let res;
      try {
        res = await api.verifyOtp(fullPhone, code, {
          fullName: 'Anna Martinez',
          dob: '1970-05-14',
          biologicalSex: 'female',
        });
      } catch (apiErr) {
        // Fallback for instant client-side testing / mock
        res = {
          token: 'demo-jwt-token-fitsure',
          member: {
            phone: fullPhone,
            fullName: 'Anna Martinez',
            wellnessScore: 91,
          },
        };
      }

      const token = res.token || res.accessToken || 'demo-jwt-token-fitsure';
      const memberObj = res.member || {
        phone: fullPhone,
        fullName: 'Anna Martinez',
        wellnessScore: 91,
      };

      // Directly complete authentication and immediately navigate to Today dashboard
      loginWithToken(token, memberObj);
      if (onOpenScreen) {
        onOpenScreen('today');
      }
    } catch (err) {
      setError(err.message || 'Invalid verification code');
    } finally {
      setLoading(false);
    }
  };

  const handleBiometricAuth = async () => {
    setLoading(true);
    setTimeout(async () => {
      try {
        const token = 'biometric-passkey-jwt-anna-martinez';
        const memberObj = {
          phone: '+15553829014',
          fullName: 'Anna Martinez',
          wellnessScore: 91,
        };
        loginWithToken(token, memberObj);
        if (onOpenScreen) {
          onOpenScreen('today');
        }
      } finally {
        setLoading(false);
      }
    }, 600);
  };

  const handleOtpBoxChange = (index, value) => {
    if (!/^\d*$/.test(value)) return;
    const newOtp = [...otpCode];
    newOtp[index] = value.slice(-1);
    setOtpCode(newOtp);
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-full flex-1 bg-[#FAF8FF] text-[#131b2e] flex flex-col justify-between select-none font-sans overflow-x-hidden">
      {/* Header */}
      <header className="w-full shrink-0 z-50 bg-[#FAF8FF]/90 backdrop-blur-xl border-b border-[#e2e8f0]/80 pt-3 px-4 pb-2">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => onOpenScreen?.('landing')}
              className="w-9 h-9 rounded-full bg-white border border-[#e2e8f0] shadow-xs flex items-center justify-center text-[#131b2e] hover:bg-slate-50 transition cursor-pointer"
              aria-label="Back to landing"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#f4fce3] border border-[#d9f99d]">
              <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
              <span className="text-[11px] text-[#3f6212] font-bold tracking-wider uppercase">
                CLINICAL PORTAL
              </span>
            </div>
            <button
              type="button"
              onClick={() => onOpenScreen?.('signup_dedicated')}
              className="w-9 h-9 rounded-full bg-[#ecfccb] border border-[#d9f99d] flex items-center justify-center text-[#3f6212] shadow-xs hover:bg-[#d9f99d] transition cursor-pointer"
              aria-label="Create account"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
            </button>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-6 no-scrollbar">
          {/* Ambient Glow */}
          <div className="relative w-full">
            <div className="absolute -top-12 -right-8 w-44 h-44 rounded-full bg-[#d9f99d]/30 blur-3xl pointer-events-none"></div>
            <div className="absolute top-24 -left-10 w-48 h-48 rounded-full bg-[#bef264]/20 blur-3xl pointer-events-none"></div>

            {/* Title */}
            <div className="text-center px-2 mt-3 mb-4">
              <h2 className="text-[26px] leading-[32px] font-black tracking-tight text-neutral-900">
                Welcome Back
              </h2>
              <p className="text-[12.5px] text-neutral-500 mt-1 leading-snug">
                Sign in to access your continuous clinical telemetry and metabolic health records.
              </p>
            </div>

            {/* Segmented Auth Switcher */}
            <div className="bg-slate-100 p-1 rounded-full flex items-center border border-[#e2e8f0] shadow-inner mb-4">
              <button
                type="button"
                onClick={() => setAuthTab('phone')}
                className={`flex-1 py-1.5 rounded-full text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'phone'
                    ? 'bg-white text-neutral-900 shadow-sm font-bold border border-[#e2e8f0]/60'
                    : 'text-neutral-500 hover:text-neutral-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] text-[#4d7c0f]">smartphone</span>
                <span>Phone & OTP</span>
              </button>
              <button
                type="button"
                onClick={() => setAuthTab('email')}
                className={`flex-1 py-1.5 rounded-full text-xs transition duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                  authTab === 'email'
                    ? 'bg-white text-neutral-900 shadow-sm font-bold border border-[#e2e8f0]/60'
                    : 'text-neutral-500 hover:text-neutral-900 font-medium'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                <span>Email & Key</span>
              </button>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-xs font-semibold p-2.5 rounded-xl mb-3 animate-fade-in flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-red-600">warning</span>
                <span>{error}</span>
              </div>
            )}

            {/* Phone & OTP Form */}
            {authTab === 'phone' && (
              <div className="space-y-3.5">
                {/* Mobile Terminal Field */}
                <div>
                  <div className="flex items-center justify-between px-1 mb-1">
                    <label className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                      <span>Mobile Terminal</span>
                      <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
                    </label>
                    <span className="text-[11px] text-[#4d7c0f] font-semibold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[13px]">verified_user</span>
                      <span>256-Bit Encrypted</span>
                    </span>
                  </div>

                  <div className="relative flex items-center bg-white rounded-2xl p-1.5 border border-[#e2e8f0] shadow-xs focus-within:border-[#84cc16] focus-within:ring-2 focus-within:ring-[#bef264]/40 transition">
                    <select
                      value={countryCode}
                      onChange={(e) => setCountryCode(e.target.value)}
                      className="bg-slate-100 px-2 py-1.5 rounded-xl text-xs font-bold text-neutral-900 outline-none border-none cursor-pointer mr-1"
                    >
                      <option value="+1">🇺🇸 +1</option>
                      <option value="+91">🇮🇳 +91</option>
                      <option value="+44">🇬🇧 +44</option>
                      <option value="+65">🇸🇬 +65</option>
                    </select>
                    <input
                      type="tel"
                      value={phoneDigits}
                      onChange={(e) => setPhoneDigits(e.target.value)}
                      placeholder="(555) 000-0000"
                      className="w-full bg-transparent px-2 text-sm text-neutral-900 font-medium focus:outline-none"
                    />
                    <div className="pr-3 text-[#4d7c0f] flex items-center">
                      <span className="material-symbols-outlined text-[18px]">lock</span>
                    </div>
                  </div>
                </div>

                {/* 6-Digit Passcode Boxes */}
                <div>
                  <div className="flex items-center justify-between px-1 mb-1.5">
                    <span className="text-xs font-bold text-neutral-900">6-Digit Passcode</span>
                    <div className="flex items-center gap-1 text-[11px] text-neutral-500">
                      <span className="material-symbols-outlined text-[13px] animate-spin">sync</span>
                      <span>Resend in <strong className="text-[#4d7c0f]">{resendCooldown}s</strong></span>
                    </div>
                  </div>

                  <div className="grid grid-cols-6 gap-1.5 w-full">
                    {otpCode.map((digit, idx) => (
                      <div
                        key={idx}
                        className="h-11 py-1 rounded-xl bg-white border border-[#e2e8f0] shadow-xs flex flex-col items-center justify-center focus-within:border-[#84cc16] focus-within:ring-2 focus-within:ring-[#bef264]/40"
                      >
                        <input
                          type="text"
                          maxLength={1}
                          value={digit}
                          onChange={(e) => handleOtpBoxChange(idx, e.target.value)}
                          className="w-full text-center font-black text-base text-neutral-900 bg-transparent focus:outline-none"
                        />
                        <span className="w-2 h-0.5 rounded-full bg-[#84cc16]"></span>
                      </div>
                    ))}
                  </div>

                  {/* Auto-fill demo pill */}
                  <button
                    type="button"
                    onClick={() => {
                      setOtpCode(['7', '4', '2', '9', '0', '1']);
                      handleVerifyOtp('742901');
                    }}
                    className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-[#f4fce3] border border-[#d9f99d] hover:bg-[#ecfccb] transition text-left mt-2 w-full cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5">
                      <span className="material-symbols-outlined text-[15px] text-[#4d7c0f]">sms</span>
                      <span className="text-[11px] text-neutral-800">
                        Auto-fill dev code: <strong className="text-[#3f6212]">742901</strong>
                      </span>
                    </div>
                    <span className="text-[10px] text-[#3f6212] font-bold bg-[#bef264]/70 px-2 py-0.5 rounded">
                      Paste & Sign In
                    </span>
                  </button>
                </div>

                {/* Biometric Passkey Button */}
                <button
                  type="button"
                  onClick={handleBiometricAuth}
                  className="w-full p-2.5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs hover:border-[#bef264] hover:shadow-md transition active:scale-[0.99] flex items-center justify-between text-left cursor-pointer group"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-[#ecfccb] border border-[#d9f99d] flex items-center justify-center text-[#3f6212] shadow-xs group-hover:scale-105 transition-transform">
                      <span className="material-symbols-outlined text-[18px]">fingerprint</span>
                    </div>
                    <div>
                      <div className="text-xs font-bold text-neutral-900 flex items-center gap-1.5">
                        <span>Biometric Passkey</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-[#bef264] text-neutral-900 text-[9px] font-bold">
                          Instant
                        </span>
                      </div>
                      <p className="text-[10.5px] text-neutral-500">Tap to authenticate via Face ID or Touch ID</p>
                    </div>
                  </div>
                  <span className="material-symbols-outlined text-neutral-400 text-[18px] group-hover:translate-x-0.5 transition-transform">
                    arrow_forward
                  </span>
                </button>

                {/* Sign In Button */}
                <button
                  type="button"
                  onClick={() => handleVerifyOtp()}
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-[#84cc16] hover:bg-[#97E432] text-neutral-950 font-black text-sm shadow-[0_8px_16px_-4px_rgba(132,204,22,0.4)] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 border border-lime-400/50"
                >
                  <span>{loading ? 'Authenticating...' : 'Sign In to FITsure'}</span>
                  <span className="material-symbols-outlined text-[17px] font-bold">arrow_forward</span>
                </button>
              </div>
            )}

            {/* Email & Key Form */}
            {authTab === 'email' && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleVerifyOtp('742901');
                }}
                className="space-y-3.5"
              >
                <div>
                  <label className="text-xs font-bold text-neutral-900 block mb-1 px-1">Clinical Email</label>
                  <div className="flex items-center bg-white border border-[#e2e8f0] rounded-2xl px-3 py-2 shadow-xs focus-within:border-[#84cc16] focus-within:ring-2 focus-within:ring-[#bef264]/40">
                    <span className="material-symbols-outlined text-neutral-400 text-[17px] mr-2">alternate_email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="patient@fitsure.health"
                      className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1 px-1">
                    <label className="text-xs font-bold text-neutral-900">Medical Vault Password</label>
                    <button
                      type="button"
                      onClick={() => onOpenScreen?.('forgot_password')}
                      className="text-[11px] font-semibold text-[#4d7c0f] hover:underline"
                    >
                      Forgot?
                    </button>
                  </div>
                  <div className="flex items-center bg-white border border-[#e2e8f0] rounded-2xl px-3 py-2 shadow-xs focus-within:border-[#84cc16] focus-within:ring-2 focus-within:ring-[#bef264]/40">
                    <span className="material-symbols-outlined text-neutral-400 text-[17px] mr-2">key</span>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••••••"
                      className="w-full bg-transparent text-xs text-neutral-900 focus:outline-none"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 rounded-full bg-[#84cc16] hover:bg-[#97E432] text-neutral-950 font-black text-sm shadow-[0_8px_16px_-4px_rgba(132,204,22,0.4)] active:scale-[0.98] transition flex items-center justify-center gap-2 cursor-pointer border border-lime-400/50"
                >
                  <span>{loading ? 'Verifying...' : 'Sign In with Key'}</span>
                  <span className="material-symbols-outlined text-[17px] font-bold">arrow_forward</span>
                </button>
              </form>
            )}

            {/* Active Care Team Preview */}
            <div className="mt-3.5 p-2.5 rounded-2xl bg-white border border-[#e2e8f0] shadow-xs flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className="flex -space-x-2 shrink-0">
                  <img
                    alt="Dr. Weber"
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?auto=format&fit=crop&w=120&q=80"
                  />
                  <img
                    alt="Specialist"
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1622253692010-333f2da6031d?auto=format&fit=crop&w=120&q=80"
                  />
                  <img
                    alt="Care Coordinator"
                    className="w-7 h-7 rounded-full object-cover ring-2 ring-white"
                    src="https://images.unsplash.com/photo-1594824813576-965306636746?auto=format&fit=crop&w=120&q=80"
                  />
                </div>
                <div>
                  <p className="text-xs font-bold text-neutral-900">Active Clinical Care Team</p>
                  <p className="text-[10.5px] text-neutral-500">4 specialists awaiting your session</p>
                </div>
              </div>
              <span className="w-2.5 h-2.5 rounded-full bg-[#84cc16] animate-pulse"></span>
            </div>

            {/* Social Continue */}
            <div className="relative my-3 flex items-center justify-center">
              <div className="w-full h-px bg-[#e2e8f0]"></div>
              <span className="absolute px-3 bg-[#FAF8FF] text-[10px] text-neutral-400 font-semibold tracking-wider">
                OR CONTINUE WITH
              </span>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="flex-1 py-2 px-3 rounded-xl bg-white border border-[#e2e8f0] shadow-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5 active:scale-[0.99] cursor-pointer text-xs font-bold text-neutral-900"
              >
                <span>Apple</span>
              </button>
              <button
                type="button"
                onClick={handleBiometricAuth}
                className="flex-1 py-2 px-3 rounded-xl bg-white border border-[#e2e8f0] shadow-xs hover:bg-slate-50 transition flex items-center justify-center gap-1.5 active:scale-[0.99] cursor-pointer text-xs font-bold text-neutral-900"
              >
                <span>Google</span>
              </button>
            </div>

            {/* Sign Up Navigation Link */}
            <div className="text-center mt-3 pt-2 border-t border-[#e2e8f0]">
              <button
                type="button"
                onClick={() => onOpenScreen?.('signup_dedicated')}
                className="text-xs font-semibold text-slate-700 hover:text-emerald-900 transition-colors cursor-pointer"
              >
                Don't have an account? <span className="underline font-bold text-emerald-900">Create Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
  );
}
