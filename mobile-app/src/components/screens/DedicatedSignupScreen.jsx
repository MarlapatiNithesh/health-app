import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export default function DedicatedSignupScreen({ onNavigateNext, onOpenScreen }) {
  const { loginWithToken } = useAuth();
  const [fullName, setFullName] = useState('Sajibur Rahman');
  const [email, setEmail] = useState('sajibur@example.com');
  const [phone, setPhone] = useState('(555) 839-2041');
  const [selectedGoal, setSelectedGoal] = useState('metabolic');
  const [syncEnabled, setSyncEnabled] = useState(true);
  const [termsAccepted, setTermsAccepted] = useState(true);

  const handleCompleteSignup = (destination = 'today') => {
    loginWithToken('demo-jwt-token-fitsure', {
      phone: phone || '+15558392041',
      fullName: fullName || 'Sajibur Rahman',
      email: email || 'sajibur@example.com',
      wellnessScore: 91,
    });
    if (destination === 'today') {
      onOpenScreen?.('today');
    } else if (onNavigateNext) {
      onNavigateNext();
    } else {
      onOpenScreen?.('baseline_setup');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleCompleteSignup('today');
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-full flex-1 bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between overflow-x-hidden font-sans select-none">
      {/* Top Header */}
      <header className="shrink-0 w-full z-40 bg-white/80 backdrop-blur-xl shadow-xs border-b border-slate-100">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreen?.('auth')}
              aria-label="Go back"
              className="w-10 h-10 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-800 transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <h1 className="text-[17px] font-bold text-slate-900">Signup</h1>
          </div>
          <div className="w-8 h-8 rounded-full bg-[#ecfccb] border border-[#d9f99d] flex items-center justify-center text-[#4d7c0f]">
            <span className="material-symbols-outlined text-[18px]">help_outline</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative w-full px-4 pt-3 pb-24 overflow-y-auto">
        <div className="flex flex-col w-full pb-4">
          {/* Progress / Step Badge */}
          <div className="flex items-center justify-between mb-2">
            <span className="px-3 py-1 rounded-full bg-[#f7fee7] border border-[#d9f99d] text-[#3f6212] font-semibold text-xs flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
              Step 1 of 3: Core Identity
            </span>
            <span className="text-xs font-bold text-slate-400">33% Complete</span>
          </div>

          <h2 className="text-[24px] leading-tight text-slate-900 font-extrabold tracking-tight mt-1 mb-1">
            Create Your FITsure Account
          </h2>
          <p className="text-[13px] text-slate-500 mb-4">
            Initialize your clinical profile, primary health vector, and secure patient vault.
          </p>

          <form onSubmit={handleSubmit} className="space-y-3.5">
            {/* Input Card: Full Legal Name */}
            <div className="bg-white border border-[#edf2e6] rounded-2xl p-3.5 shadow-xs focus-within:border-[#84cc16] focus-within:ring-1 focus-within:ring-[#84cc16] transition-all">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Full Legal Name
              </label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f7fee7] border border-[#ecfccb] flex items-center justify-center text-[#4d7c0f] shrink-0">
                  <span className="material-symbols-outlined text-[18px]">person</span>
                </div>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="e.g., Sajibur Rahman"
                  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Input Card: Clinical Email */}
            <div className="bg-white border border-[#edf2e6] rounded-2xl p-3.5 shadow-xs focus-within:border-[#84cc16] focus-within:ring-1 focus-within:ring-[#84cc16] transition-all">
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <span className="text-[11px] font-bold text-[#4d7c0f] flex items-center gap-0.5">
                  <span className="material-symbols-outlined text-[13px]">verified</span> Verified
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f7fee7] border border-[#ecfccb] flex items-center justify-center text-[#4d7c0f] shrink-0">
                  <span className="material-symbols-outlined text-[18px]">mail</span>
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="e.g., sajibur@example.com"
                  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  required
                />
                <div className="w-6 h-6 rounded-full bg-[#bef264] flex items-center justify-center text-[#1a2e05] shrink-0">
                  <span className="material-symbols-outlined text-[15px] font-bold">check</span>
                </div>
              </div>
            </div>

            {/* Input Card: Mobile Number */}
            <div className="bg-white border border-[#edf2e6] rounded-2xl p-3.5 shadow-xs focus-within:border-[#84cc16] focus-within:ring-1 focus-within:ring-[#84cc16] transition-all">
              <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Mobile Number
              </label>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-[#f7fee7] border border-[#ecfccb] flex items-center justify-center text-[#4d7c0f] shrink-0">
                  <span className="material-symbols-outlined text-[18px]">phone_iphone</span>
                </div>
                <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-[13px] font-bold text-slate-800 shrink-0 border border-slate-200">
                  <span>🇺🇸</span>
                  <span>+1</span>
                  <span className="material-symbols-outlined text-[15px] text-slate-400">expand_more</span>
                </div>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="(555) 000-0000"
                  className="w-full bg-transparent text-[15px] font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  required
                />
              </div>
            </div>

            {/* Health Goal Selection */}
            <div className="mt-2">
              <div className="flex items-center justify-between mb-2 px-1">
                <label className="text-[14px] font-bold text-slate-900">Primary Health Goal</label>
                <span className="text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">Select 1</span>
              </div>
              <div className="flex flex-col gap-2.5">
                {/* Goal 1 */}
                <button
                  type="button"
                  onClick={() => setSelectedGoal('metabolic')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between shadow-xs ${
                    selectedGoal === 'metabolic'
                      ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                      : 'bg-white border-[#edf2e6] hover:border-[#bef264]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                      selectedGoal === 'metabolic' ? 'bg-[#bef264] text-[#1a2e05]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">glucose</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900 leading-tight">Metabolic & Glucose Balance</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">Continuous glycemic curve stabilization</div>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    selectedGoal === 'metabolic' ? 'bg-[#84cc16] text-[#0f1d03]' : 'bg-slate-200 text-transparent'
                  }`}>
                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                  </div>
                </button>

                {/* Goal 2 */}
                <button
                  type="button"
                  onClick={() => setSelectedGoal('weight')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between shadow-xs ${
                    selectedGoal === 'weight'
                      ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                      : 'bg-white border-[#edf2e6] hover:border-[#bef264]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                      selectedGoal === 'weight' ? 'bg-[#bef264] text-[#1a2e05]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">monitor_weight</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900 leading-tight">Weight & Calorie Pacing</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">Adaptive macro partitioning & burn rate</div>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    selectedGoal === 'weight' ? 'bg-[#84cc16] text-[#0f1d03]' : 'bg-slate-200 text-transparent'
                  }`}>
                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                  </div>
                </button>

                {/* Goal 3 */}
                <button
                  type="button"
                  onClick={() => setSelectedGoal('cardio')}
                  className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between shadow-xs ${
                    selectedGoal === 'cardio'
                      ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                      : 'bg-white border-[#edf2e6] hover:border-[#bef264]'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-xs ${
                      selectedGoal === 'cardio' ? 'bg-[#bef264] text-[#1a2e05]' : 'bg-slate-100 text-slate-500'
                    }`}>
                      <span className="material-symbols-outlined text-[20px]">cardiology</span>
                    </div>
                    <div>
                      <div className="text-[14px] font-bold text-slate-900 leading-tight">Heart Rhythm & BP Watch</div>
                      <div className="text-[12px] text-slate-500 mt-0.5">Resting heart rate, HRV & arterial tension</div>
                    </div>
                  </div>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                    selectedGoal === 'cardio' ? 'bg-[#84cc16] text-[#0f1d03]' : 'bg-slate-200 text-transparent'
                  }`}>
                    <span className="material-symbols-outlined text-[16px] font-bold">check</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Wearables Auto-Sync Card */}
            <div className="mt-2 p-4 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] shadow-xs">
              <div className="flex items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#bef264] border border-[#a3e635] flex items-center justify-center text-[#1a2e05] shrink-0 shadow-xs">
                    <span className="material-symbols-outlined text-[22px]">vital_signs</span>
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[14px] font-bold text-slate-900">Apple Health & Google Fit</span>
                      <span className="px-2 py-0.5 rounded-full bg-[#bef264] text-[#1a2e05] text-[11px] font-bold border border-[#a3e635]">Auto</span>
                    </div>
                    <p className="text-[12px] text-slate-600 mt-1 leading-snug">
                      Automatically import steps, sleep stages, BPM telemetry & continuous glucose updates.
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setSyncEnabled(!syncEnabled)}
                  aria-label="Toggle wearable sync"
                  className={`w-12 h-7 rounded-full p-0.5 flex items-center transition-colors shadow-inner shrink-0 mt-0.5 ${
                    syncEnabled ? 'bg-[#84cc16]' : 'bg-slate-300'
                  }`}
                >
                  <div className={`w-6 h-6 rounded-full bg-white shadow-sm transform transition-transform flex items-center justify-center ${
                    syncEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}>
                    <span className="material-symbols-outlined text-[14px] text-[#4d7c0f]">sync</span>
                  </div>
                </button>
              </div>

              <div className="mt-3 pt-2.5 flex items-center justify-between bg-white/80 rounded-xl px-3 py-2 border border-[#ecfccb]">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-[15px] text-[#65a30d]">sensors</span>
                  <span className="text-[11px] text-slate-800 font-medium">Ready for real-time background sync</span>
                </div>
                <span className="text-[11px] text-[#4d7c0f] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[13px]">lock</span>
                  Encrypted
                </span>
              </div>
            </div>

            {/* Legal Terms Checkbox */}
            <div className="flex items-start gap-3 px-1 mt-2">
              <button
                type="button"
                onClick={() => setTermsAccepted(!termsAccepted)}
                aria-label="Agree to terms"
                className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors shadow-xs ${
                  termsAccepted ? 'bg-[#84cc16] text-[#0f1d03]' : 'bg-slate-200 text-transparent'
                }`}
              >
                <span className="material-symbols-outlined text-[16px] font-bold">check</span>
              </button>
              <label className="text-[12px] text-slate-600 leading-relaxed select-none">
                I agree to FITsure's <button type="button" className="text-[#4d7c0f] font-bold underline underline-offset-2">Clinical Terms</button>, <button type="button" className="text-[#4d7c0f] font-bold underline underline-offset-2">HIPAA Privacy Rule</button>, and encrypted biometric storage.
              </label>
            </div>

            {/* Primary Submit Button */}
            <button
              type="submit"
              className="mt-3 w-full py-4 px-6 rounded-full bg-[#97E432] hover:bg-[#84cc16] text-[#132205] font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-lg shadow-[#84cc16]/25 transition-all active:scale-[0.99] cursor-pointer"
            >
              <span>Create Account & Go to Today Dashboard</span>
              <span className="material-symbols-outlined text-[18px] font-bold">arrow_forward</span>
            </button>

            <div className="flex items-center justify-center gap-1.5 text-center mt-2">
              <button
                type="button"
                onClick={() => handleCompleteSignup('baseline_setup')}
                className="text-[12px] text-slate-600 font-semibold hover:text-[#365314] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <span>Or calibrate baseline vitals first</span>
                <span className="material-symbols-outlined text-[14px]">tune</span>
              </button>
            </div>
          </form>

          {/* Sign In Link */}
          <div className="mt-4 text-center">
            <p className="text-[13px] text-slate-600">
              Already have an account? 
              <button
                type="button"
                onClick={() => onOpenScreen?.('auth')}
                className="text-[13px] text-[#4d7c0f] font-bold hover:underline ml-1 cursor-pointer"
              >
                Sign In
              </button>
            </p>
          </div>

          {/* 256-Bit HIPAA Encrypted Trust Banner */}
          <div className="mt-4 p-3 rounded-2xl bg-slate-50 border border-slate-200 flex flex-col items-center justify-center gap-1">
            <div className="flex items-center gap-1.5 text-[#365314]">
              <span className="material-symbols-outlined text-[17px] text-[#65a30d]">verified_user</span>
              <span className="text-[11px] uppercase tracking-wider font-bold">256-Bit HIPAA Encrypted Protocol</span>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-x-2 text-center text-[11px] text-slate-500">
              <span>SOC2 Type II Certified</span>
              <span>•</span>
              <span>End-to-End Vault</span>
              <span>•</span>
              <span>BAA Signed</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

