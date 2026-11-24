import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export default function HydrationPacingScreen({ onOpenScreen, onOpenSos }) {
  const [glasses, setGlasses] = useState(8);

  useEffect(() => {
    api.getMetabolicSummary()
      .then((res) => {
        if (res?.data?.waterIntakeMl) {
          setGlasses(Math.round(res.data.waterIntakeMl / 250));
        }
      })
      .catch((err) => console.warn('Could not load hydration summary:', err.message));
  }, []);

  const handleUpdateGlasses = (newVal, deltaMl) => {
    setGlasses(newVal);
    if (deltaMl > 0) {
      api.logWater(deltaMl).catch((e) => console.warn('Water log deferred:', e.message));
    }
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#F7F8FC] text-slate-800 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Bar */}
      <section className="px-5 pt-3 pb-2 flex items-center justify-between z-20 flex-shrink-0 bg-white border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => onOpenScreen?.('vitals')}
            className="w-9 h-9 rounded-full bg-white shadow-xs flex items-center justify-center text-slate-700 border border-slate-100"
          >
            <span className="material-symbols-outlined text-[20px]">arrow_back</span>
          </button>
          <div>
            <h1 className="text-base font-bold text-slate-900 tracking-tight leading-tight">Hydration & Activity Pacing</h1>
            <p className="text-[11px] font-medium text-slate-500 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Watch synced today, 09:32
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onOpenSos || (() => onOpenScreen?.('sos'))}
          className="flex items-center space-x-1 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 px-2.5 py-1.5 rounded-full text-xs font-bold shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px] text-red-600">emergency</span>
          <span>SOS</span>
        </button>
      </section>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 pt-3 pb-24 space-y-3.5">
        {/* Hydration Circular Radial Hero Card */}
        <div className="p-5 rounded-3xl bg-white border border-slate-100 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-sky-500">Water Consumption</span>
              <h2 className="text-2xl font-black text-slate-900 leading-tight mt-0.5">
                {(glasses * 0.25).toFixed(2)} <span className="text-sm font-semibold text-slate-400">/ 2.5 L</span>
              </h2>
              <p className="text-xs text-slate-500 mt-1">80% of daily target reached</p>
            </div>

            <div className="relative w-24 h-24 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                <circle cx="50" cy="50" r="40" fill="none" stroke="#e0f2fe" strokeWidth="8" />
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  fill="none"
                  stroke="#0284c7"
                  strokeWidth="8"
                  strokeDasharray="251"
                  strokeDashoffset={251 - (251 * (glasses / 10))}
                  strokeLinecap="round"
                />
              </svg>
              <span className="absolute text-sm font-black text-sky-700">{glasses * 10}%</span>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 mt-2 border-t border-slate-100">
            <span className="text-xs font-semibold text-slate-600">Quick Log:</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleUpdateGlasses(Math.max(0, glasses - 1), 0)}
                className="w-8 h-8 rounded-full bg-slate-100 text-slate-700 font-black text-sm flex items-center justify-center"
              >
                -
              </button>
              <span className="text-xs font-bold text-slate-900 w-16 text-center">{glasses} glasses</span>
              <button
                type="button"
                onClick={() => handleUpdateGlasses(glasses + 1, 250)}
                className="w-8 h-8 rounded-full bg-sky-500 text-white font-black text-sm flex items-center justify-center shadow-xs"
              >
                +
              </button>
            </div>
          </div>
        </div>

        {/* Activity Pacing Strip */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">directions_walk</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900">Activity Pacing</h3>
            </div>
            <span className="text-xs font-bold text-emerald-700">4,820 / 6,000 steps</span>
          </div>

          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
            <div className="bg-[#84cc16] h-full rounded-full" style={{ width: '80%' }}></div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center pt-1">
            <div className="p-2 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-400 font-semibold">Active Cal</span>
              <p className="text-sm font-black text-slate-800 mt-0.5">340 kcal</p>
            </div>
            <div className="p-2 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-400 font-semibold">Distance</span>
              <p className="text-sm font-black text-slate-800 mt-0.5">3.6 km</p>
            </div>
          </div>
        </div>

        {/* 7-Day Sleep Visualization */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                <span className="material-symbols-outlined text-[18px]">bedtime</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900">Sleep Architecture</h3>
            </div>
            <span className="text-xs font-bold text-indigo-700">7.4h avg</span>
          </div>

          <div className="flex items-end justify-between h-20 pt-2 px-1">
            {['Thu', 'Fri', 'Sat', 'Sun', 'Mon', 'Tue', 'Today'].map((day, idx) => (
              <div key={day} className="flex flex-col items-center gap-1">
                <div
                  className={`w-6 rounded-t transition-all ${
                    idx === 6 ? 'bg-indigo-600 shadow-xs' : 'bg-indigo-200'
                  }`}
                  style={{ height: `${[48, 54, 62, 58, 50, 56, 68][idx]}px` }}
                ></div>
                <span className={`text-[9px] font-semibold ${idx === 6 ? 'text-indigo-600 font-bold' : 'text-slate-400'}`}>
                  {day}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Export Report Pill */}
        <div className="bg-white border border-slate-100 rounded-2xl p-3.5 flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700">
              <span className="material-symbols-outlined text-[18px]">description</span>
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block leading-tight">14-Day Clinician Telemetry</span>
              <span className="text-[10px] text-slate-500">Ready to transmit to Dr. Miller</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onOpenScreen?.('physician_dossier')}
            className="flex items-center space-x-1 bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-800"
          >
            <span className="material-symbols-outlined text-[14px]">ios_share</span>
            <span>Dossier</span>
          </button>
        </div>
      </main>
    </div>
  );
}

