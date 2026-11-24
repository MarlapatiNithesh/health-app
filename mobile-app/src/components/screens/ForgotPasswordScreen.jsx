import React, { useState } from 'react';

export default function ForgotPasswordScreen({ onOpenScreen }) {
  const [method, setMethod] = useState('email');
  const [email, setEmail] = useState('sajibur.rahman@example.com');
  const [mobile, setMobile] = useState('+1 (555) 839-2041');
  const [mrnOpen, setMrnOpen] = useState(false);
  const [mrn, setMrn] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSendRecovery = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none">
      {/* Top Header */}
      <header className="h-14 px-4 flex items-center justify-between shrink-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100">
        <button
          type="button"
          onClick={() => onOpenScreen?.('auth')}
          aria-label="Back"
          className="w-10 h-10 flex items-center justify-center rounded-full text-slate-800 hover:bg-slate-100 transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-[17px] font-bold tracking-tight text-slate-900">Forgot Password</h1>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-4 pb-20 space-y-4">
        {/* Top Sub-Bar & HIPAA Node */}
        <div className="flex items-center justify-between">
          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-100 shadow-xs">
            <span className="w-2 h-2 rounded-full bg-lime-500 animate-pulse"></span>
            <span className="text-[11px] text-slate-600 uppercase tracking-wider font-semibold">HIPAA Identity Node</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-lime-50 text-lime-800 border border-lime-200">
            <span className="material-symbols-outlined text-[15px]" style={{ fontVariationSettings: "'FILL' 1" }}>verified_user</span>
            <span className="text-[11px] font-bold">Secure Recovery</span>
          </div>
        </div>

        {/* Center Shield Graphic */}
        <div className="flex flex-col items-center justify-center pt-2">
          <div className="relative flex items-center justify-center">
            <div className="absolute w-24 h-24 rounded-full bg-lime-400/30 blur-xl animate-pulse"></div>
            <div className="relative w-20 h-20 rounded-full bg-[#ecfccb] flex items-center justify-center shadow-md">
              <div className="w-14 h-14 rounded-full bg-white/90 backdrop-blur-md flex items-center justify-center shadow-xs">
                <div className="relative flex items-center justify-center">
                  <span className="material-symbols-outlined text-lime-700 text-[28px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                    enhanced_encryption
                  </span>
                  <span className="material-symbols-outlined text-[#365314] text-[13px] absolute -bottom-1 -right-1 bg-[#bef264] rounded-full p-0.5 shadow-xs">
                    key
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Header Typography */}
        <div className="text-center space-y-1">
          <h2 className="text-[22px] font-black text-slate-900 tracking-tight">Reset Password</h2>
          <p className="text-[13px] text-slate-500 max-w-xs mx-auto leading-relaxed">
            Enter your registered clinical email or verified mobile number to receive a secure authorization code.
          </p>
        </div>

        {submitted ? (
          <div className="p-5 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-[#84cc16] text-black mx-auto flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">mark_email_read</span>
            </div>
            <h3 className="text-base font-bold text-slate-900">Recovery Code Dispatched</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              We have transmitted an encrypted 6-digit verification token to <strong>{method === 'email' ? email : mobile}</strong>.
            </p>
            <button
              type="button"
              onClick={() => onOpenScreen?.('auth')}
              className="w-full py-3 bg-[#84cc16] text-neutral-900 font-bold rounded-full text-xs shadow-md mt-2"
            >
              Return to Login & Enter Code
            </button>
          </div>
        ) : (
          <>
            {/* Segmented Glass Pill Switcher */}
            <div className="w-full p-1 bg-slate-100 rounded-full flex items-center gap-1 shadow-inner">
              <button
                type="button"
                onClick={() => setMethod('email')}
                className={`flex-1 py-2 px-3 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  method === 'email'
                    ? 'bg-[#ecfccb] text-[#365314] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">mail</span>
                <span>Email Address</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod('mobile')}
                className={`flex-1 py-2 px-3 rounded-full text-[13px] font-semibold flex items-center justify-center gap-1.5 transition-all ${
                  method === 'mobile'
                    ? 'bg-[#ecfccb] text-[#365314] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span className="material-symbols-outlined text-[16px]">smartphone</span>
                <span>Mobile (SMS)</span>
              </button>
            </div>

            {/* Input Section */}
            <form onSubmit={handleSendRecovery} className="space-y-4">
              {method === 'email' ? (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[12px] text-slate-700 font-bold">Verified Clinical Email</label>
                    <span className="text-[11px] text-lime-700 flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[12px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                      Verified Provider
                    </span>
                  </div>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">alternate_email</span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="doctor.name@hospital.org"
                      required
                      className="w-full pl-11 pr-11 py-3 bg-white rounded-full text-[14px] text-slate-900 shadow-xs border border-slate-200 focus:border-[#84cc16] focus:outline-none"
                    />
                    <div className="absolute right-3.5 flex items-center text-lime-600">
                      <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>check_circle</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[12px] text-slate-700 font-bold px-1">Registered Phone</label>
                  <div className="relative flex items-center">
                    <span className="material-symbols-outlined absolute left-3.5 text-slate-400 text-[18px]">phone</span>
                    <input
                      type="tel"
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      placeholder="+1 (555) 000-0000"
                      required
                      className="w-full pl-11 pr-11 py-3 bg-white rounded-full text-[14px] text-slate-900 shadow-xs border border-slate-200 focus:border-[#84cc16] focus:outline-none"
                    />
                  </div>
                </div>
              )}

              {/* MRN Accordion Trigger */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3.5 transition-all">
                <button
                  type="button"
                  onClick={() => setMrnOpen(!mrnOpen)}
                  className="w-full flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-lime-700 text-[18px]">badge</span>
                    <span className="text-[13px] font-bold text-slate-800">Or verify via MRN (Medical Record Number)</span>
                  </div>
                  <span className={`material-symbols-outlined text-slate-500 text-[18px] transition-transform ${mrnOpen ? 'rotate-180' : ''}`}>
                    expand_more
                  </span>
                </button>

                {mrnOpen && (
                  <div className="mt-3 pt-2 border-t border-slate-200 space-y-2">
                    <label className="text-[11px] text-slate-500 font-semibold">Enter 8-digit hospital MRN</label>
                    <input
                      type="text"
                      value={mrn}
                      onChange={(e) => setMrn(e.target.value)}
                      placeholder="MRN-849204"
                      className="w-full px-3 py-2 bg-white rounded-xl text-xs border border-slate-200"
                    />
                  </div>
                )}
              </div>

              {/* Action Button */}
              <button
                type="submit"
                className="w-full py-3.5 px-6 rounded-full bg-[#97E432] hover:bg-[#84cc16] text-[#132205] font-extrabold text-[15px] flex items-center justify-center gap-2 shadow-md cursor-pointer"
              >
                <span>Send Verification Code</span>
                <span className="material-symbols-outlined text-[18px]">send</span>
              </button>
            </form>
          </>
        )}

        <div className="text-center pt-2">
          <button
            type="button"
            onClick={() => onOpenScreen?.('auth')}
            className="text-xs font-semibold text-slate-600 hover:text-slate-900"
          >
            Remember your credentials? <span className="font-bold text-lime-800 underline">Log In</span>
          </button>
        </div>
      </main>
    </div>
  );
}

