import React, { useState } from 'react';

export default function MetabolismScreen({ onOpenScreen }) {
  const [activeTab, setActiveTab] = useState('Kcal');

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#F7F9F8] text-slate-800 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Navigation */}
      <header className="px-5 pt-3 pb-2 flex items-center justify-between border-b border-slate-100 bg-white/90 backdrop-blur-md sticky top-0 z-40">
        <button
          type="button"
          onClick={() => onOpenScreen?.('vitals')}
          aria-label="Go Back"
          className="w-10 h-10 rounded-full bg-white shadow-xs flex items-center justify-center text-slate-700 border border-slate-100"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <h1 className="text-base font-bold text-slate-900 tracking-tight">Statistic & Metabolism</h1>
        <button
          type="button"
          onClick={() => onOpenScreen?.('health_analytics')}
          className="px-2.5 py-1 rounded-full bg-lime-100 text-lime-900 text-xs font-bold"
        >
          Analytics
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-5 pb-28 space-y-4 pt-3">
        {/* Segmented Tab Pill */}
        <div className="bg-white p-1 rounded-full shadow-xs flex items-center justify-between border border-slate-100">
          {['Kcal', 'Water', 'Sleep', 'Steps'].map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-2 text-center text-xs font-bold rounded-full transition-all ${
                activeTab === tab ? 'bg-[#84CC16] text-slate-950 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Hero Chart Card */}
        <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Weekly Calorie Metabolism</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-2xl font-black text-slate-900">12,480</span>
                <span className="text-xs font-bold text-slate-400">kcal burned</span>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#ecfccb] text-[#365314] text-[11px] font-bold">
              +14% Burn
            </span>
          </div>

          {/* Bar Chart Mockup */}
          <div className="flex items-end justify-between h-32 pt-4 px-2 border-b border-slate-100">
            {[
              { day: 'Mon', val: 70 },
              { day: 'Tue', val: 85 },
              { day: 'Wed', val: 60 },
              { day: 'Thu', val: 95 },
              { day: 'Fri', val: 75 },
              { day: 'Sat', val: 90 },
              { day: 'Sun', val: 80 },
            ].map((d, i) => (
              <div key={d.day} className="flex flex-col items-center gap-1.5 flex-1">
                <div
                  className={`w-6 rounded-t transition-all ${
                    i === 3 ? 'bg-[#84cc16] shadow-xs' : 'bg-lime-200'
                  }`}
                  style={{ height: `${d.val}%` }}
                ></div>
                <span className={`text-[10px] font-bold ${i === 3 ? 'text-lime-800' : 'text-slate-400'}`}>
                  {d.day}
                </span>
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between pt-1 text-xs text-slate-500">
            <span>Daily Average: <strong>1,782 kcal</strong></span>
            <span>Target: <strong>1,920 kcal</strong></span>
          </div>
        </div>

        {/* Metric Cards Grid */}
        <div className="grid grid-cols-2 gap-3">
          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Basal Metabolic Rate</span>
            <p className="text-xl font-black text-slate-900 mt-1">1,620 <span className="text-xs text-slate-400">kcal</span></p>
            <span className="text-[10px] text-emerald-600 font-bold mt-1 block">Optimal Resting Burn</span>
          </div>

          <div className="p-4 rounded-3xl bg-white border border-slate-100 shadow-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Active Burn</span>
            <p className="text-xl font-black text-slate-900 mt-1">420 <span className="text-xs text-slate-400">kcal</span></p>
            <span className="text-[10px] text-lime-700 font-bold mt-1 block">Pacing +12%</span>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onOpenScreen?.('hydration_pacing')}
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>View Hydration & Activity Pacing</span>
            <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
          </button>
        </div>
      </main>
    </div>
  );
}

