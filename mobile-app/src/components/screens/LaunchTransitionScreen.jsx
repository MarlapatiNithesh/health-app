import React from 'react';

export default function LaunchTransitionScreen({ onLaunchDashboard, onOpenScreen }) {
  const handleLaunch = () => {
    if (onLaunchDashboard) {
      onLaunchDashboard();
    } else if (onOpenScreen) {
      onOpenScreen('today');
    }
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-full flex-1 bg-[#f8fafc] text-slate-900 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Ambient Glows */}
      <div className="absolute -top-16 -right-16 w-72 h-72 rounded-full pointer-events-none blur-3xl opacity-60 bg-gradient-to-br from-[#ecfccb] to-transparent"></div>
      <div className="absolute top-96 -left-20 w-64 h-64 rounded-full pointer-events-none blur-3xl opacity-50 bg-gradient-to-br from-[#bef264] to-transparent"></div>

      {/* Navigation Header */}
      <header className="flex items-center justify-between pt-3 pb-2 px-4 relative z-10 flex-shrink-0">
        <button
          type="button"
          onClick={() => onOpenScreen?.('wearable_sync')}
          aria-label="Go back"
          className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-700"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>

        <div className="inline-flex items-center space-x-2 bg-white/95 backdrop-blur-md px-3.5 py-1.5 rounded-full shadow-xs border border-[#d9f99d]">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#84cc16]"></span>
          </span>
          <span className="text-[11px] tracking-wider text-[#365314] font-bold uppercase">
            SETUP COMPLETE • READY TO LAUNCH
          </span>
        </div>

        <button
          type="button"
          onClick={() => onOpenScreen?.('profile')}
          aria-label="Profile"
          className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-700"
        >
          <span className="material-symbols-outlined text-[20px]">person</span>
        </button>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto px-4 pb-28 space-y-3 relative z-10">
        {/* User Profile Sync Bar */}
        <div className="flex items-center justify-between p-3 bg-white rounded-2xl shadow-xs border border-slate-100 mt-1">
          <div className="flex items-center space-x-3 min-w-0">
            <div className="relative flex-shrink-0">
              <div className="w-10 h-10 rounded-full bg-lime-100 text-lime-900 font-bold flex items-center justify-center ring-2 ring-[#ecfccb] shadow-xs text-sm">
                SR
              </div>
              <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-[#84cc16] rounded-full flex items-center justify-center ring-2 ring-white">
                <span className="material-symbols-outlined text-[9px] text-white font-bold">check</span>
              </div>
            </div>
            <div className="min-w-0">
              <div className="text-[14px] font-bold text-slate-900 truncate">Sajibur Rahman</div>
              <div className="text-[11px] text-slate-500 flex items-center space-x-1.5 truncate">
                <span>Biometric Baseline Synced</span>
                <span className="inline-block w-1 h-1 rounded-full bg-[#84cc16]"></span>
                <span className="text-[#365314] font-semibold">100% Calibrated</span>
              </div>
            </div>
          </div>
          <div className="px-2.5 py-1 bg-[#f7fee7] border border-[#d9f99d] rounded-full flex-shrink-0">
            <span className="text-[11px] text-[#365314] font-semibold tracking-tight">ID #8420-SR</span>
          </div>
        </div>

        {/* Hero Card: Telemetry Bridge Synchronized */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-white via-[#f7fee7]/80 to-[#ecfccb]/50 p-5 shadow-xs border border-[#d9f99d]/80 flex flex-col items-center text-center">
          <div className="relative flex items-center justify-center my-2">
            <div className="w-16 h-16 rounded-full bg-[#84cc16] flex items-center justify-center shadow-lg shadow-lime-400/40 text-black">
              <span className="material-symbols-outlined text-[32px] font-bold">done_all</span>
            </div>
          </div>

          <h2 className="text-[20px] font-black text-slate-900 tracking-tight mt-1">
            Telemetry Handoff Active
          </h2>
          <p className="text-[12px] text-slate-600 mt-1 max-w-xs leading-relaxed">
            Continuous glucose curve, cardiac watch, and AI OCR dietary guardrails are connected and live.
          </p>

          <div className="grid grid-cols-2 gap-2 w-full mt-4">
            <div className="bg-white rounded-2xl p-2.5 text-left border border-slate-100 shadow-xs">
              <div className="flex items-center gap-1.5 text-[#365314] text-[11px] font-bold">
                <span className="material-symbols-outlined text-[15px] text-[#84cc16]">sensors</span>
                Wearable Link
              </div>
              <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">3 Sensors Online</div>
              <div className="text-[10px] text-slate-400">Apple Health, Dexcom G7</div>
            </div>

            <div className="bg-white rounded-2xl p-2.5 text-left border border-slate-100 shadow-xs">
              <div className="flex items-center gap-1.5 text-[#365314] text-[11px] font-bold">
                <span className="material-symbols-outlined text-[15px] text-[#84cc16]">shield</span>
                Guardian Alert
              </div>
              <div className="text-[13px] font-extrabold text-slate-900 mt-0.5">Sarah R. (Active)</div>
              <div className="text-[10px] text-slate-400">&lt;3s dispatch armed</div>
            </div>
          </div>
        </div>

        {/* Incoming Daily Dashboard Preview */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center space-x-1.5">
              <span className="material-symbols-outlined text-[17px] text-[#4d7c0f]">space_dashboard</span>
              <h2 className="text-[14px] font-bold text-slate-900">Incoming Daily Dashboard</h2>
            </div>
            <span className="text-[10px] bg-[#ecfccb] text-[#365314] border border-[#d9f99d] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
              Preview
            </span>
          </div>

          <div className="rounded-3xl bg-white p-3.5 shadow-xs border border-slate-100 space-y-3">
            <div className="flex items-center justify-between bg-[#f8fafc] border border-slate-100 rounded-2xl p-2.5">
              <div className="flex items-center space-x-2.5 min-w-0">
                <div className="w-7 h-7 rounded-full bg-[#ecfccb] border border-[#d9f99d] flex items-center justify-center text-[#365314] flex-shrink-0">
                  <span className="material-symbols-outlined text-[16px]">psychology</span>
                </div>
                <div className="min-w-0">
                  <div className="text-[12px] text-slate-900 font-bold truncate">MediBot Clinical Guardian</div>
                  <div className="text-[11px] text-slate-500 truncate">Vitals baseline locked • No alerts</div>
                </div>
              </div>
              <span className="material-symbols-outlined text-[#4d7c0f] text-[18px] flex-shrink-0" style={{ fontVariationSettings: "'FILL' 1" }}>
                check_circle
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="p-2.5 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex flex-col justify-between">
                <span className="text-[10px] text-[#365314] font-semibold uppercase tracking-tight">Caloric Target</span>
                <div className="text-[17px] font-extrabold text-slate-900 leading-tight mt-1">1,920</div>
                <span className="text-[10px] text-[#4d7c0f] font-medium">kcal daily</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#f0f9ff] border border-[#bae6fd] flex flex-col justify-between">
                <span className="text-[10px] text-[#0369a1] font-semibold uppercase tracking-tight">Step Target</span>
                <div className="text-[17px] font-extrabold text-slate-900 leading-tight mt-1">5,500</div>
                <span className="text-[10px] text-[#0284c7] font-medium">steps pacing</span>
              </div>
              <div className="p-2.5 rounded-2xl bg-[#fff7ed] border border-[#fed7aa] flex flex-col justify-between">
                <span className="text-[10px] text-[#c2410c] font-semibold uppercase tracking-tight">Hydration</span>
                <div className="text-[17px] font-extrabold text-slate-900 leading-tight mt-1">
                  12 <span className="text-[11px] font-normal text-slate-500">gls</span>
                </div>
                <span className="text-[10px] text-[#ea580c] font-medium">optimal tier</span>
              </div>
            </div>
          </div>
        </div>

        {/* Security badge */}
        <div className="rounded-2xl bg-white border border-slate-100 p-2.5 shadow-xs flex items-center justify-center space-x-2 text-center">
          <span className="material-symbols-outlined text-[16px] text-[#4d7c0f]" style={{ fontVariationSettings: "'FILL' 1" }}>
            security
          </span>
          <span className="text-[10px] font-semibold text-slate-600 tracking-tight">
            256-BIT HIPAA ENCRYPTED SENSOR BRIDGE • SOC2 Certified
          </span>
        </div>
      </main>

      {/* Sticky Bottom Bar */}
      <div className="w-full px-4 pt-2 pb-4 space-y-2 bg-white/95 backdrop-blur-md border-t border-slate-100 flex-shrink-0 z-20">
        <button
          type="button"
          onClick={handleLaunch}
          className="w-full py-4 px-6 rounded-full text-slate-900 font-extrabold text-[15px] shadow-lg shadow-[#84cc16]/25 flex items-center justify-center space-x-2 active:scale-[0.98] transition-all bg-[#84cc16] hover:bg-[#78b814] cursor-pointer"
        >
          <span>Enter Daily Health Dashboard</span>
          <span className="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
        </button>
      </div>
    </div>
  );
}

