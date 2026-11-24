import React, { useState } from 'react';

export default function CalorieCounterScreen({ onOpenScreen }) {
  const [activeDate, setActiveDate] = useState('Today, 19 Nov');
  const [caloriesBurned, setCaloriesBurned] = useState(1278);

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#FAFBFB] text-slate-800 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="flex items-center justify-between px-5 pt-3 pb-2 flex-shrink-0 z-20 bg-[#FAFBFB] border-b border-slate-100">
        <div className="flex items-center space-x-3">
          <button
            type="button"
            onClick={() => onOpenScreen?.('home')}
            className="w-8 h-8 rounded-full bg-white flex items-center justify-center text-slate-700 shadow-xs"
          >
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
          </button>
          <span className="text-[16px] font-bold tracking-tight text-slate-800">Calorie & Macro Tracker</span>
        </div>
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={() => onOpenScreen?.('nutrition_dashboard')}
            className="px-3 py-1 rounded-full bg-lime-100 text-lime-900 text-xs font-bold"
          >
            Food Log
          </button>
        </div>
      </header>

      {/* Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-5 pb-24 pt-2 space-y-3.5">
        {/* Hero Progress Card */}
        <section className="bg-[#BCE8EC] rounded-[28px] p-5 relative overflow-hidden text-slate-800 shadow-xs">
          <div className="flex justify-between items-start">
            <div className="flex flex-col justify-between h-36">
              <div className="inline-flex items-center space-x-1.5 bg-white/70 backdrop-blur-xs px-2.5 py-1 rounded-full w-max text-xs font-bold text-slate-700">
                <span className="material-symbols-outlined text-[15px] text-slate-600">trending_up</span>
                <span>Daily Pacing</span>
              </div>

              <div className="my-auto pt-2">
                <span className="text-4xl font-black tracking-tight text-slate-900">91%</span>
              </div>

              <div>
                <button
                  type="button"
                  className="inline-flex items-center space-x-1 text-xs font-semibold text-slate-700 bg-white/50 px-2.5 py-1 rounded-full"
                >
                  <span>{activeDate}</span>
                  <span className="material-symbols-outlined text-[14px]">expand_more</span>
                </button>
              </div>
            </div>

            {/* Circular Radial Gauge */}
            <div className="relative w-36 h-36 flex items-center justify-center">
              <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 120 120">
                <circle cx="60" cy="60" fill="none" r="46" stroke="white" strokeOpacity="0.3" strokeWidth="7" />
                <circle
                  cx="60"
                  cy="60"
                  fill="none"
                  r="46"
                  stroke="white"
                  strokeDasharray="289"
                  strokeDashoffset="35"
                  strokeLinecap="round"
                  strokeWidth="7"
                />
              </svg>
              <div className="absolute top-[18px] right-[24px] w-3 h-3 rounded-full bg-[#F5DE6A] border-2 border-white shadow-xs"></div>
              <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                <span className="text-xl font-black text-slate-900 leading-none">1,350</span>
                <span className="text-[11px] font-semibold text-slate-600 mt-1">Target 1,920</span>
              </div>
            </div>
          </div>
        </section>

        {/* Sub-Metrics Grid */}
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-[24px] p-4 flex flex-col justify-between shadow-xs border border-slate-100">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold text-slate-700 leading-tight">Current<br />Weight</span>
              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-[16px]">scale</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-900 leading-none">78.5</span>
                <span className="text-xs font-semibold text-slate-500">Kg</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] font-semibold text-emerald-600 mt-2">
                <span className="material-symbols-outlined text-[14px]">south</span>
                <span>-3.2 kg (Metabolic safe)</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-[24px] p-4 flex flex-col justify-between shadow-xs border border-slate-100">
            <div className="flex items-center justify-between text-slate-600">
              <span className="text-xs font-bold text-slate-700 leading-tight">Burned<br />Active</span>
              <div className="w-7 h-7 rounded-full bg-slate-50 flex items-center justify-center text-slate-600">
                <span className="material-symbols-outlined text-[16px]">local_fire_department</span>
              </div>
            </div>
            <div className="mt-3">
              <div className="flex items-baseline space-x-1">
                <span className="text-2xl font-black text-slate-900 leading-none">{caloriesBurned}</span>
                <span className="text-xs font-semibold text-slate-500">kcal</span>
              </div>
              <div className="flex items-center space-x-1 text-[11px] font-semibold text-slate-500 mt-2">
                <span className="material-symbols-outlined text-[14px] text-emerald-600">north</span>
                <span>+8.4% vs last week</span>
              </div>
            </div>
          </div>
        </section>

        {/* Meal Breakdown Bento Card */}
        <section className="bg-[#CEECC5] rounded-[28px] p-5 shadow-xs relative">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <div className="w-8 h-8 rounded-full bg-white/70 flex items-center justify-center text-slate-700">
                <span className="material-symbols-outlined text-[18px]">wb_sunny</span>
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900 leading-tight">Breakfast Schedule</h3>
                <p className="text-[11px] font-semibold text-slate-600">380 kcal · Completed</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-900 bg-white/60 px-2.5 py-1 rounded-full">
              Optimal GI
            </span>
          </div>

          <div className="mt-3 bg-white/80 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
              <span>Carbs Partition</span>
              <span>32%</span>
            </div>
            <div className="w-full bg-white h-2 rounded-full overflow-hidden">
              <div className="bg-[#84cc16] h-full rounded-full" style={{ width: '32%' }}></div>
            </div>
            <p className="text-[11px] text-slate-600">
              Low glycemic load kept insulin spike below 15 μIU/mL.
            </p>
          </div>
        </section>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => onOpenScreen?.('food_ocr_scanner')}
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold rounded-full text-sm shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">photo_camera</span>
            <span>Scan Plate with OCR</span>
          </button>
        </div>
      </main>
    </div>
  );
}

