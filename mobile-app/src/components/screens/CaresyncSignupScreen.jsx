import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function CaresyncSignupScreen({ onNavigateNext, onOpenScreen }) {
  const { loginWithToken } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreed, setAgreed] = useState(true);

  const handleSubmit = (e) => {
    e.preventDefault();
    loginWithToken('demo-jwt-token-fitsure', {
      phone: '+15558392041',
      fullName: 'CareSync Member',
      email: email || 'patient@caresync.health',
      wellnessScore: 91,
    });
    onOpenScreen?.('today');
  };

  return (
    <div className="w-full max-w-[430px] mx-auto min-h-full flex-1 bg-white text-slate-800 flex flex-col justify-between font-sans select-none">
      {/* Top Bar */}
      <div className="pt-3 px-6 pb-2 flex justify-between items-center bg-white z-20">
        <button
          type="button"
          onClick={() => onOpenScreen?.('auth')}
          aria-label="Go back"
          className="w-9 h-9 rounded-full bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700 hover:bg-lime-50 transition-colors"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>

        <div className="flex items-center gap-1.5 bg-lime-50 px-3 py-1 rounded-full border border-lime-200">
          <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
          <span className="text-xs font-semibold text-slate-800 tracking-wide">CareSync Mode</span>
        </div>

        <button
          type="button"
          onClick={() => onOpenScreen?.('signup_dedicated')}
          className="text-xs font-bold text-lime-700 hover:underline"
        >
          Detailed
        </button>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto px-6 pt-2 pb-6 flex flex-col justify-between">
        <div>
          {/* Title Header */}
          <div className="mb-6 text-center">
            <div className="inline-flex items-center justify-center gap-1.5 px-2.5 py-1 mb-2 bg-slate-50 border border-slate-100 rounded-lg">
              <span className="material-symbols-outlined text-[16px] text-emerald-600">health_and_safety</span>
              <span className="text-[11px] font-bold tracking-wider uppercase text-slate-700">FITsure Telemetry</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Sign up</h1>
            <p className="text-xs text-slate-500 mt-1 px-4 leading-relaxed">
              Connect your clinical telemetry & personal health guardian
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="caresync-email">
                Email Address
              </label>
              <div className="relative rounded-2xl shadow-xs">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                </div>
                <input
                  id="caresync-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your Email Address"
                  required
                  className="block w-full rounded-2xl border border-slate-200 pl-10 pr-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#84cc16] focus:ring-2 focus:ring-lime-100 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="caresync-pass">
                Password
              </label>
              <div className="relative rounded-2xl shadow-xs">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">lock</span>
                </div>
                <input
                  id="caresync-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Create Password"
                  required
                  className="block w-full rounded-2xl border border-slate-200 pl-10 pr-10 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#84cc16] focus:ring-2 focus:ring-lime-100 focus:outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-slate-400 hover:text-slate-600"
                >
                  <span className="material-symbols-outlined text-[18px]">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5" htmlFor="caresync-confirm-pass">
                Confirm Password
              </label>
              <div className="relative rounded-2xl shadow-xs">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3.5 text-slate-400">
                  <span className="material-symbols-outlined text-[18px]">lock_reset</span>
                </div>
                <input
                  id="caresync-confirm-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat your password"
                  required
                  className="block w-full rounded-2xl border border-slate-200 pl-10 pr-4 py-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-[#84cc16] focus:ring-2 focus:ring-lime-100 focus:outline-none transition-all"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                id="agree"
                type="checkbox"
                checked={agreed}
                onChange={(e) => setAgreed(e.target.checked)}
                className="rounded border-slate-300 text-lime-600 focus:ring-lime-500 h-4 w-4"
              />
              <label htmlFor="agree" className="text-[11px] text-slate-600">
                I agree to the <span className="text-lime-700 font-bold underline">Terms of Service</span> and <span className="text-lime-700 font-bold underline">HIPAA Data Policy</span>
              </label>
            </div>

            <button
              type="submit"
              className="w-full mt-2 py-3.5 px-4 bg-[#84cc16] hover:bg-[#78b814] active:scale-[0.98] transition-all text-neutral-900 font-bold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Continue</span>
              <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </button>
          </form>

          {/* Social Sign up buttons */}
          <div className="mt-6">
            <div className="relative flex py-2 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-slate-400 text-[11px]">Or continue with</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-3">
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <span>Google</span>
              </button>
              <button
                type="button"
                className="flex items-center justify-center gap-2 py-2.5 px-3 border border-slate-200 rounded-xl hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <span>Apple</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center pt-4">
          <p className="text-xs text-slate-500">
            Already have an account?{' '}
            <button
              type="button"
              onClick={() => onOpenScreen?.('auth')}
              className="text-lime-700 font-bold hover:underline"
            >
              Sign In
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}

