import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

export function MoreScreen({ openPdfModal, openLogoutModal }) {
  const { member } = useAuth();
  const [pingSent, setPingSent] = useState(false);
  const [toastMsg, setToastMsg] = useState('');

  const showToast = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleTestPing = () => {
    setPingSent(true);
    showToast('Test beacon sent to Sarah (+1 555 234-8910). Response confirmed in 4s.');
    setTimeout(() => setPingSent(false), 5000);
  };

  const handleLockscreenMedicalId = () => {
    alert('Medical ID locked and synchronized with Mobile Emergency Lockscreen. Responders can view your diabetes status and allergy without passkey.');
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
          <h2 className="text-base font-bold text-neutral-900">Settings & Care Safety</h2>
          <p className="text-[10px] text-neutral-500">Profile, Connected Hardware & FHIR Export</p>
        </div>
        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[9px] font-bold border border-emerald-200">
          EHR Synced
        </span>
      </div>

      {/* Patient Profile Card */}
      <div className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100 flex items-center space-x-3">
        <img
          alt="Patient Profile"
          className="w-12 h-12 rounded-full object-cover ring-2 ring-emerald-500/30"
          src="https://images.unsplash.com/photo-1544005313-94ddf0286df2?auto=format&fit=crop&w=120&q=80"
        />
        <div className="flex-1">
          <h3 className="text-xs font-bold text-neutral-900">
            {member?.fullName || member?.firstName ? `${member.firstName || member.fullName}, 54` : 'Anna Martinez, 54'}
          </h3>
          <p className="text-[10px] text-neutral-500">MRN #FIT-84920 · Type 2 Diabetes & HTN</p>
          <span className="text-[9px] font-medium text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded mt-1 inline-block">
            Primary Physician: Dr. K. Weber
          </span>
        </div>
      </div>

      {/* Connected Medical Hardware */}
      <div className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100 space-y-2">
        <h4 className="text-xs font-bold text-neutral-900">Connected Medical Hardware</h4>
        
        <div className="flex items-center justify-between text-[11px] py-1 border-b border-neutral-50">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[16px] text-neutral-700">watch</span>
            <span className="text-neutral-800 font-medium">Apple Watch Ultra 2</span>
          </div>
          <span className="text-[9px] text-emerald-700 font-bold">Live BLE · 1m</span>
        </div>

        <div className="flex items-center justify-between text-[11px] py-1 border-b border-neutral-50">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[16px] text-neutral-700">bloodtype</span>
            <span className="text-neutral-800 font-medium">Accu-Chek Guide Me</span>
          </div>
          <span className="text-[9px] text-emerald-700 font-bold">Synced Today</span>
        </div>

        <div className="flex items-center justify-between text-[11px] py-1">
          <div className="flex items-center space-x-2">
            <span className="material-symbols-outlined text-[16px] text-neutral-700">monitor_heart</span>
            <span className="text-neutral-800 font-medium">Omron Evolv BP Monitor</span>
          </div>
          <span className="text-[9px] text-neutral-400">Synced 36h ago</span>
        </div>
      </div>

      {/* Guardian & Emergency Beacon Contact */}
      <div className="bg-white rounded-2xl p-3 shadow-soft border border-neutral-100">
        <h4 className="text-xs font-bold text-neutral-900 mb-1">Designated Caregiver / Guardian</h4>
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs font-bold text-neutral-800 block">Sarah Martinez (Daughter)</span>
            <span className="text-[10px] text-neutral-500">+1 (555) 234-8910 · Beacon Alert Active</span>
          </div>
          <button
            onClick={handleTestPing}
            className={`px-2 py-1 font-semibold text-[10px] rounded-lg active:scale-95 transition cursor-pointer ${
              pingSent
                ? 'bg-emerald-600 text-white'
                : 'bg-neutral-100 hover:bg-neutral-200 text-neutral-700'
            }`}
          >
            {pingSent ? 'Pinged ✓' : 'Test Ping'}
          </button>
        </div>
      </div>

      {/* Export & Compliance Actions */}
      <div className="space-y-1.5 pt-1">
        <button
          onClick={openPdfModal}
          className="w-full py-2 bg-neutral-900 hover:bg-neutral-800 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-sm active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">file_download</span>
          <span>Export Clinical FHIR / HL7 PDF</span>
        </button>

        <button
          onClick={handleLockscreenMedicalId}
          className="w-full py-2 bg-white border border-neutral-200 text-neutral-700 rounded-xl text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-neutral-50 active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">medical_information</span>
          <span>Configure Lockscreen Medical ID</span>
        </button>

        <button
          onClick={openLogoutModal}
          className="w-full py-2 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 hover:bg-rose-100 active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[16px]">logout</span>
          <span>Sign Out / Lock Session</span>
        </button>
      </div>
    </div>
  );
}

