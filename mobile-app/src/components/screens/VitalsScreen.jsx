import React, { useState } from 'react';

export function VitalsScreen({ openLogVitals }) {
  const [subTab, setSubTab] = useState('overview'); // 'overview' | 'metabolism' | 'devices'
  const [metabolismSegment, setMetabolismSegment] = useState('kcal'); // 'kcal' | 'water' | 'pacing'
  const [waterCups, setWaterCups] = useState(7);
  const [deviceStates, setDeviceStates] = useState({
    appleHealth: true,
    appleWatch: true,
    cgm: true,
    omronBp: false,
  });
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const toggleDevice = (key) => {
    setDeviceStates((prev) => {
      const next = !prev[key];
      showToast(`${key} sensor stream ${next ? 'connected' : 'disconnected'}.`);
      return { ...prev, [key]: next };
    });
  };

  return (
    <div className="p-4 space-y-3.5 pb-28 select-none text-charcoal bg-appBg min-h-full">
      {toastMsg && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-neutral-700 animate-fade-in flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#97E432]">check_circle</span>
          <span>{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Vitals & Telemetry</h2>
          <p className="text-[10px] text-neutral-500">Apple Watch Ultra 2 & Continuous Monitor</p>
        </div>
        <button 
          onClick={() => openLogVitals('glucose')}
          className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] flex items-center space-x-1 active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">edit</span>
          <span>Manual Entry</span>
        </button>
      </div>

      {/* Section Sub-Nav Pills */}
      <div className="bg-slate-200/70 p-1 rounded-full flex items-center shadow-inner">
        <button
          onClick={() => setSubTab('overview')}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition text-center cursor-pointer ${
            subTab === 'overview'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setSubTab('metabolism')}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition text-center cursor-pointer ${
            subTab === 'metabolism'
              ? 'bg-[#97E432] text-slate-950 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Metabolism
        </button>
        <button
          onClick={() => setSubTab('devices')}
          className={`flex-1 py-1.5 rounded-full text-xs font-bold transition text-center cursor-pointer ${
            subTab === 'devices'
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          Device Sync
        </button>
      </div>

      {/* SUB-TAB 1: OVERVIEW */}
      {subTab === 'overview' && (
        <div className="space-y-3.5">
          {/* Live AI Wellbeing Insight */}
          <div className="bg-limeSoft rounded-2xl p-3 border border-limeBright/30 shadow-soft">
            <div className="flex items-center space-x-2 mb-1">
              <span className="material-symbols-outlined text-emerald-800 text-[18px]">smart_toy</span>
              <span className="text-[10px] font-bold text-emerald-900 uppercase">AI Clinical Telemetry</span>
            </div>
            <p className="text-[11px] text-neutral-800 leading-snug font-medium">
              Post-meal glucose estimated peak at 134 mg/dL. A 15-minute gentle walk will flatten the glycemic curve by ~18%.
            </p>
            <button 
              onClick={() => showToast('Walk workout initiated on Apple Watch. Live pacing active!')}
              className="mt-2 px-2.5 py-1 bg-white text-emerald-900 rounded-lg text-[10px] font-bold shadow-sm active:scale-95 transition cursor-pointer"
            >
              Start 15m Walk
            </button>
          </div>

          {/* User Logged Readings */}
          <div className="grid grid-cols-2 gap-2.5">
            <div 
              onClick={() => openLogVitals('bp')}
              className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft cursor-pointer active:scale-95 transition"
            >
              <span className="text-[10px] font-semibold text-neutral-400 block">Blood Pressure</span>
              <div className="text-base font-bold text-neutral-900 my-0.5">
                132 / 84 <span className="text-[9px] font-normal text-neutral-400">mmHg</span>
              </div>
              <span className="text-[9px] text-amber-600 font-semibold bg-amber-50 px-1.5 py-0.5 rounded">
                Stage 1 Systolic
              </span>
            </div>

            <div 
              onClick={() => openLogVitals('glucose')}
              className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft cursor-pointer active:scale-95 transition"
            >
              <span className="text-[10px] font-semibold text-neutral-400 block">Fasting Glucose</span>
              <div className="text-base font-bold text-neutral-900 my-0.5">
                118 <span className="text-[9px] font-normal text-neutral-400">mg/dL</span>
              </div>
              <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                Controlled
              </span>
            </div>
          </div>

          {/* Continuous Sensor Grid */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft">
              <div className="flex justify-between items-center text-neutral-400 mb-1">
                <span className="text-[10px] font-semibold">Resting HR</span>
                <span className="material-symbols-outlined text-red-500 text-[14px]">favorite</span>
              </div>
              <div className="text-base font-bold text-neutral-900">
                68 <span className="text-[10px] font-normal text-neutral-400">bpm</span>
              </div>
              <span className="text-[9px] text-neutral-400">Steady today</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft">
              <div className="flex justify-between items-center text-neutral-400 mb-1">
                <span className="text-[10px] font-semibold">Blood Oxygen</span>
                <span className="material-symbols-outlined text-sky-500 text-[14px]">air</span>
              </div>
              <div className="text-base font-bold text-neutral-900">
                98% <span className="text-[10px] font-normal text-neutral-400">SpO2</span>
              </div>
              <span className="text-[9px] text-emerald-600 font-medium">Optimal Range</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft">
              <div className="flex justify-between items-center text-neutral-400 mb-1">
                <span className="text-[10px] font-semibold">Steps Tracked</span>
                <span className="material-symbols-outlined text-orange-500 text-[14px]">steps</span>
              </div>
              <div className="text-base font-bold text-neutral-900">
                3,120 <span className="text-[10px] font-normal text-neutral-400">steps</span>
              </div>
              <span className="text-[9px] text-neutral-400">45% of goal</span>
            </div>

            <div className="bg-white p-3 rounded-2xl border border-neutral-100 shadow-soft">
              <div className="flex justify-between items-center text-neutral-400 mb-1">
                <span className="text-[10px] font-semibold">Sleep Duration</span>
                <span className="material-symbols-outlined text-indigo-500 text-[14px]">bedtime</span>
              </div>
              <div className="text-base font-bold text-neutral-900">6h 40m</div>
              <span className="text-[9px] text-emerald-600 font-medium">78 Sleep Quality</span>
            </div>
          </div>

          {/* 7-Day Sleep Chart Mini */}
          <div className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100">
            <div className="flex justify-between items-center mb-3">
              <h4 className="text-xs font-bold text-neutral-900">7-Day Sleep Telemetry</h4>
              <span className="text-[10px] font-medium text-neutral-400">Avg: 7h 12m</span>
            </div>
            <div className="flex items-end justify-between h-16 px-2">
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-10"></div>
                <span className="text-[8px] text-neutral-400">W</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-12"></div>
                <span className="text-[8px] text-neutral-400">T</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-14"></div>
                <span className="text-[8px] text-neutral-400">F</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-8"></div>
                <span className="text-[8px] text-neutral-400">S</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-13"></div>
                <span className="text-[8px] text-neutral-400">S</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-indigo-200 rounded-t h-11"></div>
                <span className="text-[8px] text-neutral-400">M</span>
              </div>
              <div className="flex flex-col items-center gap-1">
                <div className="w-4 bg-[#97E432] rounded-t h-12"></div>
                <span className="text-[8px] font-bold text-neutral-900">T</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 2: METABOLISM & CALORIES */}
      {subTab === 'metabolism' && (
        <div className="space-y-4">
          {/* Segmented Tab Pill */}
          <div className="bg-white/90 backdrop-blur p-1 rounded-full shadow-soft flex items-center justify-between border border-slate-100">
            {['kcal', 'water', 'pacing'].map((tab) => (
              <button
                key={tab}
                onClick={() => setMetabolismSegment(tab)}
                className={`flex-1 py-1.5 text-center text-xs font-bold rounded-full transition-all cursor-pointer capitalize ${
                  metabolismSegment === tab
                    ? 'bg-[#84CC16] text-white shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {tab === 'kcal' ? 'Kcal' : tab === 'water' ? 'Water' : 'Pacing'}
              </button>
            ))}
          </div>

          {/* Calories Main Card */}
          <div className="bg-white rounded-3xl p-5 shadow-soft border border-slate-50 relative">
            <div className="flex justify-between items-baseline mb-4">
              <div>
                <span className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">Calories</span>
                <div className="flex items-baseline space-x-1.5 mt-0.5">
                  <span className="text-3xl font-extrabold text-slate-900 tracking-tight">1250</span>
                  <span className="text-xs font-medium text-slate-400">Kcal</span>
                </div>
              </div>
              <div className="text-right">
                <span className="text-xs font-medium text-slate-400">
                  Target: <strong className="text-slate-700 font-semibold">1920 Kcal</strong>
                </span>
              </div>
            </div>

            {/* Weekly Bar Chart */}
            <div className="pt-3 pb-1">
              <div className="h-40 flex items-end justify-between px-1">
                {/* Mon */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">44%</span>
                  <div className="w-3.5 h-16 rounded-full border border-slate-200 bg-slate-100"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Mon</span>
                </div>
                {/* Tue */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">34%</span>
                  <div className="w-3.5 h-12 rounded-full bg-[#D9F99D]/90"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Tue</span>
                </div>
                {/* Wed */}
                <div className="flex flex-col items-center flex-1 relative">
                  <span className="text-[11px] font-bold text-[#65A30D] mb-1.5 animate-pulse">110%</span>
                  <div className="w-4 h-32 rounded-full bg-[#84CC16] shadow-md shadow-lime-200 ring-2 ring-lime-300"></div>
                  <span className="text-[11px] font-bold text-slate-900 mt-2">Wed</span>
                </div>
                {/* Thu */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">47%</span>
                  <div className="w-3.5 h-18 rounded-full bg-[#D9F99D]/90"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Thu</span>
                </div>
                {/* Fri */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">32%</span>
                  <div className="w-3.5 h-11 rounded-full border border-slate-200 bg-slate-100"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Fri</span>
                </div>
                {/* Sat */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">79%</span>
                  <div className="w-3.5 h-24 rounded-full bg-[#BEF264]"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Sat</span>
                </div>
                {/* Sun */}
                <div className="flex flex-col items-center flex-1">
                  <span className="text-[10px] font-semibold text-slate-400 mb-1.5">24%</span>
                  <div className="w-3.5 h-9 rounded-full border border-slate-200 bg-slate-100"></div>
                  <span className="text-[11px] font-medium text-slate-400 mt-2">Sun</span>
                </div>
              </div>
            </div>
          </div>

          {/* Safeguard Alert Notice */}
          <div className="bg-amber-50/90 border border-amber-200/70 rounded-2xl p-3.5 flex items-start space-x-3">
            <div className="w-7 h-7 rounded-full bg-amber-100 shrink-0 flex items-center justify-center text-amber-600 mt-0.5">
              <span className="material-symbols-outlined text-[16px]">warning</span>
            </div>
            <p className="text-xs text-amber-900 leading-snug font-medium">
              <span className="font-bold block text-amber-950">Active Exertion Paused</span>
              BP spike detected. Focus on 10-min restorative stretch to normalize arterial pressure.
            </p>
          </div>

          {/* Biometric 2x2 Grid */}
          <div className="grid grid-cols-2 gap-3">
            {/* Exercise */}
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-slate-50 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[15px]">fitness_center</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">Exercise</span>
              </div>
              <div className="flex items-end space-x-1 h-7 my-3 px-1">
                <div className="w-1.5 h-3 bg-emerald-200 rounded-full"></div>
                <div className="w-1.5 h-5 bg-emerald-300 rounded-full"></div>
                <div className="w-1.5 h-7 bg-emerald-500 rounded-full"></div>
                <div className="w-1.5 h-4 bg-emerald-400 rounded-full"></div>
                <div className="w-1.5 h-6 bg-emerald-500 rounded-full"></div>
                <div className="w-1.5 h-2 bg-emerald-200 rounded-full"></div>
              </div>
              <div className="text-sm font-bold text-slate-900">
                2.0 <span className="text-xs font-medium text-slate-400">hours</span>
              </div>
            </div>

            {/* BPM */}
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-slate-50 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-rose-50 text-rose-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[15px] animate-pulse">favorite</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">BPM</span>
              </div>
              <div className="h-7 my-3 flex items-center">
                <svg className="w-full h-6 stroke-rose-500 fill-none" strokeWidth="1.8" viewBox="0 0 100 24">
                  <path d="M0 12 h20 l5 -8 l6 18 l5 -14 l4 8 l5 -4 h55" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <div className="text-sm font-bold text-slate-900">
                86 <span className="text-xs font-medium text-slate-400">bpm</span>
              </div>
            </div>

            {/* Weight */}
            <div className="bg-white rounded-2xl p-4 shadow-soft border border-slate-50 flex flex-col justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[15px]">scale</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">Weight</span>
              </div>
              <div className="my-2.5 flex items-baseline space-x-1.5">
                <span className="text-lg font-bold text-slate-900">78.5</span>
                <span className="text-xs font-medium text-slate-400">kg</span>
                <span className="text-[10px] font-semibold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded-full ml-1">
                  -3.8%
                </span>
              </div>
              <span className="text-[10px] text-slate-400">Past 30 days loss</span>
            </div>

            {/* Water */}
            <div 
              onClick={() => {
                const next = waterCups >= 8 ? 1 : waterCups + 1;
                setWaterCups(next);
                showToast(`Water logged: ${next} / 8 glasses`);
              }}
              className="bg-white rounded-2xl p-4 shadow-soft border border-slate-50 flex flex-col justify-between cursor-pointer active:scale-95 transition"
            >
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 rounded-full bg-sky-50 text-sky-500 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[15px]">water_drop</span>
                </div>
                <span className="text-xs font-semibold text-slate-700">Water</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5 my-3">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((idx) => (
                  <div
                    key={idx}
                    className={`h-2 rounded-full ${
                      idx <= waterCups ? 'bg-sky-400' : 'bg-slate-200'
                    }`}
                  ></div>
                ))}
              </div>
              <div className="text-sm font-bold text-slate-900">
                {waterCups} <span className="text-xs font-medium text-slate-400">/ 8 glasses</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* SUB-TAB 3: CONNECTED DEVICES */}
      {subTab === 'devices' && (
        <div className="space-y-4">
          {/* Bento Preview */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#84cc16]"></span>
                </span>
                <h3 className="text-xs font-bold text-slate-800 tracking-wide uppercase">
                  Live Telemetry Pipeline
                </h3>
              </div>
              <span className="text-[10px] font-bold text-[#1a2e05] bg-[#f7fee7] border border-[#bef264] px-2 py-0.5 rounded-full">
                BLE 5.3 Active
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="bg-[#f8fafc] rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">HR Stream</span>
                <div className="text-[17px] font-black text-slate-900">72 <span className="text-[11px] font-semibold text-slate-500">BPM</span></div>
                <span className="text-[9px] text-emerald-600 font-semibold mt-1">Steady</span>
              </div>

              <div className="bg-[#f8fafc] rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">CGM Stream</span>
                <div className="text-[17px] font-black text-slate-900">94 <span className="text-[11px] font-semibold text-slate-500">mg/dL</span></div>
                <span className="text-[9px] text-[#365314] bg-[#ecfccb] px-1.5 py-0.2 rounded-full font-bold mt-1">Optimal</span>
              </div>

              <div className="bg-[#f8fafc] rounded-xl p-3 border border-slate-100 flex flex-col items-center justify-center text-center">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Recovery</span>
                <div className="text-[17px] font-black text-slate-900">88%</div>
                <span className="text-[9px] text-[#365314] bg-[#ecfccb] px-1.5 py-0.2 rounded-full font-bold mt-1">Prime</span>
              </div>
            </div>
          </div>

          {/* Sensor List */}
          <div className="space-y-2.5">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 px-1">
              Detected & Compatible Sensors
            </h3>

            {/* Apple Health & Google Fit */}
            <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center shrink-0 text-[#4d7c0f]">
                  <span className="material-symbols-outlined text-[20px]">health_and_safety</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Apple Health & Google Fit</h4>
                    <span className="text-[9px] font-bold text-[#1a2e05] bg-[#ecfccb] px-1.5 py-0.2 rounded">Auto</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">Steps, active energy, HRV metrics</p>
                </div>
              </div>
              <button
                onClick={() => toggleDevice('appleHealth')}
                className={`w-11 h-6 rounded-full p-0.5 transition flex items-center cursor-pointer shrink-0 ${
                  deviceStates.appleHealth ? 'bg-[#84cc16]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition flex items-center justify-center ${
                  deviceStates.appleHealth ? 'translate-x-5' : 'translate-x-0'
                }`}>
                  {deviceStates.appleHealth && <span className="material-symbols-outlined text-[11px] text-[#4d7c0f] font-bold">check</span>}
                </div>
              </button>
            </div>

            {/* Apple Watch */}
            <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center shrink-0 text-[#4d7c0f]">
                  <span className="material-symbols-outlined text-[20px]">watch</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Apple Watch Ultra 2</h4>
                    <span className="text-[9px] font-bold text-[#1a2e05] bg-[#ecfccb] px-1.5 py-0.2 rounded">BLE 1m</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">Continuous wrist optical HR & arrhythmia</p>
                </div>
              </div>
              <button
                onClick={() => toggleDevice('appleWatch')}
                className={`w-11 h-6 rounded-full p-0.5 transition flex items-center cursor-pointer shrink-0 ${
                  deviceStates.appleWatch ? 'bg-[#84cc16]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition flex items-center justify-center ${
                  deviceStates.appleWatch ? 'translate-x-5' : 'translate-x-0'
                }`}>
                  {deviceStates.appleWatch && <span className="material-symbols-outlined text-[11px] text-[#4d7c0f] font-bold">check</span>}
                </div>
              </button>
            </div>

            {/* Dexcom CGM */}
            <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-center justify-center shrink-0 text-[#4d7c0f]">
                  <span className="material-symbols-outlined text-[20px]">water_drop</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Dexcom G7 Continuous CGM</h4>
                    <span className="text-[9px] font-bold text-[#1a2e05] bg-[#ecfccb] px-1.5 py-0.2 rounded">Streaming</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">Subcutaneous interstitial glucose delta</p>
                </div>
              </div>
              <button
                onClick={() => toggleDevice('cgm')}
                className={`w-11 h-6 rounded-full p-0.5 transition flex items-center cursor-pointer shrink-0 ${
                  deviceStates.cgm ? 'bg-[#84cc16]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition flex items-center justify-center ${
                  deviceStates.cgm ? 'translate-x-5' : 'translate-x-0'
                }`}>
                  {deviceStates.cgm && <span className="material-symbols-outlined text-[11px] text-[#4d7c0f] font-bold">check</span>}
                </div>
              </button>
            </div>

            {/* Omron Evolv BP */}
            <div className="bg-white border border-slate-100 rounded-2xl p-3.5 shadow-sm flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center shrink-0 text-slate-500">
                  <span className="material-symbols-outlined text-[20px]">monitor_heart</span>
                </div>
                <div className="truncate">
                  <div className="flex items-center gap-1.5">
                    <h4 className="text-xs font-bold text-slate-900 truncate">Omron Evolv BP Cuff</h4>
                    <span className="text-[9px] font-medium text-slate-400 bg-slate-100 px-1.5 py-0.2 rounded">36h ago</span>
                  </div>
                  <p className="text-[10px] text-slate-500 truncate">Oscillometric systolic / diastolic telemetry</p>
                </div>
              </div>
              <button
                onClick={() => toggleDevice('omronBp')}
                className={`w-11 h-6 rounded-full p-0.5 transition flex items-center cursor-pointer shrink-0 ${
                  deviceStates.omronBp ? 'bg-[#84cc16]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 bg-white rounded-full shadow-sm transform transition flex items-center justify-center ${
                  deviceStates.omronBp ? 'translate-x-5' : 'translate-x-0'
                }`}>
                  {deviceStates.omronBp && <span className="material-symbols-outlined text-[11px] text-[#4d7c0f] font-bold">check</span>}
                </div>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

