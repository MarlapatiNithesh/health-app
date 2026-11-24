import React, { useState } from 'react';

export default function WearableSyncScreen({ onNavigateNext, onOpenScreen }) {
  const [appleHealthSync, setAppleHealthSync] = useState(true);
  const [appleWatchSync, setAppleWatchSync] = useState(true);
  const [cgmPaired, setCgmPaired] = useState(false);

  const handleLaunch = () => {
    if (onOpenScreen) {
      onOpenScreen('today');
    } else if (onNavigateNext) {
      onNavigateNext();
    }
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-full flex-1 bg-[#f8fafc] text-slate-900 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Bar */}
      <header className="sticky top-0 w-full z-40 bg-[#f8fafc]/90 backdrop-blur-md border-b border-slate-100 flex-shrink-0">
        <div className="h-14 px-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => onOpenScreen?.('baseline_setup')}
            aria-label="Go back"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-white border border-slate-200/80 text-slate-700 shadow-xs hover:bg-slate-50 transition-all"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">Device Sync</h1>
          <button
            type="button"
            className="w-10 h-10 rounded-full flex items-center justify-center bg-[#ecfccb] text-[#365314] border border-[#d9f99d] shadow-xs"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">help</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full px-4 pt-4 pb-28 flex flex-col overflow-y-auto">
        {/* Step Indicator */}
        <div className="flex items-center justify-between gap-2 mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f7fee7] border border-[#bef264] text-[#1a2e05] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#84cc16]"></span>
            </span>
            <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider">
              <span>STEP 3 OF 3</span>
              <span className="text-[#84cc16]">•</span>
              <span className="text-[#365314]">WEARABLES & SENSORS</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 w-20">
            <div className="h-1.5 flex-1 rounded-full bg-[#97E432]"></div>
            <div className="h-1.5 flex-1 rounded-full bg-[#97E432]"></div>
            <div className="h-1.5 flex-1 rounded-full bg-[#97E432]"></div>
          </div>
        </div>

        {/* Headline */}
        <div className="mb-4">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight leading-tight">Connect Your Sensors</h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Link your smart wearables and clinical CGMs for real-time telemetry streaming and autonomous safeguard monitoring.
          </p>
        </div>

        {/* Live Telemetry Pipeline Preview */}
        <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#84cc16]"></span>
              </span>
              <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">Live Telemetry Pipeline</h3>
            </div>
            <span className="text-[10px] font-bold text-[#1a2e05] bg-[#f7fee7] border border-[#bef264] px-2 py-0.5 rounded-full">
              Active Bridge
            </span>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {/* HR */}
            <div className="bg-[#f8fafc] rounded-xl p-2.5 border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-slate-400 mb-1">
                <span className="material-symbols-outlined text-[15px] text-[#84cc16]">ecg_heart</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">HR Stream</span>
              </div>
              <div className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">
                72 <span className="text-[10px] font-semibold text-slate-500">BPM</span>
              </div>
              <div className="mt-1 text-[10px] font-bold text-[#365314] bg-[#ecfccb] px-1.5 py-0.5 rounded-full">
                Steady
              </div>
            </div>

            {/* CGM */}
            <div className="bg-[#f8fafc] rounded-xl p-2.5 border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-slate-400 mb-1">
                <span className="material-symbols-outlined text-[15px] text-[#84cc16]" style={{ fontVariationSettings: "'FILL' 1" }}>water_drop</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">CGM</span>
              </div>
              <div className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">
                94 <span className="text-[10px] font-semibold text-slate-500">mg/dL</span>
              </div>
              <div className="mt-1 flex items-center gap-0.5 text-[10px] font-bold text-[#365314] bg-[#ecfccb] px-1.5 py-0.5 rounded-full">
                <span className="material-symbols-outlined text-[11px] font-bold">trending_flat</span> In Range
              </div>
            </div>

            {/* Recovery */}
            <div className="bg-[#f8fafc] rounded-xl p-2.5 border border-slate-100 flex flex-col items-center justify-center text-center">
              <div className="flex items-center gap-1 text-slate-400 mb-1">
                <span className="material-symbols-outlined text-[15px] text-[#84cc16]">donut_large</span>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Recovery</span>
              </div>
              <div className="text-[16px] font-black text-slate-900 tracking-tight leading-tight">
                88<span className="text-[10px] font-semibold text-slate-500">%</span>
              </div>
              <span className="mt-1 text-[10px] font-bold text-[#365314] bg-[#ecfccb] px-1.5 py-0.5 rounded-full">
                Optimal
              </span>
            </div>
          </div>
        </div>

        {/* Peripherals List */}
        <div className="flex flex-col gap-2.5 mb-4">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Detected & Compatible Sensors</h3>
            <span className="text-[11px] font-bold text-[#365314] bg-[#ecfccb] border border-[#d9f99d] px-2 py-0.5 rounded-full">
              BLE 5.3 Ready
            </span>
          </div>

          {/* Device 1 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center flex-shrink-0 text-[#4d7c0f]">
                <span className="material-symbols-outlined text-[22px]">health_and_safety</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 truncate">Apple Health & Google Fit</h4>
                  <span className="text-[10px] font-bold text-[#1a2e05] bg-[#ecfccb] px-1.5 py-0.2 rounded border border-[#bef264]">Auto-Sync</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">Background step tracking, active energy, sleep architecture & HRV.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAppleHealthSync(!appleHealthSync)}
              className={`w-12 h-7 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
                appleHealthSync ? 'bg-[#84cc16]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-xs transform transition-transform flex items-center justify-center ${
                appleHealthSync ? 'translate-x-5' : 'translate-x-0'
              }`}>
                {appleHealthSync && <span className="material-symbols-outlined text-[13px] text-[#4d7c0f] font-bold">check</span>}
              </div>
            </button>
          </div>

          {/* Device 2 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center flex-shrink-0 text-[#4d7c0f]">
                <span className="material-symbols-outlined text-[22px]">watch</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-sm font-bold text-slate-900 truncate">Apple Watch Series / Ultra</h4>
                  <span className="text-[10px] font-bold text-[#1a2e05] bg-[#ecfccb] px-1.5 py-0.2 rounded border border-[#bef264]">Connected</span>
                </div>
                <p className="text-[11px] text-slate-500 truncate">Direct wrist telemetry, continuous optical HR, arrhythmia detection.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAppleWatchSync(!appleWatchSync)}
              className={`w-12 h-7 rounded-full p-0.5 flex items-center transition-colors shrink-0 ${
                appleWatchSync ? 'bg-[#84cc16]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-6 h-6 rounded-full bg-white shadow-xs transform transition-transform flex items-center justify-center ${
                appleWatchSync ? 'translate-x-5' : 'translate-x-0'
              }`}>
                {appleWatchSync && <span className="material-symbols-outlined text-[13px] text-[#4d7c0f] font-bold">check</span>}
              </div>
            </button>
          </div>

          {/* Device 3 */}
          <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-xs flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center flex-shrink-0 text-[#4d7c0f]">
                <span className="material-symbols-outlined text-[22px]">vital_signs</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="text-sm font-bold text-slate-900 truncate">Continuous Glucose Monitor</h4>
                <p className="text-[11px] text-slate-500 truncate">Dexcom G7, FreeStyle Libre 3, or Abbott Stelo BLE bridge.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCgmPaired(!cgmPaired)}
              className={`px-3 py-1.5 rounded-full text-xs font-bold border transition-all ${
                cgmPaired
                  ? 'bg-[#84cc16] text-black border-[#84cc16]'
                  : 'bg-[#f7fee7] text-[#1a2e05] border-[#84cc16] hover:bg-[#bef264]'
              }`}
            >
              {cgmPaired ? 'Paired' : 'Ready to Pair'}
            </button>
          </div>
        </div>

        {/* Primary CTA */}
        <div className="flex flex-col gap-2 mt-auto">
          <button
            type="button"
            onClick={handleLaunch}
            className="w-full py-4 px-6 rounded-full bg-[#97E432] hover:bg-[#84cc16] text-slate-950 font-black text-base shadow-lg shadow-lime-300/40 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
          >
            <span>Complete Setup & Launch FITsure</span>
            <span className="material-symbols-outlined text-[20px] font-bold">arrow_forward</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenScreen?.('device_diagnostics')}
            className="w-full py-2 text-center text-xs text-slate-500 hover:text-slate-800 font-semibold"
          >
            Run Device Signal Diagnostics
          </button>
        </div>
      </main>
    </div>
  );
}

