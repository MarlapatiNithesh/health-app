import React, { useState } from 'react';

export default function GuardianSetupScreen({ onOpenScreen, onOpenSos }) {
  const [toastMessage, setToastMessage] = useState('');
  const [sarahAlerts, setSarahAlerts] = useState(true);
  const [doctorAlerts, setDoctorAlerts] = useState(true);
  const [autoDispatch, setAutoDispatch] = useState(true);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 2500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#f9faf7] text-[#16240d] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* App Header */}
      <header className="sticky top-0 z-40 bg-[#f9faf7]/90 backdrop-blur-md border-b border-[#edf2e6]/70 shrink-0">
        <div className="flex items-center justify-between px-5 h-16">
          <button
            type="button"
            onClick={() => onOpenScreen?.('more')}
            aria-label="Go back"
            className="w-10 h-10 rounded-full bg-white border border-[#e8efe0] flex items-center justify-center text-[#16240d] shadow-xs active:scale-95 transition-transform"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="text-center">
            <h1 className="text-[17px] font-bold text-[#16240d] tracking-tight">CloseOne Guardian</h1>
            <p className="text-[11px] font-semibold text-[#6a795f]">Safety & Emergency Circle</p>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#eaf8d6] border border-[#d6f0b0] shadow-xs">
            <span className="w-2 h-2 rounded-full bg-[#7ec416] animate-pulse"></span>
            <span className="text-[10px] font-bold text-[#2d5209] uppercase tracking-wide">Live</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col px-5 pt-3 pb-28 space-y-4 max-w-md mx-auto w-full overflow-y-auto">
        {/* Hero Card: Safety Status Summary */}
        <div className="relative overflow-hidden rounded-[26px] p-4.5 bg-gradient-to-br from-[#dcf4b8] via-[#d0f0a5] to-[#c1ea8e] border border-[#cbeaa0] shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-white/90 backdrop-blur-xs flex items-center justify-center text-[#214304] shadow-xs">
                <span className="material-symbols-outlined text-[22px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  health_and_safety
                </span>
              </div>
              <div>
                <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/70 text-[#254705] text-[10px] font-bold uppercase tracking-wider mb-0.5">
                  <span className="material-symbols-outlined text-[11px] text-[#254705]">bolt</span> &lt;3s Dispatch
                </div>
                <h2 className="text-[16px] font-extrabold text-[#172d05] leading-tight">Instant Guardian Shield</h2>
              </div>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-[#1b3306] text-[#cbf492] text-[11px] font-bold">
              2 Enrolled
            </div>
          </div>
          <p className="text-[12px] text-[#2f4912] font-medium mt-2.5 leading-snug">
            Guardians receive instant automated SMS & calls if biometrics or daily medications breach safe limits.
          </p>
        </div>

        {/* Active Guardians List */}
        <div className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Designated Emergency Circle</h3>
            <button
              type="button"
              onClick={() => showToast('Select contact to add to Guardian Circle')}
              className="text-xs font-bold text-lime-700 hover:underline"
            >
              + Add Guardian
            </button>
          </div>

          {/* Contact 1: Sarah */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#edf2e6] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-rose-100 text-rose-800 font-black flex items-center justify-center text-sm">
                SR
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Sarah Rahman (Spouse)</h4>
                  <span className="px-1.5 py-0.2 bg-[#eaf8d6] text-[#2d5209] text-[9px] font-black rounded-full">
                    Primary
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">+1 (555) 302-9182 · SMS & Voice Dispatch</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setSarahAlerts(!sarahAlerts)}
              className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                sarahAlerts ? 'bg-[#84cc16]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                sarahAlerts ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>

          {/* Contact 2: Dr. Chen */}
          <div className="p-3.5 rounded-2xl bg-white border border-[#edf2e6] shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-sky-100 text-sky-800 font-black flex items-center justify-center text-sm">
                DC
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-slate-900">Dr. Michael Chen</h4>
                  <span className="px-1.5 py-0.2 bg-sky-100 text-sky-800 text-[9px] font-black rounded-full">
                    Cardiologist
                  </span>
                </div>
                <p className="text-[11px] text-slate-500">Memorial Clinical Portal Relay</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDoctorAlerts(!doctorAlerts)}
              className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                doctorAlerts ? 'bg-[#84cc16]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                doctorAlerts ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>
        </div>

        {/* Live Simulation Alert Card */}
        <div className="p-3.5 rounded-2xl bg-white border border-[#e6efe0] shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <span className="w-4 h-4 rounded-full bg-red-100 text-red-600 flex items-center justify-center text-[10px] font-black">
                !
              </span>
              <span className="text-[12px] font-bold text-[#16240d]">FitSure SafeLink Dispatch Preview</span>
            </div>
            <span className="text-[10px] font-semibold text-slate-400">Simulation</span>
          </div>
          <p className="text-[12px] text-slate-600 leading-snug">
            Sajibur's <strong>2:00 PM Atorvastatin 20mg</strong> was missed by 35m. Vitals: HR 78 bpm, BP 120/80.
          </p>
          <div className="pt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenSos || (() => onOpenScreen?.('sos'))}
              className="flex-1 py-1.5 px-3 rounded-full bg-[#97E432] text-[#142804] text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs"
            >
              <span className="material-symbols-outlined text-[14px]">call</span>
              <span>1-Tap Call</span>
            </button>
            <button
              type="button"
              onClick={() => showToast('Caregiver acknowledged alert')}
              className="flex-1 py-1.5 px-3 rounded-full bg-[#f1f5eb] text-slate-700 text-[11px] font-semibold flex items-center justify-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">done_all</span>
              <span>Acknowledge</span>
            </button>
          </div>
        </div>
      </main>

      {/* Bottom Sticky Action Bar */}
      <div className="shrink-0 bg-white/90 backdrop-blur-md border-t border-[#edf2e6] px-5 pt-3 pb-4 space-y-2 z-40">
        <button
          type="button"
          onClick={() => showToast('Guardian settings saved & synchronized')}
          className="w-full py-3.5 px-6 rounded-full bg-[#97E432] hover:bg-[#8ade24] text-[#132604] text-[14px] font-black shadow-md active:scale-[0.98] transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <span className="material-symbols-outlined text-[19px]">verified_user</span>
          <span>Save Guardian Settings</span>
        </button>
        <div className="flex items-center justify-center gap-1.5 text-slate-500">
          <span className="material-symbols-outlined text-[13px] text-lime-600">lock</span>
          <span className="text-[10px] font-medium">256-Bit Encrypted · HIPAA & GDPR Compliant Relay</span>
        </div>
      </div>

      {/* Floating Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-[#17260c] text-white shadow-xl flex items-center gap-2 text-[12px] font-semibold z-50">
          <span className="material-symbols-outlined text-[#97E432] text-[16px]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}

