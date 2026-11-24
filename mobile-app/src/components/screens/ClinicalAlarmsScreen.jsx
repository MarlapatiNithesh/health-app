import React, { useState } from 'react';

export default function ClinicalAlarmsScreen({ onOpenScreen }) {
  const [masterAlarms, setMasterAlarms] = useState(true);
  const [morningAlarm, setMorningAlarm] = useState(true);
  const [eveningAlarm, setEveningAlarm] = useState(true);
  const [glucosePacing, setGlucosePacing] = useState(true);
  const [toastText, setToastText] = useState('');

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 2500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 shadow-xs">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreen?.('care')}
              aria-label="Back"
              className="w-10 h-10 rounded-full flex items-center justify-center text-slate-800 hover:bg-slate-100"
            >
              <span className="material-symbols-outlined text-[24px]">arrow_back</span>
            </button>
            <h1 className="text-[17px] font-bold text-slate-900 tracking-tight">Clinical Alarms & Schedule</h1>
          </div>
          <button
            type="button"
            onClick={() => onOpenScreen?.('profile')}
            className="w-8 h-8 rounded-full bg-[#97E432] text-black font-bold flex items-center justify-center text-sm shadow-xs"
          >
            SR
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-4">
        {/* Master Control Card */}
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#ecfccb] flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px] text-[#4d7c0f]">notifications_active</span>
              </div>
              <div>
                <p className="text-xs font-bold text-slate-900">Smart Adaptive Chimes & Push</p>
                <p className="text-[11px] text-slate-500">Auto-escalates sound based on activity</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMasterAlarms(!masterAlarms)}
              className={`w-12 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                masterAlarms ? 'bg-[#97E432]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                masterAlarms ? 'translate-x-6' : 'translate-x-0'
              }`}></div>
            </button>
          </div>

          {/* Next Up Alert Pill */}
          <div className="bg-gradient-to-r from-[#ecfccb] to-lime-50 rounded-2xl p-3 flex items-center gap-3 border border-[#bef264]/40">
            <div className="w-8 h-8 rounded-full bg-[#97E432] text-black flex items-center justify-center shrink-0 shadow-xs">
              <span className="material-symbols-outlined text-[18px]">alarm</span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[#3f6212] font-black uppercase tracking-wider">
                  Next Up • 42 mins
                </span>
                <span className="text-[11px] text-slate-600 font-bold">08:00 AM</span>
              </div>
              <p className="text-xs text-slate-800 font-bold truncate mt-0.5">
                Breakfast Window · Morning Rx (Telmisartan 40mg)
              </p>
            </div>
          </div>
        </div>

        {/* Section: Medication Regimen Alarms */}
        <section className="space-y-2.5">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-500">Medication Alarms</h3>
            <span className="text-[10px] font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">
              2 Scheduled
            </span>
          </div>

          {/* Alarm 1: Morning */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ecfccb] text-[#3f6212] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">pill</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#4d7c0f] uppercase font-bold tracking-wider">Morning Dose</span>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Vasodilator & Vitals</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setMorningAlarm(!morningAlarm)}
                className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                  morningAlarm ? 'bg-[#97E432]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  morningAlarm ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">08:00</span>
                <span className="text-xs font-bold text-slate-400">AM</span>
              </div>
              <span className="text-[11px] font-bold text-lime-800 bg-lime-100 px-2 py-0.5 rounded-full">
                With Food
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-lime-700">medication</span>
                <span className="font-bold text-slate-900">Telmisartan 40 mg</span>
                <span className="text-slate-400">(1 Tab with water)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-slate-400">volume_up</span>
                <span>High Priority Chime + Haptic Pulse</span>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
                <span
                  key={i}
                  className="w-7 h-7 rounded-full bg-[#97E432] text-black flex items-center justify-center text-[10px] font-black"
                >
                  {d}
                </span>
              ))}
            </div>
          </div>

          {/* Alarm 2: Evening */}
          <div className="bg-white rounded-2xl p-4 shadow-xs border border-slate-100 space-y-3">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-purple-50 text-purple-700 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[20px]">pill</span>
                </div>
                <div>
                  <span className="text-[10px] text-purple-700 uppercase font-bold tracking-wider">Bedtime Dose</span>
                  <h4 className="text-xs font-bold text-slate-900 leading-tight">Lipid Regulator</h4>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEveningAlarm(!eveningAlarm)}
                className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                  eveningAlarm ? 'bg-[#97E432]' : 'bg-slate-300'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  eveningAlarm ? 'translate-x-5' : 'translate-x-0'
                }`}></div>
              </button>
            </div>

            <div className="flex items-center justify-between bg-slate-50 p-2.5 rounded-xl">
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-slate-900">09:30</span>
                <span className="text-xs font-bold text-slate-400">PM</span>
              </div>
              <span className="text-[11px] font-bold text-purple-800 bg-purple-100 px-2 py-0.5 rounded-full">
                Bedtime
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[16px] text-purple-700">medication</span>
                <span className="font-bold text-slate-900">Atorvastatin 20 mg</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section: Chrono-Meal Windows */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-lime-700 text-[20px]">restaurant</span>
              <h3 className="text-xs font-bold text-slate-900">Intermittent Fasting & Meal Windows</h3>
            </div>
            <span className="text-[10px] font-bold bg-lime-100 text-lime-900 px-2 py-0.5 rounded-full">16:8 Protocol</span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-2.5 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-400 font-semibold">Eating Window Opens</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">11:00 AM</p>
            </div>
            <div className="p-2.5 rounded-2xl bg-slate-50">
              <span className="text-[10px] text-slate-400 font-semibold">Fasting Window Begins</span>
              <p className="text-sm font-black text-slate-900 mt-0.5">07:00 PM</p>
            </div>
          </div>
        </section>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={() => showToast('Smart Chrono-Alarms synchronized with Watch')}
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">alarm_on</span>
            <span>Save Alarm Schedules</span>
          </button>
        </div>
      </main>

      {/* Toast */}
      {toastText && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-lime-400 text-[18px]">verified</span>
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}

