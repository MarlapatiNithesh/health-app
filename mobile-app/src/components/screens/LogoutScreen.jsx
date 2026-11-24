import React from 'react';
import { useAuth } from '../../context/AuthContext';

export default function LogoutScreen({ onBack, onOpenScreen }) {
  const { logout } = useAuth();

  const handleConfirmLogout = () => {
    logout();
    if (onOpenScreen) onOpenScreen('auth');
    else if (onBack) onBack();
  };

  const handleCancel = () => {
    if (onBack) onBack();
    else if (onOpenScreen) onOpenScreen('more');
  };

  return (
    <div className="relative w-full max-w-[430px] mx-auto min-h-screen bg-slate-900/60 flex flex-col justify-end font-sans select-none overflow-x-hidden p-4">
      <div className="bg-white rounded-[32px] p-5 shadow-2xl space-y-4 border border-slate-100">
        <div className="flex items-center justify-between">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <span className="material-symbols-outlined text-[26px]">lock_reset</span>
          </div>
          <button
            type="button"
            onClick={handleCancel}
            className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-600"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <div>
          <h2 className="text-lg font-black text-slate-900 leading-tight">
            Confirm Clinical Session Logout?
          </h2>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Logging out pauses continuous real-time background telemetry streaming to your designated CloseOne emergency guardians.
          </p>
        </div>

        <div className="p-3 bg-amber-50 rounded-2xl border border-amber-200 text-xs text-amber-900 space-y-1">
          <div className="flex items-center gap-1.5 font-bold">
            <span className="material-symbols-outlined text-[16px] text-amber-700">warning</span>
            <span>Security Precaution:</span>
          </div>
          <p className="text-[11px] text-amber-800 leading-snug">
            Local HIPAA cache will be purged. Your biometric passkey and Dexcom pairing remain encrypted in hardware enclave.
          </p>
        </div>

        <div className="space-y-2 pt-1">
          <button
            type="button"
            onClick={handleConfirmLogout}
            className="w-full py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-extrabold text-sm rounded-full shadow-md flex items-center justify-center gap-2 cursor-pointer transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">logout</span>
            <span>Sign Out & Disconnect</span>
          </button>
          <button
            type="button"
            onClick={handleCancel}
            className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-full cursor-pointer transition-colors"
          >
            Keep Clinical Session Active
          </button>
        </div>
      </div>
    </div>
  );
}

