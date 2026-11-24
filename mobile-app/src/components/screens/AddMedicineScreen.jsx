import React, { useState } from 'react';

export default function AddMedicineScreen({ onBack, onOpenScreen, onAddSuccess }) {
  const [medName, setMedName] = useState('Metformin Hydrochloride XR');
  const [dosage, setDosage] = useState('500mg');
  const [time, setTime] = useState('08:00 PM');
  const [instructions, setInstructions] = useState('Take with evening meal');
  const [toastText, setToastText] = useState('');

  const handleSave = (e) => {
    e.preventDefault();
    setToastText('Rx Confirmed! Synced with Chrono-Care Regimen');
    setTimeout(() => {
      if (onAddSuccess) onAddSuccess();
      else if (onOpenScreen) onOpenScreen('care');
    }, 1200);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#faf8ff] text-[#131b2e] flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-100 flex items-center justify-between px-4 h-16 shadow-xs">
        <button
          type="button"
          onClick={onBack || (() => onOpenScreen?.('care'))}
          aria-label="Back"
          className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-800"
        >
          <span className="material-symbols-outlined text-[20px]">arrow_back</span>
        </button>
        <div className="flex flex-col text-center">
          <h1 className="text-base font-bold text-slate-900 leading-tight">Add Medicine & OCR</h1>
          <span className="text-[11px] text-slate-500">Rx Label Verification</span>
        </div>
        <div className="w-10"></div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5">
        {/* OCR Verification Banner Card */}
        <div className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[22px]">center_focus_strong</span>
              </div>
              <div>
                <h3 className="text-xs font-bold text-slate-900 leading-tight">Prescription Bottle OCR Scan</h3>
                <p className="text-[11px] text-slate-500">Rx #99281-04 · Captured via Vision AI</p>
              </div>
            </div>
            <span className="px-2 py-0.5 rounded-full bg-[#ecfccb] text-[#365314] text-[10px] font-bold">
              100% Match
            </span>
          </div>

          {/* Comparative EHR Reconciliation */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800">EHR Cross-Match Verified</span>
              <span className="text-emerald-700 font-bold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[14px]">check_circle</span>
                Cleared
              </span>
            </div>
            <p className="text-slate-600">
              Dr. Elena Chen, MD (Endocrinologist) · Diagnosis: Type 2 Diabetes & Impaired Fasting Glucose.
            </p>
          </div>

          {/* Drug Interaction Safety Alert */}
          <div className="p-3 rounded-2xl bg-[#f7fee7] border border-[#d9f99d] flex items-start gap-2.5">
            <div className="w-7 h-7 rounded-xl bg-[#84cc16] text-black flex items-center justify-center font-bold shrink-0 mt-0.5">
              <span className="material-symbols-outlined text-[17px]">shield</span>
            </div>
            <div className="flex-1 min-w-0">
              <h4 className="text-xs font-bold text-[#1a2e05]">No Adverse Drug Interactions</h4>
              <p className="text-[11px] text-[#365314] mt-0.5 leading-snug">
                Cleared against your active intake: <strong>Telmisartan 40mg</strong> & <strong>Omega-3</strong>.
              </p>
            </div>
          </div>
        </div>

        {/* Schedule & Intake Rules Form */}
        <form onSubmit={handleSave} className="bg-white rounded-3xl p-4 shadow-xs border border-slate-100 space-y-3.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
            Schedule & Intake Rules
          </h3>

          <div>
            <label className="text-[11px] text-slate-600 font-bold block mb-1">
              Prescribed Medication Name
            </label>
            <input
              type="text"
              value={medName}
              onChange={(e) => setMedName(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-lime-500"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] text-slate-600 font-bold block mb-1">Dosage</label>
              <input
                type="text"
                value={dosage}
                onChange={(e) => setDosage(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-lime-500"
                required
              />
            </div>
            <div>
              <label className="text-[11px] text-slate-600 font-bold block mb-1">Alarm Time</label>
              <input
                type="text"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-lime-500"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] text-slate-600 font-bold block mb-1">Clinical Instructions</label>
            <input
              type="text"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-900 focus:outline-none focus:border-lime-500"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <span className="material-symbols-outlined text-[18px]">verified</span>
            <span>Confirm & Add to Chrono-Regimen</span>
          </button>
        </form>
      </main>

      {/* Toast */}
      {toastText && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-lime-400 text-[18px]">check_circle</span>
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}

