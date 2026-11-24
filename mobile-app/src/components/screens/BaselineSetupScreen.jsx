import React, { useState } from 'react';

export default function BaselineSetupScreen({ onNavigateNext, onOpenScreen }) {
  const [bpTarget, setBpTarget] = useState('optimal');
  const [glucoseBenchmark, setGlucoseBenchmark] = useState('normal');
  const [dietaryFrameworks, setDietaryFrameworks] = useState(['low_gi', 'cardio']);
  const [guardianActive, setGuardianActive] = useState(true);

  const toggleFramework = (id) => {
    if (dietaryFrameworks.includes(id)) {
      setDietaryFrameworks(dietaryFrameworks.filter((f) => f !== id));
    } else {
      setDietaryFrameworks([...dietaryFrameworks, id]);
    }
  };

  const handleNext = () => {
    if (onNavigateNext) {
      onNavigateNext();
    } else if (onOpenScreen) {
      onOpenScreen('wearable_sync');
    }
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-full flex-1 bg-[#f8fafc] text-slate-900 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Bar */}
      <header className="shrink-0 z-40 bg-[#f8fafc]/95 backdrop-blur-md border-b border-slate-100">
        <div className="h-16 px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => onOpenScreen?.('signup_dedicated')}
              aria-label="Go back"
              className="w-10 h-10 rounded-full bg-white border border-slate-200/80 flex items-center justify-center text-slate-700 shadow-xs"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <span className="text-base font-bold text-slate-900 tracking-tight">Biometrics</span>
          </div>
          <button
            type="button"
            className="w-10 h-10 rounded-full bg-[#84cc16] text-slate-950 flex items-center justify-center shadow-xs font-bold"
          >
            <span className="material-symbols-outlined text-[20px] font-bold">help</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-28 flex flex-col w-full">
        {/* Stepper Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f7fee7] border border-[#bef264] shadow-xs">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#84cc16] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#65a30d]"></span>
            </span>
            <span className="text-[11px] font-bold tracking-tight text-[#1a2e05] uppercase">
              STEP 2 OF 3 • BASELINE VITALS & DIET
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-8 h-2 rounded-full bg-[#84cc16]"></div>
            <div className="w-8 h-2 rounded-full bg-[#84cc16]"></div>
            <div className="w-8 h-2 rounded-full bg-slate-200"></div>
          </div>
        </div>

        {/* Title & Intro */}
        <div className="mb-5">
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Calibrate Your Baseline</h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Help MediBot AI personalize your glycemic curve thresholds, OCR plate diagnostics, and real-time safety alerts.
          </p>
        </div>

        {/* Cards */}
        <div className="flex flex-col gap-3.5 mb-6">
          {/* Card 1: Blood Pressure */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#f7fee7] border border-[#ecfccb] text-[#4d7c0f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[17px]">favorite</span>
                </div>
                <span className="text-xs font-bold text-slate-900 tracking-tight">Resting Blood Pressure Target</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">mmHg</span>
            </div>

            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => setBpTarget('optimal')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  bpTarget === 'optimal'
                    ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                    : 'bg-slate-50 border border-slate-200/80'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center font-bold ${
                    bpTarget === 'optimal' ? 'bg-[#84cc16] text-slate-950' : 'bg-slate-200 text-transparent'
                  }`}>
                    <span className="material-symbols-outlined text-[14px] font-bold">check</span>
                  </div>
                  <span className="text-xs font-bold text-slate-900">&lt;120/80 (Normal)</span>
                </div>
                <span className="text-[10px] font-bold text-[#365314] bg-[#bef264] px-2 py-0.5 rounded-full">Optimal</span>
              </button>

              <button
                type="button"
                onClick={() => setBpTarget('elevated')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  bpTarget === 'elevated'
                    ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                    : 'bg-slate-50 border border-slate-200/80'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700">120-129/80 (Elevated)</span>
                <span className="text-[10px] font-medium text-slate-400">Stage 0</span>
              </button>

              <button
                type="button"
                onClick={() => setBpTarget('stage1')}
                className={`w-full flex items-center justify-between p-3 rounded-xl transition-all ${
                  bpTarget === 'stage1'
                    ? 'bg-[#f7fee7] border-2 border-[#84cc16]'
                    : 'bg-slate-50 border border-slate-200/80'
                }`}
              >
                <span className="text-xs font-semibold text-slate-700">130+/80+ (Stage 1)</span>
                <span className="text-[10px] font-medium text-slate-400">Monitor</span>
              </button>
            </div>
          </div>

          {/* Card 2: Fasting Glucose Benchmark */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#f7fee7] border border-[#ecfccb] text-[#4d7c0f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[17px]">water_drop</span>
                </div>
                <span className="text-xs font-bold text-slate-900 tracking-tight">Fasting Glucose Benchmark</span>
              </div>
              <span className="text-[11px] font-semibold text-slate-400">mg/dL</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setGlucoseBenchmark('normal')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-bold ${
                  glucoseBenchmark === 'normal'
                    ? 'bg-[#f7fee7] border-2 border-[#84cc16] text-slate-900 shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-600'
                }`}
              >
                <span className="material-symbols-outlined text-[15px] text-[#4d7c0f] font-bold">check_circle</span>
                <span>Normal (&lt;100)</span>
              </button>
              <button
                type="button"
                onClick={() => setGlucoseBenchmark('prediabetic')}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl text-xs font-semibold ${
                  glucoseBenchmark === 'prediabetic'
                    ? 'bg-[#f7fee7] border-2 border-[#84cc16] text-slate-900 shadow-xs'
                    : 'bg-slate-50 border border-slate-200 text-slate-600'
                }`}
              >
                <span>Pre-Diabetic (100–125)</span>
              </button>
            </div>
          </div>

          {/* Card 3: Primary Dietary Framework */}
          <div className="bg-white rounded-2xl p-4 border border-slate-100 shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#f7fee7] border border-[#ecfccb] text-[#4d7c0f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[17px]">restaurant</span>
                </div>
                <span className="text-xs font-bold text-slate-900 tracking-tight">Primary Dietary Framework</span>
              </div>
              <span className="text-[10px] font-bold text-[#365314] bg-[#bef264]/70 px-2 py-0.5 rounded-full">Select 1 or more</span>
            </div>
            <p className="text-[11px] text-slate-500 mb-3">AI will match grocery cart items & meal scans against this framework.</p>
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'low_gi', label: 'Low Glycemic (GI)' },
                { id: 'cardio', label: 'Cardio-Protective' },
                { id: 'plant', label: 'Plant-Based' },
                { id: 'keto', label: 'Keto / Low-Carb' },
                { id: 'fasting', label: 'Intermittent Fasting (16:8)' },
              ].map((diet) => {
                const isSelected = dietaryFrameworks.includes(diet.id);
                return (
                  <button
                    key={diet.id}
                    type="button"
                    onClick={() => toggleFramework(diet.id)}
                    className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
                      isSelected
                        ? 'bg-[#84cc16] text-slate-950 shadow-xs'
                        : 'bg-slate-50 border border-slate-200 text-slate-600'
                    }`}
                  >
                    {isSelected && <span className="material-symbols-outlined text-[14px] font-bold">check</span>}
                    {diet.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Card 4: CloseOne Guardian Safety Safeguard */}
          <div className="bg-[#f7fee7] border border-[#d9f99d] p-4 rounded-2xl shadow-xs">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#84cc16] text-slate-950 flex items-center justify-center shadow-xs">
                  <span className="material-symbols-outlined text-[19px] font-bold">shield_with_heart</span>
                </div>
                <div>
                  <span className="block text-[10px] font-bold uppercase tracking-wider text-[#4d7c0f]">CLOSEONE GUARDIAN</span>
                  <h3 className="text-xs font-black text-slate-900">Safety Alert Safeguard</h3>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGuardianActive(!guardianActive)}
                className={`w-12 h-6 px-0.5 rounded-full flex items-center transition-colors ${
                  guardianActive ? 'bg-[#84cc16]' : 'bg-slate-300'
                }`}
              >
                <span className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                  guardianActive ? 'translate-x-6' : 'translate-x-0'
                }`}></span>
              </button>
            </div>
            <div className="p-3 rounded-xl bg-white/80 border border-[#d9f99d]/60 mb-2">
              <p className="text-xs text-slate-700 leading-relaxed">
                <strong className="font-bold text-slate-900">AI Safeguard Threshold:</strong> Auto-configured to notify <span className="font-bold text-[#365314] underline decoration-[#84cc16]">Sarah (Spouse)</span> if postprandial glucose exceeds <span className="font-bold text-slate-900">140 mg/dL</span> or sodium breaches <span className="font-bold text-slate-900">2,300mg/day</span>.
              </p>
            </div>
            <div className="flex items-center justify-between text-xs px-0.5">
              <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#65a30d]">autorenew</span>
                Auto-Tune Guardian Triggers: <strong className="text-[#365314] font-bold">Active</strong>
              </span>
              <button
                type="button"
                onClick={() => onOpenScreen?.('guardian_setup')}
                className="text-[11px] font-bold text-[#4d7c0f] hover:underline"
              >
                Edit Contact
              </button>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => onOpenScreen?.('today')}
          className="text-xs text-slate-600 font-bold hover:text-slate-900 py-1 transition-colors mx-auto flex items-center gap-1 cursor-pointer"
        >
          <span>Skip & Go Directly to Today Dashboard</span>
          <span className="material-symbols-outlined text-[15px]">arrow_forward</span>
        </button>
      </main>

      {/* Bottom Sticky Action Bar */}
      <div className="shrink-0 w-full px-4 pt-3 pb-4 bg-[#f8fafc]/95 backdrop-blur-md border-t border-slate-100 z-40 flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenScreen?.('today')}
          className="w-full py-3.5 rounded-full bg-[#84cc16] hover:bg-[#74b312] text-slate-950 font-extrabold text-base shadow-lg shadow-[#84cc16]/30 flex items-center justify-center gap-2 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span>Save & Go to Today Dashboard</span>
          <span className="material-symbols-outlined text-[20px] font-bold">check_circle</span>
        </button>
      </div>
    </div>
  );
}

