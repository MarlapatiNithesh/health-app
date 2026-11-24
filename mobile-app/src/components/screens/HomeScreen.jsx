import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export function HomeScreen({
  openLogVitals,
  openSosModal,
  openOcrModal,
  openPdfModal,
  openNotificationsModal,
  navigateToTab,
}) {
  const { member } = useAuth();
  const [amlodipineTaken, setAmlodipineTaken] = useState(false);
  const [amlodipineSnoozed, setAmlodipineSnoozed] = useState(false);
  const [walkDone, setWalkDone] = useState(false);
  const [waterGlasses, setWaterGlasses] = useState(12);
  const [activeDate, setActiveDate] = useState('10'); // Wednesday 10th
  const [mealToast, setMealToast] = useState('');

  const showToast = (msg) => {
    setMealToast(msg);
    setTimeout(() => setMealToast(''), 3000);
  };

  const handleReorder = (pharmacy) => {
    showToast(`Order initiated via ${pharmacy}. Priority delivery scheduled!`);
  };

  // Completed items count (base 2 of 6)
  const completedCount = 2 + (amlodipineTaken ? 1 : 0) + (walkDone ? 1 : 0);
  const percentDone = Math.round((completedCount / 6) * 100);

  return (
    <div className="p-4 space-y-3.5 pb-28 select-none text-charcoal bg-appBg min-h-full">
      {/* Toast Notification */}
      {mealToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-neutral-700 animate-fade-in flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#97E432]">check_circle</span>
          <span>{mealToast}</span>
        </div>
      )}

      {/* 1. Daily Care Plan Banner */}
      <div className="bg-limeSoft rounded-2xl p-4 shadow-soft border border-limeBright/30">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-[16px] text-emerald-800">verified</span>
            <span className="text-[9px] font-black text-emerald-900 tracking-wider uppercase">
              DAILY CARE PLAN · TUE, AUG 12
            </span>
          </div>
          <span className="px-2 py-0.5 rounded-full bg-white text-emerald-900 font-bold text-[10px] shadow-sm">
            {percentDone}% Done
          </span>
        </div>
        <h3 className="text-sm font-bold text-neutral-900 mt-0.5">Alerts and daily goals</h3>
        <p className="text-[11px] text-neutral-700 mt-0.5 leading-snug">
          Your essentials for living well with diabetes and high blood pressure ({completedCount} of 6 done · {6 - completedCount} remaining)
        </p>
        <div className="w-full bg-white/70 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div 
            className="bg-emerald-600 h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentDone}%` }}
          ></div>
        </div>
      </div>

      {/* 2. Urgent Medicine Supply & Pharmacy Links */}
      <section className="bg-red-50/90 border border-red-200 rounded-2xl p-3 shadow-soft">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center space-x-1.5">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            <span className="text-[10px] font-bold text-red-600 uppercase">
              Medicine Running Low · 2 Days Left
            </span>
          </div>
          <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-[9px] font-bold text-red-700">
            3 doses remaining
          </span>
        </div>
        <p className="text-[11px] font-semibold text-neutral-800 mb-2">
          Amlodipine 5 mg & Metformin 500 mg critical stock
        </p>
        <div className="grid grid-cols-3 gap-1.5">
          <button 
            onClick={() => handleReorder('1mg Express (2 hrs delivery)')}
            className="bg-white border border-red-200 hover:border-red-400 rounded-xl p-1.5 text-center active:scale-95 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-neutral-900 block">1mg</span>
            <span className="text-[8px] text-emerald-600 font-semibold">⚡ 2 hrs · 20% off</span>
          </button>
          <button 
            onClick={() => handleReorder('Amazon Pharmacy Prime')}
            className="bg-white border border-red-200 hover:border-red-400 rounded-xl p-1.5 text-center active:scale-95 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-neutral-900 block">Amazon Rx</span>
            <span className="text-[8px] text-neutral-500 font-medium">Prime Delivery</span>
          </button>
          <button 
            onClick={() => handleReorder('Apollo Pharmacy (90m instant)')}
            className="bg-white border border-red-200 hover:border-red-400 rounded-xl p-1.5 text-center active:scale-95 transition cursor-pointer"
          >
            <span className="text-[10px] font-bold text-neutral-900 block">Apollo</span>
            <span className="text-[8px] text-emerald-600 font-semibold">Instant 90m</span>
          </button>
        </div>
      </section>

      {/* 3. Needs Attention (High Priority) */}
      <section className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-1.5">
            <h4 className="text-xs font-bold text-neutral-900">Needs Attention (High Priority)</h4>
            <span className="w-1.5 h-1.5 rounded-full bg-red-500"></span>
          </div>
          <span className="text-[10px] font-bold text-red-600">
            {amlodipineTaken ? '2 Pending' : '3 Pending'}
          </span>
        </div>

        <div className="space-y-2">
          {/* Amlodipine Due */}
          <div className="p-2.5 rounded-xl bg-amber-50/60 border border-amber-200/60">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="flex items-center space-x-1.5">
                  <span className="text-xs font-bold text-neutral-900">Amlodipine is due</span>
                  <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded ${
                    amlodipineTaken 
                      ? 'bg-emerald-100 text-emerald-800' 
                      : 'bg-amber-100 text-amber-700'
                  }`}>
                    {amlodipineTaken ? '✓ Taken' : 'Due Now'}
                  </span>
                </div>
                <span className="text-[10px] text-neutral-500">
                  Scheduled 09:00 · 40 min ago · 1 tablet 5mg for BP
                </span>
              </div>
            </div>
            <div className="flex space-x-1.5 mt-2">
              <button 
                onClick={() => {
                  setAmlodipineTaken(true);
                  showToast('Amlodipine 5mg logged as taken. Blood pressure protocol on track!');
                }}
                className={`flex-1 py-1 font-bold text-[10px] rounded-lg shadow-glow-lime active:scale-95 transition cursor-pointer ${
                  amlodipineTaken 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#97E432] hover:bg-limeAccent text-neutral-950'
                }`}
              >
                {amlodipineTaken ? '✓ Taken' : 'Take'}
              </button>
              <button 
                onClick={() => {
                  setAmlodipineSnoozed(true);
                  showToast('Dose snoozed for 15 minutes.');
                }}
                className="px-3 py-1 bg-white border border-neutral-200 text-neutral-700 font-medium text-[10px] rounded-lg active:scale-95 transition cursor-pointer"
              >
                {amlodipineSnoozed ? 'Snoozed 15m' : 'Snooze'}
              </button>
            </div>
          </div>

          {/* Fasting Blood Sugar Missing */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50/80 border border-neutral-100">
            <div>
              <span className="text-[11px] font-bold text-neutral-800 block">Fasting blood sugar not logged</span>
              <span className="text-[9px] text-neutral-500">Needed every morning · Target &lt;100 mg/dL</span>
            </div>
            <button 
              onClick={() => openLogVitals('glucose')}
              className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition cursor-pointer"
            >
              Log
            </button>
          </div>

          {/* Blood Pressure Missing */}
          <div className="flex items-center justify-between p-2 rounded-xl bg-neutral-50/80 border border-neutral-100">
            <div>
              <span className="text-[11px] font-bold text-neutral-800 block">No blood pressure for 36 hours</span>
              <span className="text-[9px] text-neutral-500">Needed once a day · Target &lt;130/80 mmHg</span>
            </div>
            <button 
              onClick={() => openLogVitals('bp')}
              className="px-3 py-1 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white text-[10px] font-semibold shadow-sm active:scale-95 transition cursor-pointer"
            >
              Log
            </button>
          </div>
        </div>
      </section>

      {/* 4. Today's Essentials Grid */}
      <section className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100">
        <div className="flex items-center justify-between mb-2.5">
          <h4 className="text-xs font-bold text-neutral-900">Today's Essentials</h4>
          <span className="text-[10px] text-neutral-400 font-medium">
            {completedCount} of 6 Completed
          </span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-[11px]">
          {/* Morning Metformin */}
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 block">Morning Metformin</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Done · 08:15 AM</span>
            </div>
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
              ✓
            </span>
          </div>

          {/* Fasting blood sugar */}
          <div className="p-2 rounded-xl bg-red-50/80 border border-red-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 block">Fasting blood sugar</span>
              <span className="text-[9px] text-red-600 font-medium">Missing · &lt;100 mg/dL</span>
            </div>
            <button 
              onClick={() => openLogVitals('glucose')}
              className="px-1.5 py-0.5 bg-neutral-900 text-white text-[9px] font-bold rounded cursor-pointer"
            >
              Log
            </button>
          </div>

          {/* Blood pressure */}
          <div className="p-2 rounded-xl bg-red-50/80 border border-red-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 block">Blood pressure</span>
              <span className="text-[9px] text-red-600 font-medium">Missing · &lt;130/80</span>
            </div>
            <button 
              onClick={() => openLogVitals('bp')}
              className="px-1.5 py-0.5 bg-neutral-900 text-white text-[9px] font-bold rounded cursor-pointer"
            >
              Log
            </button>
          </div>

          {/* Daily weigh-in */}
          <div className="p-2 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 block">Daily weigh-in</span>
              <span className="text-[9px] text-emerald-700 font-semibold">Done · 74.2 kg</span>
            </div>
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white text-[10px] flex items-center justify-center font-bold">
              ✓
            </span>
          </div>

          {/* 20 min walk */}
          <div 
            onClick={() => {
              setWalkDone(!walkDone);
              showToast(walkDone ? 'Walk marked as pending' : '20 min walk logged! Calories burned: 95 kcal');
            }}
            className={`p-2 rounded-xl border flex items-center justify-between cursor-pointer transition ${
              walkDone ? 'bg-emerald-50 border-emerald-100' : 'bg-neutral-50 border-neutral-100'
            }`}
          >
            <div>
              <span className="text-xs font-bold text-neutral-900 block">20 min walk</span>
              <span className={`text-[9px] font-medium ${walkDone ? 'text-emerald-700' : 'text-neutral-500'}`}>
                {walkDone ? 'Done · 20 min' : 'Pending · 0 / 20 min'}
              </span>
            </div>
            <span className={`w-5 h-5 rounded-full text-[10px] flex items-center justify-center font-bold ${
              walkDone ? 'bg-emerald-500 text-white' : 'bg-neutral-200 text-neutral-600'
            }`}>
              {walkDone ? '✓' : '○'}
            </span>
          </div>

          {/* Evening medication */}
          <div className="p-2 rounded-xl bg-neutral-50 border border-neutral-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-bold text-neutral-900 block">Evening medication</span>
              <span className="text-[9px] text-neutral-400 font-medium">At 20:00 · Later</span>
            </div>
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 text-[10px] flex items-center justify-center font-bold">
              ○
            </span>
          </div>
        </div>
      </section>

      {/* 5. August 2025 Calendar Date Strip */}
      <section className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100">
        <div className="flex justify-between items-center mb-2">
          <h4 className="text-xs font-bold text-neutral-900">August 2025</h4>
          <span className="text-[10px] font-semibold text-emerald-700">Week 32</span>
        </div>
        <div className="flex items-center justify-between px-1">
          {[
            { day: 'S', date: '07' },
            { day: 'M', date: '08' },
            { day: 'T', date: '09' },
            { day: 'W', date: '10' },
            { day: 'T', date: '11' },
            { day: 'F', date: '12' },
            { day: 'S', date: '13' },
          ].map((item) => {
            const isActive = activeDate === item.date;
            return (
              <button
                key={item.date}
                onClick={() => setActiveDate(item.date)}
                className={`flex flex-col items-center p-1.5 rounded-xl transition cursor-pointer ${
                  isActive
                    ? 'bg-[#97E432] shadow-glow-lime text-neutral-950 font-bold'
                    : 'text-neutral-700 hover:bg-neutral-50'
                }`}
              >
                <span className={`text-[9px] font-medium ${isActive ? 'text-neutral-900 font-bold' : 'text-neutral-400'}`}>
                  {item.day}
                </span>
                <span className={`text-xs mt-0.5 ${isActive ? 'font-black' : 'font-semibold'}`}>
                  {item.date}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* 6. Chrono-Meal Log with Food Cards */}
      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <h4 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Chrono-Meal Log</h4>
          <span className="text-[10px] font-semibold text-neutral-400">1,024 / 1,920 kcal</span>
        </div>
        <div className="space-y-2">
          {/* Breakfast */}
          <div className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <img
                alt="Breakfast"
                className="w-11 h-11 rounded-xl object-cover"
                src="https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=120&q=80"
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <h5 className="text-xs font-bold text-neutral-900">Breakfast</h5>
                  <span className="text-[9px] bg-emerald-50 text-emerald-700 px-1.5 py-0.2 rounded font-bold">
                    Rx Taken
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  456 - 512 kcal · Oats, Berries, Metformin 500mg
                </span>
              </div>
            </div>
            <button 
              onClick={() => showToast('Breakfast food items verified.')}
              className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-800 flex items-center justify-center font-bold text-sm active:scale-95 transition cursor-pointer"
            >
              +
            </button>
          </div>

          {/* Lunch */}
          <div className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100 flex items-center justify-between">
            <div className="flex items-center space-x-2.5">
              <img
                alt="Lunch"
                className="w-11 h-11 rounded-xl object-cover"
                src="https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=120&q=80"
              />
              <div>
                <div className="flex items-center space-x-1.5">
                  <h5 className="text-xs font-bold text-neutral-900">Lunch time</h5>
                  <span className="text-[9px] bg-sky-50 text-sky-700 px-1.5 py-0.2 rounded font-medium">
                    Scheduled
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 block mt-0.5">
                  456 - 512 kcal · Glycemic Paced Salad Bowl
                </span>
              </div>
            </div>
            <button 
              onClick={() => openOcrModal()}
              className="w-7 h-7 rounded-lg bg-[#97E432] text-neutral-950 flex items-center justify-center font-bold text-sm shadow-glow-lime active:scale-95 transition cursor-pointer"
            >
              +
            </button>
          </div>
        </div>
      </section>

      {/* 7. Weekly Progress Ring */}
      <section className="bg-limeSoft rounded-2xl p-4 shadow-soft flex items-center justify-between">
        <div>
          <span className="inline-flex items-center space-x-1 bg-white/70 px-2 py-0.5 rounded-full text-[10px] font-semibold text-neutral-700 mb-1.5">
            <span>⚡</span>
            <span>Your Weekly Progress</span>
          </span>
          <h3 className="text-sm font-bold text-neutral-900">Weekly Adherence: 91%</h3>
          <p className="text-[11px] text-neutral-600 mt-0.5">6 of 7 adherence days complete</p>
        </div>
        <div className="relative w-16 h-16 flex items-center justify-center">
          <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="38" fill="transparent" stroke="rgba(255, 255, 255, 0.8)" strokeWidth="12" />
            <circle
              cx="50"
              cy="50"
              r="38"
              fill="transparent"
              stroke="#97E432"
              strokeWidth="12"
              strokeDasharray={238.7}
              strokeDashoffset={21.5}
              strokeLinecap="round"
            />
          </svg>
          <span className="absolute text-xs font-black text-neutral-900">91%</span>
        </div>
      </section>

      {/* 8. 2x2 Telemetry Grid */}
      <section className="grid grid-cols-2 gap-2.5">
        {/* Step to walk */}
        <div className="bg-white p-3 rounded-2xl shadow-soft border border-neutral-100">
          <div className="flex justify-between items-center text-neutral-500 mb-1">
            <span className="text-[10px] font-semibold">Step to walk</span>
            <span className="material-symbols-outlined text-[14px] text-orange-500">directions_walk</span>
          </div>
          <div className="text-base font-bold text-neutral-900">
            5,500 <span className="text-[10px] font-normal text-neutral-400">/ 7k</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-orange-400 h-full w-3/4 rounded-full"></div>
          </div>
        </div>

        {/* Drink Water */}
        <div 
          onClick={() => {
            if (onOpenScreen) {
              onOpenScreen('hydration_pacing');
            } else {
              setWaterGlasses(waterGlasses + 1);
              showToast(`Water logged! Total today: ${waterGlasses + 1} glasses`);
            }
          }}
          className="bg-white p-3 rounded-2xl shadow-soft border border-neutral-100 cursor-pointer active:scale-95 transition"
        >
          <div className="flex justify-between items-center text-neutral-500 mb-1">
            <span className="text-[10px] font-semibold">Drink Water</span>
            <span className="material-symbols-outlined text-[14px] text-sky-500">water_drop</span>
          </div>
          <div className="text-base font-bold text-neutral-900">
            {waterGlasses} <span className="text-[10px] font-normal text-neutral-400">glass</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-sky-400 h-full w-5/6 rounded-full"></div>
          </div>
        </div>

        {/* Calories */}
        <div 
          onClick={() => onOpenScreen ? onOpenScreen('nutrition_dashboard') : navigateToTab?.('vitals')}
          className="bg-white p-3 rounded-2xl shadow-soft border border-neutral-100 cursor-pointer active:scale-95 transition"
        >
          <div className="flex justify-between items-center text-neutral-500 mb-1">
            <span className="text-[10px] font-semibold">Calories</span>
            <span className="material-symbols-outlined text-[14px] text-amber-500">local_fire_department</span>
          </div>
          <div className="text-base font-bold text-neutral-900">
            1,250 <span className="text-[10px] font-normal text-neutral-400">/ 1,920 Kcal</span>
          </div>
          <div className="w-full bg-neutral-100 h-1.5 rounded-full mt-1.5 overflow-hidden">
            <div className="bg-amber-500 h-full w-3/5 rounded-full"></div>
          </div>
        </div>

        {/* Heart Rate / BPM */}
        <div 
          onClick={() => onOpenScreen ? onOpenScreen('vitals') : navigateToTab?.('vitals')}
          className="bg-white p-3 rounded-2xl shadow-soft border border-neutral-100 cursor-pointer active:scale-95 transition"
        >
          <div className="flex justify-between items-center text-neutral-500 mb-1">
            <span className="text-[10px] font-semibold">Heart Rate / BPM</span>
            <span className="material-symbols-outlined text-[14px] text-red-500 animate-pulse">favorite</span>
          </div>
          <div className="text-base font-bold text-neutral-900">
            86 <span className="text-[10px] font-normal text-red-600">bpm</span>
          </div>
          <span className="text-[9px] text-emerald-600 font-medium block mt-1">● Live ECG Resting</span>
        </div>
      </section>

      {/* 9. Doctor Appointment with Summary Share Trigger */}
      <section className="bg-gradient-to-br from-white to-sky-50/60 rounded-2xl p-3.5 shadow-soft border border-neutral-100">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-wider text-sky-700 bg-sky-100 px-2 py-0.5 rounded-full">
            Next Consult
          </span>
          <span className="text-[11px] font-bold text-neutral-800">Thursday 12 Nov · 10:30</span>
        </div>
        <div 
          onClick={() => onOpenScreen?.('physician_dossier')}
          className="cursor-pointer hover:opacity-80 transition"
        >
          <h4 className="text-xs font-bold text-neutral-900">Dr. K. Weber · Endocrinology</h4>
          <p className="text-[10px] text-neutral-600 mt-1 mb-2.5">
            Preparation: Latest HbA1c & 14-day telemetry summary ready
          </p>
        </div>
        <button 
          onClick={() => openPdfModal()}
          className="w-full py-1.5 px-3 rounded-xl bg-white border border-neutral-200 hover:bg-neutral-50 flex items-center justify-center space-x-1.5 text-[11px] font-bold text-neutral-800 shadow-sm active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px] text-sky-600">send</span>
          <span>Send summary to Dr. Weber</span>
        </button>
      </section>
    </div>
  );
}
