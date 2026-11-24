import React, { useState } from 'react';

export function FhirPdfModal({ isOpen, onClose }) {
  const [downloading, setDownloading] = useState(false);
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleDownload = () => {
    setDownloading(true);
    setTimeout(() => {
      setDownloading(false);
      alert('FHIR HL7 Clinical Summary PDF downloaded successfully to Files.');
    }, 600);
  };

  const handleSendToDoctor = () => {
    setSending(true);
    setTimeout(() => {
      setSending(false);
      alert('Encrypted direct transfer successfully delivered to Dr. K. Weber EHR Portal (Epic / Cerner FHIR Bridge).');
      onClose();
    }, 800);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in select-none">
      <div className="bg-white w-full max-w-[350px] rounded-3xl p-4 shadow-2xl border border-neutral-100 max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-red-500 text-[20px]">picture_as_pdf</span>
            <h3 className="text-xs font-bold text-neutral-900">FHIR HL7 Summary for Dr. Weber</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* PDF Simulated Document Container */}
        <div className="flex-1 overflow-y-auto p-3.5 bg-neutral-50 rounded-2xl border border-neutral-200 text-[11px] space-y-2.5 text-neutral-800 no-scrollbar">
          <div className="border-b border-neutral-200 pb-2 flex justify-between items-start">
            <div>
              <strong className="text-neutral-900 block text-xs">CLINICAL DISCHARGE & TELEMETRY EXPORT</strong>
              <span className="text-[10px] text-neutral-500">Patient: Anna Martinez (54F) · MRN: #FIT-84920</span>
            </div>
            <span className="text-[8px] bg-emerald-100 text-emerald-800 font-mono px-1.5 py-0.5 rounded font-bold">HL7 v3.0</span>
          </div>

          <div>
            <strong className="text-neutral-900 block text-[11px] mb-0.5">Primary Diagnoses:</strong>
            <ul className="list-disc list-inside text-neutral-600 text-[10px] space-y-0.5">
              <li>ICD-10-E11.9: Type 2 Diabetes Mellitus without complications</li>
              <li>ICD-10-I10: Essential Primary Hypertension</li>
            </ul>
          </div>

          <div>
            <strong className="text-neutral-900 block text-[11px] mb-0.5">14-Day Continuous Telemetry:</strong>
            <p className="text-neutral-600 text-[10px] leading-relaxed">
              Blood Pressure: 128/82 mmHg · Resting Pulse: 71 bpm · SpO2: 98% · Sleep Avg: 7h 12m · Overall Adherence: 94%
            </p>
          </div>

          <div>
            <strong className="text-neutral-900 block text-[11px] mb-0.5">Verified Lab Certifications:</strong>
            <p className="text-neutral-600 text-[10px]">HbA1c 7.4% (Quest Diagnostics, 28 Oct 2026)</p>
            <p className="text-neutral-400 font-mono text-[9px] mt-0.5">SHA-256: 8f9b4c021e90ac117d9832aa410b</p>
          </div>

          <div className="bg-white p-2 rounded-xl border border-neutral-200 text-[10px] space-y-1">
            <span className="font-bold text-neutral-900 block">Active Medication Regimen:</span>
            <div className="flex justify-between">
              <span>Metformin HCl 500mg (BID)</span>
              <span className="text-emerald-700 font-bold">Adherence 96%</span>
            </div>
            <div className="flex justify-between">
              <span>Amlodipine 5mg (Morning)</span>
              <span className="text-emerald-700 font-bold">Adherence 92%</span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-3 shrink-0">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl text-xs flex items-center justify-center space-x-1 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">download</span>
            <span>{downloading ? 'Downloading...' : 'Download'}</span>
          </button>
          <button
            onClick={handleSendToDoctor}
            disabled={sending}
            className="flex-1 py-2 bg-[#97E432] hover:bg-limeAccent text-neutral-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1 shadow-glow-lime active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[15px]">send</span>
            <span>{sending ? 'Delivering...' : 'Send to Doctor'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

