import React, { useState } from 'react';

export default function PhysicianDossierScreen({ onOpenScreen, onOpenSos }) {
  const [viewMode, setViewMode] = useState('clinical');
  const [toastText, setToastText] = useState('');

  const handleExport = () => {
    setToastText('Exporting FHIR HL7 JSON & Signed PDF Dossier...');
    setTimeout(() => setToastText('Dossier generated and ready to download!'), 1500);
    setTimeout(() => setToastText(''), 3500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Bar */}
      <header className="w-full z-40 bg-white/90 backdrop-blur-md border-b border-slate-100 flex-shrink-0 shadow-xs">
        <div className="h-16 px-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <button
              type="button"
              onClick={() => onOpenScreen?.('records')}
              className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center text-slate-700"
            >
              <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            </button>
            <div className="flex flex-col min-w-0">
              <span className="font-bold text-slate-900 text-[16px] leading-tight truncate">Physician Dossier</span>
              <span className="text-[11px] text-slate-500">Dexcom G7 & Watch Ultra 2</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button
              type="button"
              onClick={handleExport}
              className="px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-[14px]">picture_as_pdf</span>
              <span>Export</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Scrollable Content */}
      <main className="flex-1 overflow-y-auto px-4 pt-3 pb-28 space-y-3.5">
        {/* Top Controls */}
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Clinical Dossier View</span>
          <div className="flex items-center bg-slate-100 rounded-full p-0.5 border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('clinical')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                viewMode === 'clinical' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Clinical
            </button>
            <button
              type="button"
              onClick={() => setViewMode('concise')}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                viewMode === 'concise' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500'
              }`}
            >
              Concise
            </button>
          </div>
        </div>

        {/* Patient Identity Dossier Card */}
        <div className="relative bg-white rounded-3xl p-4 border border-[#e4f4d2] shadow-xs overflow-hidden">
          <div className="flex items-start gap-3.5 relative">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#84cc16] to-[#bef264] flex items-center justify-center text-slate-950 font-bold text-xl shadow-xs shrink-0">
              SR
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h2 className="text-[18px] font-black text-slate-900 truncate">Sajibur Rahman</h2>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
                  MRN #8420-SR
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[12px] text-slate-600 font-medium">34 yrs · Male</span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="text-[12px] font-bold text-[#365314] bg-[#ecfccb] px-1.5 py-0.2 rounded">
                  Blood A+
                </span>
                <span className="w-1 h-1 rounded-full bg-slate-300"></span>
                <span className="text-[12px] text-slate-600 font-medium">BMI 24.1</span>
              </div>
              <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
                <span className="material-symbols-outlined text-[#65a30d] text-[16px]">stethoscope</span>
                <p className="text-[11px] text-slate-600 truncate">
                  <span className="font-bold text-slate-900">Dr. Elena Chen, MD</span> · Primary Cardiometabolic
                </p>
              </div>
            </div>
          </div>

          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#84cc16] animate-pulse"></span>
              <span>Dexcom G7 & Watch Ultra 2</span>
            </div>
            <span className="text-[#365314] font-bold bg-[#f7fee7] px-2 py-0.5 rounded-full border border-[#bef264]">
              Continuous Stream
            </span>
          </div>
        </div>

        {/* Allergy & Contraindication */}
        <div className="bg-rose-50/70 border border-rose-200/80 rounded-2xl p-3 flex items-start gap-2.5">
          <div className="w-7 h-7 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center flex-shrink-0 mt-0.5">
            <span className="material-symbols-outlined text-[17px]">warning</span>
          </div>
          <div className="flex flex-col min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-rose-700 font-extrabold tracking-tight">ALLERGY & CONTRAINDICATION</span>
              <span className="px-1.5 py-0.2 rounded bg-rose-200/70 text-rose-800 text-[9px] font-bold">MODERATE</span>
            </div>
            <p className="text-[12px] text-slate-700 mt-0.5 leading-snug">
              <span className="font-bold text-slate-900">Penicillin</span> (cutaneous rash, urticaria). NSAIDs well-tolerated.
            </p>
          </div>
        </div>

        {/* Comprehensive Patient History 4-Domain Bento */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[#65a30d] text-[18px]">clinical_notes</span>
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">Patient History Bento</h3>
            </div>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#ecfccb] text-[#365314]">4 Domains</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-white rounded-2xl p-3 border border-[#e4f4d2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#365314]">Surgical & Inpatient</span>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                <li><strong>2019:</strong> ACL Repair (R knee)</li>
                <li><strong>2016:</strong> Appendectomy</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-[#e4f4d2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#365314]">Family History</span>
              <ul className="mt-1.5 space-y-1 text-[11px] text-slate-700">
                <li><strong>Father:</strong> T2D (onset 58)</li>
                <li><strong>Mother:</strong> Hypertension</li>
              </ul>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-[#e4f4d2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#365314]">Metabolic Baseline</span>
              <p className="mt-1 text-[11px] text-slate-700">
                HbA1c 5.4% · eAG 108 mg/dL · TIR 96%
              </p>
            </div>

            <div className="bg-white rounded-2xl p-3 border border-[#e4f4d2] shadow-xs">
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#365314]">Active Regimen</span>
              <p className="mt-1 text-[11px] text-slate-700">
                Atorvastatin 20mg · Omega-3 1000mg
              </p>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleExport}
            className="w-full py-3.5 bg-[#84cc16] hover:bg-[#78b814] text-neutral-900 font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">share</span>
            <span>Transmit Clinical FHIR Dossier</span>
          </button>
        </div>

        {/* Toast */}
        {toastText && (
          <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 z-50">
            <span className="material-symbols-outlined text-lime-400 text-[18px]">verified</span>
            <span>{toastText}</span>
          </div>
        )}
      </main>
    </div>
  );
}

