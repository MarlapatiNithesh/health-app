import React, { useState } from 'react';

export default function HealthAnalyticsDossierScreen({ onOpenScreen }) {
  const [horizon, setHorizon] = useState('14');
  const [toastText, setToastText] = useState('');

  const handleExportPdf = () => {
    setToastText('Generating 14-Day AGP & Hemodynamic Dossier...');
    setTimeout(() => setToastText('Signed PDF ready!'), 1500);
    setTimeout(() => setToastText(''), 3500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Sub Header Bar */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-4 h-16 shadow-xs">
        <button
          type="button"
          onClick={() => onOpenScreen?.('vitals')}
          aria-label="Back"
          className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-800"
        >
          <span className="material-symbols-outlined text-[18px]">arrow_back</span>
        </button>
        <div className="flex-1 text-center min-w-0">
          <p className="text-[15px] font-bold text-slate-900 truncate">Health Analytics Dossier</p>
          <span className="inline-flex items-center gap-1 text-[11px] text-lime-700 font-semibold">
            <span className="w-1.5 h-1.5 rounded-full bg-lime-500 animate-pulse"></span>
            Biometric Sync Active
          </span>
        </div>
        <button
          type="button"
          onClick={handleExportPdf}
          className="px-2.5 py-1.5 rounded-full bg-[#bef264] text-slate-950 text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer"
        >
          <span className="material-symbols-outlined text-[15px]">picture_as_pdf</span>
          <span>PDF</span>
        </button>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5">
        {/* Timeframe Horizon Selector */}
        <section className="flex flex-col gap-1.5">
          <div className="flex items-center justify-between">
            <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold">Evaluation Horizon</span>
            <span className="text-[11px] text-lime-700 font-semibold">Continuous Sensor</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto py-1">
            {[
              { id: '7', label: '7 Days' },
              { id: '14', label: '14 Days (Clinical Standard)' },
              { id: '30', label: '30 Days' },
              { id: '90', label: '90 Days (Quarterly)' },
            ].map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setHorizon(tab.id)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                  horizon === tab.id
                    ? 'bg-[#97E432] text-black shadow-xs'
                    : 'bg-white text-slate-600 border border-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </section>

        {/* 14-Day AGP Profile Card */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-2xl flex items-center justify-center bg-[#ecfccb] text-[#4d7c0f]">
                <span className="material-symbols-outlined text-[20px]">show_chart</span>
              </div>
              <div>
                <h2 className="text-[15px] font-bold text-slate-900">{horizon}-Day AGP Profile</h2>
                <p className="text-[11px] text-slate-500">Ambulatory Glucose Telemetry</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#ecfccb] text-[#3f6212] font-bold text-[11px] flex items-center gap-1">
              <span className="material-symbols-outlined text-[13px]">verified</span>
              ADA Validated
            </span>
          </div>

          {/* TIR Hero Stat */}
          <div className="bg-[#f8fafc] rounded-2xl p-3 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                Time-in-Range (TIR 70–180)
              </span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="text-[28px] leading-tight text-slate-900 font-bold">88%</span>
                <span className="text-[13px] text-lime-700 font-bold">Optimal</span>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">Target &gt; 70% of readings</p>
            </div>
            <div className="w-14 h-14 relative flex items-center justify-center shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 36 36">
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#f1f5f9"
                  strokeWidth="3.5"
                />
                <path
                  d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                  fill="none"
                  stroke="#84cc16"
                  strokeDasharray="88, 100"
                  strokeLinecap="round"
                  strokeWidth="3.5"
                />
              </svg>
              <span className="absolute text-[11px] font-bold text-slate-900">+18%</span>
            </div>
          </div>

          {/* Stacked Range Bar */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-[11px] text-slate-500">
              <span>Glycemic Range Distribution</span>
              <span>1,344 Readings</span>
            </div>
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-slate-100">
              <div className="h-full bg-red-400" style={{ width: '1%' }}></div>
              <div className="h-full bg-amber-300" style={{ width: '8%' }}></div>
              <div className="h-full bg-[#84cc16]" style={{ width: '88%' }}></div>
              <div className="h-full bg-sky-400" style={{ width: '3%' }}></div>
            </div>
          </div>
        </section>

        {/* Cardiovascular Rhythm & Blood Pressure */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[18px]">ecg_heart</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900">Cardiovascular Rhythm</h3>
                <p className="text-[10px] text-slate-500">Resting HR & HRV stability</p>
              </div>
            </div>
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full">
              Stable
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center">
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold">Mean Resting HR</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">64 BPM</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-2xl">
              <span className="text-[10px] text-slate-400 font-semibold">HRV SDNN</span>
              <p className="text-lg font-black text-slate-900 mt-0.5">58 ms</p>
            </div>
          </div>
        </section>

        {/* Postprandial Response */}
        <section className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-lime-100 text-lime-800 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[18px]">restaurant</span>
              </div>
              <h3 className="text-xs font-bold text-slate-900">Postprandial Response</h3>
            </div>
            <span className="text-xs font-bold text-lime-800 bg-lime-100 px-2.5 py-0.5 rounded-full">
              Max 138 mg/dL
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            Zero excursions above the 140 mg/dL clinical threshold post meal ingestion.
          </p>
        </section>

        {/* Action Button */}
        <div className="pt-1">
          <button
            type="button"
            onClick={handleExportPdf}
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Export Analytics Dossier</span>
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

