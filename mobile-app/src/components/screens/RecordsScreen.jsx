import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export function RecordsScreen({ openOcrModal, openPdfModal }) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState('All Reports');
  const [uploadedDocs, setUploadedDocs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [shareToast, setShareToast] = useState('');

  const fetchDocs = async () => {
    try {
      setLoading(true);
      const res = await api.listDocuments?.();
      if (Array.isArray(res)) setUploadedDocs(res);
      else if (res?.documents) setUploadedDocs(res.documents);
    } catch {
      // Offline fallback
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocs();
  }, []);

  const handleShare = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText('https://vault.fitsure.health/records/sha256/8f9b4c021e90ac117d9832aa');
    }
    setShareToast('Encrypted secure link copied to clipboard for Dr. Weber.');
    setTimeout(() => setShareToast(''), 3000);
  };

  const sampleReports = [
    {
      id: 'quest-panel',
      type: 'Blood Panels',
      title: 'Comprehensive Metabolic & HbA1c',
      source: 'Quest Diagnostics · 28 Oct 2026',
      verified: true,
      sha: 'SHA-256 ✓',
      biomarkers: [
        { label: 'HbA1c', value: '7.4%', sub: '(Target <7.0)', status: 'amber' },
        { label: 'Fasting Glucose', value: '126 mg/dL', sub: '(High)', status: 'red' },
        { label: 'LDL Cholesterol', value: '118 mg/dL', sub: '', status: 'neutral' },
        { label: 'eGFR (Kidney)', value: '82 mL/min', sub: '(Optimal)', status: 'emerald' },
        { label: 'Serum Creatinine', value: '0.9 mg/dL (Normal Range)', sub: '', status: 'emerald', fullWidth: true },
      ],
    },
    {
      id: 'echo-cardio',
      type: 'Doctor Notes',
      title: 'Echocardiogram & LVEF',
      source: '62% Ejection Fraction · Normal',
      icon: 'ecg_heart',
      verified: true,
    },
    {
      id: 'rx-weber',
      type: 'Prescriptions',
      title: 'Endocrinology Regimen: Metformin & Amlodipine',
      source: 'Dr. K. Weber · Clinic #8841 · 12 Aug 2026',
      icon: 'medication',
      verified: true,
    },
  ];

  const filteredReports = sampleReports.filter((item) => {
    const matchesFilter = activeFilter === 'All Reports' || item.type === activeFilter;
    const matchesSearch = !searchQuery || 
      item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.source.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="p-4 space-y-3.5 pb-28 select-none text-charcoal bg-appBg min-h-full">
      {shareToast && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-neutral-700 animate-fade-in flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#97E432]">check_circle</span>
          <span>{shareToast}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Clinical Records Vault</h2>
          <p className="text-[10px] text-neutral-500">Encrypted FHIR HL7 Health Storage</p>
        </div>
        <button 
          onClick={openOcrModal}
          className="px-2.5 py-1.5 rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-[10px] flex items-center space-x-1 active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">document_scanner</span>
          <span>Scan Lab</span>
        </button>
      </div>

      {/* Search Bar with Ask prompt */}
      <div className="relative">
        <input 
          type="text" 
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search or 'Ask: show my latest HbA1c'..." 
          className="w-full bg-white border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#97E432]"
        />
        <button className="absolute right-2.5 top-2.5 text-neutral-400 hover:text-neutral-700">
          <span className="material-symbols-outlined text-[16px]">search</span>
        </button>
      </div>

      {/* Filter Chips */}
      <div className="flex space-x-1.5 overflow-x-auto no-scrollbar py-0.5">
        {['All Reports', 'Blood Panels', 'Prescriptions', 'Doctor Notes'].map((chip) => {
          const isActive = activeFilter === chip;
          return (
            <button
              key={chip}
              onClick={() => setActiveFilter(chip)}
              className={`px-2.5 py-1 rounded-full text-[10px] font-semibold whitespace-nowrap transition cursor-pointer ${
                isActive
                  ? 'bg-neutral-900 text-white'
                  : 'bg-white border border-neutral-200 text-neutral-700 hover:bg-neutral-50'
              }`}
            >
              {chip}
            </button>
          );
        })}
      </div>

      {/* Reports List */}
      <div className="space-y-3">
        {filteredReports.map((report) => {
          if (report.id === 'quest-panel') {
            return (
              <div key={report.id} className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <span className="text-[9px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-full">
                      Verified Lab Report
                    </span>
                    <h3 className="text-xs font-bold text-neutral-900 mt-1">{report.title}</h3>
                    <p className="text-[10px] text-neutral-400">{report.source}</p>
                  </div>
                  <span className="text-[9px] font-mono bg-emerald-50 text-emerald-800 px-1.5 py-0.5 rounded font-bold">
                    {report.sha}
                  </span>
                </div>

                {/* 5 Biomarkers */}
                <div className="grid grid-cols-2 gap-2 my-3 text-[11px]">
                  {report.biomarkers.map((bio, idx) => (
                    <div
                      key={idx}
                      className={`p-2 rounded-xl border ${
                        bio.fullWidth ? 'col-span-2' : ''
                      } ${
                        bio.status === 'amber'
                          ? 'bg-amber-50/80 border-amber-100'
                          : bio.status === 'red'
                          ? 'bg-red-50/80 border-red-100'
                          : bio.status === 'emerald'
                          ? 'bg-emerald-50 border-emerald-100'
                          : 'bg-neutral-50 border-neutral-100'
                      }`}
                    >
                      <span className="text-neutral-600 block text-[10px]">{bio.label}</span>
                      <span className={`text-xs font-bold ${
                        bio.status === 'amber' ? 'text-amber-600' :
                        bio.status === 'red' ? 'text-red-600' :
                        bio.status === 'emerald' ? 'text-emerald-700' : 'text-neutral-800'
                      }`}>
                        {bio.value} {bio.sub && <span className="text-[9px] font-normal text-neutral-500">{bio.sub}</span>}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex space-x-2 pt-2 border-t border-neutral-100">
                  <button 
                    onClick={openPdfModal}
                    className="flex-1 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-[10px] font-bold flex items-center justify-center space-x-1 active:scale-95 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">visibility</span>
                    <span>Open PDF Certificate</span>
                  </button>
                  <button 
                    onClick={handleShare}
                    className="px-3 py-1.5 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 rounded-xl text-[10px] font-semibold flex items-center justify-center space-x-1 active:scale-95 transition cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[13px]">share</span>
                    <span>Share</span>
                  </button>
                </div>
              </div>
            );
          }

          return (
            <div key={report.id} className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100 flex items-center justify-between">
              <div className="flex items-center space-x-2.5">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                  report.id === 'echo-cardio' ? 'bg-red-50 text-red-500' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  <span className="material-symbols-outlined text-[18px]">
                    {report.icon || 'description'}
                  </span>
                </div>
                <div>
                  <h4 className="text-xs font-bold text-neutral-900">{report.title}</h4>
                  <p className="text-[10px] text-neutral-400">{report.source}</p>
                </div>
              </div>
              <button 
                onClick={openPdfModal} 
                className="text-neutral-400 hover:text-neutral-700 p-1 cursor-pointer"
              >
                <span className="material-symbols-outlined text-[18px]">download</span>
              </button>
            </div>
          );
        })}

        {filteredReports.length === 0 && (
          <div className="bg-white rounded-2xl p-6 text-center text-neutral-400 text-xs">
            No clinical records matching "{searchQuery}".
          </div>
        )}
      </div>

      {/* Upload New Lab Document Strip */}
      <div className="bg-limeSoft/60 border border-limeBright/40 rounded-2xl p-3 flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-[20px] text-emerald-800">cloud_upload</span>
          <div>
            <h4 className="text-xs font-bold text-neutral-900">Upload External EHR / Lab PDF</h4>
            <p className="text-[10px] text-neutral-600">On-device OCR extracts diagnoses and biomarkers automatically.</p>
          </div>
        </div>
        <button
          onClick={openOcrModal}
          className="px-2.5 py-1 bg-white hover:bg-neutral-50 text-emerald-900 font-bold text-[10px] rounded-lg shadow-sm active:scale-95 transition cursor-pointer"
        >
          Upload
        </button>
      </div>
    </div>
  );
}

