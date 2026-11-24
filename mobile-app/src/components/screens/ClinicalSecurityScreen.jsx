import React, { useState } from 'react';

export default function ClinicalSecurityScreen({ onOpenScreen, onOpenLogout }) {
  const [biometricLogin, setBiometricLogin] = useState(true);
  const [dataEncryption, setDataEncryption] = useState(true);
  const [emergencyBypass, setEmergencyBypass] = useState(true);
  const [autoRevokeKeys, setAutoRevokeKeys] = useState(false);
  const [toastText, setToastText] = useState('');

  const showToast = (msg) => {
    setToastText(msg);
    setTimeout(() => setToastText(''), 2500);
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col justify-between font-sans select-none overflow-x-hidden">
      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 pt-3 px-4 pb-3 shrink-0">
        <div className="flex items-center justify-between h-12">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onOpenScreen?.('more')}
              aria-label="Back"
              className="w-10 h-10 rounded-full bg-white shadow-xs border border-slate-200/80 flex items-center justify-center text-slate-800"
            >
              <span className="material-symbols-outlined text-[20px]">arrow_back</span>
            </button>
            <div>
              <h1 className="text-[17px] font-bold tracking-tight text-slate-900 leading-tight">Settings & Security</h1>
              <p className="text-[10px] font-medium text-slate-500">System Preferences & Clinical Triage</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onOpenLogout || (() => onOpenScreen?.('logout'))}
            className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center border border-rose-100"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-3 pb-28 space-y-4 overflow-y-auto">
        {/* Sensor Grid Online Pill Bar */}
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#97E432] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#97E432]"></span>
            </span>
            <span className="text-[11px] font-bold uppercase tracking-wider text-[#1a2e05]">Sensor Grid Online</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#ecfccb] border border-[#bef264] text-[#1a2e05] text-[11px] font-bold">
            <span className="material-symbols-outlined text-[13px] text-[#3f6212]" style={{ fontVariationSettings: "'FILL' 1" }}>
              cloud_sync
            </span>
            <span>99.98% Sync</span>
          </div>
        </div>

        {/* User Account Summary Card */}
        <div className="relative bg-white/95 backdrop-blur-md rounded-[28px] p-4 border border-slate-200 shadow-xs">
          <div className="flex items-center gap-3.5">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-lime-400 to-emerald-500 text-slate-950 font-black text-xl flex items-center justify-center ring-2 ring-[#97E432] shrink-0">
              SR
            </div>
            <div className="flex flex-col min-w-0 flex-1">
              <div className="flex items-center justify-between gap-1">
                <h2 className="text-[17px] font-bold text-slate-900 truncate">Sajibur Rahman</h2>
                <span className="px-2 py-0.5 rounded-full bg-[#ecfccb] text-[#1a2e05] font-bold text-[10px] border border-[#bef264]">
                  Pro Clinical
                </span>
              </div>
              <p className="text-[12px] text-slate-500 font-medium truncate mt-0.5">sajibur.rahman@example.com</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                  ID: FIT-8849-SOC2
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clinical Security Section */}
        <section className="space-y-2.5">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 px-1">
            Biometric & Cryptographic Security
          </h3>

          {/* Toggle 1: Face ID */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-lime-50 text-lime-800 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">fingerprint</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Biometric Unlock (FaceID / TouchID)</h4>
                <p className="text-[11px] text-slate-500">Require biometrics before displaying medical records</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBiometricLogin(!biometricLogin)}
              className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                biometricLogin ? 'bg-[#97E432]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                biometricLogin ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>

          {/* Toggle 2: End-to-End Encryption */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#ecfccb] text-[#365314] flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">key</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">256-Bit Hardware Encryption Vault</h4>
                <p className="text-[11px] text-slate-500">Zero-knowledge local private key enclave</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDataEncryption(!dataEncryption)}
              className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                dataEncryption ? 'bg-[#97E432]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                dataEncryption ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>

          {/* Toggle 3: Emergency Responder Fast Bypass */}
          <div className="bg-white rounded-2xl p-3.5 border border-slate-200 shadow-xs flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-700 flex items-center justify-center font-bold">
                <span className="material-symbols-outlined text-[20px]">medical_services</span>
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900">Paramedic Emergency Fast-Pass</h4>
                <p className="text-[11px] text-slate-500">Allow emergency EMTs to scan lock screen QR</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setEmergencyBypass(!emergencyBypass)}
              className={`w-11 h-6 rounded-full p-0.5 flex items-center transition-colors ${
                emergencyBypass ? 'bg-[#97E432]' : 'bg-slate-300'
              }`}
            >
              <div className={`w-5 h-5 rounded-full bg-white shadow-xs transform transition-transform ${
                emergencyBypass ? 'translate-x-5' : 'translate-x-0'
              }`}></div>
            </button>
          </div>
        </section>

        {/* HIPAA & Compliance Seal */}
        <div className="p-4 rounded-3xl bg-white border border-slate-200 shadow-xs space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-900 uppercase">HIPAA & GDPR Certifications</span>
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full">
              Audited 2026
            </span>
          </div>
          <p className="text-xs text-slate-600 leading-relaxed">
            All stored telemetry conforms to 45 CFR Part 160 and Part 164. Dedicated BAA in place with Hospital Health Systems.
          </p>
        </div>

        {/* Security Reset & Key Rotation Buttons */}
        <div className="space-y-2 pt-2">
          <button
            type="button"
            onClick={() => showToast('Cryptographic sensor keys rotated successfully!')}
            className="w-full py-3 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold transition-colors cursor-pointer"
          >
            Rotate Cryptographic Session Keys
          </button>
          <button
            type="button"
            onClick={onOpenLogout || (() => onOpenScreen?.('logout'))}
            className="w-full py-3.5 rounded-full bg-rose-500 hover:bg-rose-600 text-white text-xs font-extrabold shadow-md transition-colors cursor-pointer"
          >
            Sign Out of Device & Clear Local Enclave
          </button>
        </div>
      </main>

      {/* Toast */}
      {toastText && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-slate-900 text-white text-xs font-bold shadow-xl flex items-center gap-2 z-50">
          <span className="material-symbols-outlined text-lime-400 text-[18px]">verified_user</span>
          <span>{toastText}</span>
        </div>
      )}
    </div>
  );
}

