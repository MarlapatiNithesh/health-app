import React, { useState, useEffect } from 'react';

export default function EmergencyCrisisScreen({ onBack, onOpenScreen }) {
  const [seconds, setSeconds] = useState(5);
  const [dispatched, setDispatched] = useState(false);
  const [sirenActive, setSirenActive] = useState(true);

  useEffect(() => {
    if (seconds > 0) {
      const timer = setTimeout(() => setSeconds(seconds - 1), 1000);
      return () => clearTimeout(timer);
    } else {
      setDispatched(true);
    }
  }, [seconds]);

  const handleCancel = () => {
    if (onBack) onBack();
    else if (onOpenScreen) onOpenScreen('home');
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-red-100 flex items-center justify-between px-4 h-16 shadow-xs">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCancel}
            aria-label="Cancel SOS"
            className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-800"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div className="flex flex-col">
            <h1 className="text-base font-bold text-red-600 leading-tight">Live Emergency SOS</h1>
            <span className="text-[11px] text-slate-500">Continuous Crisis Relay</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSirenActive(!sirenActive)}
            className={`w-9 h-9 rounded-full flex items-center justify-center shadow-xs transition-colors ${
              sirenActive ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-200 text-slate-600'
            }`}
          >
            <span className="material-symbols-outlined text-[18px]">
              {sirenActive ? 'volume_up' : 'volume_off'}
            </span>
          </button>
          <a
            href="tel:911"
            className="px-3 py-1.5 rounded-full bg-red-600 text-white font-extrabold text-xs shadow-md flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-[15px]">e911_emergency</span>
            <span>911</span>
          </a>
        </div>
      </header>

      {/* Main Crisis Body */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5">
        {/* Priority 1 Alert Header */}
        <div className="bg-red-600 rounded-2xl p-3.5 text-white shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
            </span>
            <div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-red-100">Priority Level 1</span>
              <h2 className="text-[14px] font-black leading-tight">CODE RED · CRITICAL VITALS</h2>
            </div>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-red-700 text-white font-bold text-[10px]">Active</span>
        </div>

        {/* Circular Gauge Countdown */}
        <div className="bg-white rounded-3xl p-5 shadow-xs border border-red-100 flex flex-col items-center text-center">
          <div className="relative w-36 h-36 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
              <circle cx="60" cy="60" r="50" fill="none" stroke="#fee2e2" strokeWidth="8" />
              <circle
                cx="60"
                cy="60"
                r="50"
                fill="none"
                stroke="#dc2626"
                strokeWidth="8"
                strokeDasharray="314.159"
                strokeDashoffset={dispatched ? 0 : (314.159 * (seconds / 5))}
                strokeLinecap="round"
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[10px] uppercase font-bold text-red-600">
                {dispatched ? 'Dispatched' : 'Auto Dispatch In'}
              </span>
              <span className="text-3xl font-black text-red-600 leading-tight">
                {dispatched ? 'EMS ON' : `${seconds}s`}
              </span>
              <span className="text-[10px] text-slate-500 font-semibold">911 & CloseOne</span>
            </div>
          </div>

          <div className="w-full rounded-full bg-red-50 text-red-700 px-3 py-1.5 flex items-center justify-center gap-1.5 text-xs font-semibold mt-3">
            <span className="material-symbols-outlined text-[16px] animate-bounce">vibration</span>
            <span>High-Decibel Siren Active · DND Overridden</span>
          </div>

          {/* Rapid Drop Glucose Alert */}
          <div className="w-full rounded-2xl bg-red-50/70 p-3 text-left mt-3 border border-red-200">
            <div className="flex items-start gap-2.5">
              <div className="w-8 h-8 rounded-full bg-red-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                <span className="material-symbols-outlined text-[18px]">monitor_heart</span>
              </div>
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-600 text-white font-bold">
                    CRITICAL HYPOGLYCEMIA
                  </span>
                  <span className="text-[10px] text-slate-500 font-bold">Dexcom G7</span>
                </div>
                <div className="flex items-baseline gap-2 mt-1">
                  <span className="text-2xl font-black text-red-600 leading-none">52</span>
                  <span className="text-xs font-bold text-slate-500">mg/dL</span>
                  <span className="text-xs font-black text-red-600 ml-1">↓↓ -3.4 mg/dL/min</span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 leading-snug">
                  Vitals dropped past critical 55 mg/dL threshold without motion acknowledgment.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Live GPS Telemetry Relay Card */}
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[18px] text-red-600">location_on</span>
              <h3 className="text-xs font-bold text-slate-900">Live Paramedic Coordinates</h3>
            </div>
            <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              GPS ±3m Lock
            </span>
          </div>
          <div className="bg-slate-50 p-2.5 rounded-2xl text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-slate-500">Coordinates:</span>
              <strong className="text-slate-800">37.7749° N, 122.4194° W</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Address:</span>
              <strong className="text-slate-800">742 Evergreen Terrace, Apt 4B</strong>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Medical ID:</span>
              <strong className="text-slate-800">Blood A+ · Penicillin Allergy</strong>
            </div>
          </div>
        </div>

        {/* Emergency Contacts Relay */}
        <div className="space-y-2">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
            Automated Responders Notified
          </h3>

          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-800 font-bold flex items-center justify-center text-xs">
                SR
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Sarah Rahman (Spouse)</h4>
                <p className="text-[10px] text-slate-500">Auto-Call & Live Location SMS Transmitted</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
              Delivered
            </span>
          </div>

          <div className="bg-white p-3 rounded-2xl border border-slate-100 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-sky-100 text-sky-800 font-bold flex items-center justify-center text-xs">
                DC
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Dr. Michael Chen, MD</h4>
                <p className="text-[10px] text-slate-500">Hospital On-Call Telemetry Page Dispatched</p>
              </div>
            </div>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
              Dispatched
            </span>
          </div>
        </div>

        {/* Cancel False Alarm Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleCancel}
            className="w-full py-3.5 bg-slate-900 hover:bg-black text-white font-black text-xs rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">cancel</span>
            <span>I Am Safe · Cancel Emergency Alarm</span>
          </button>
        </div>
      </main>
    </div>
  );
}

