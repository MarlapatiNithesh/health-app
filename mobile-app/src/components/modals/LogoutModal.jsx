import React from 'react';
import { useAuth } from '../../context/AuthContext';

export function LogoutModal({ isOpen, onClose }) {
  const { logout } = useAuth();

  if (!isOpen) return null;

  const handleConfirmLogout = () => {
    logout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/65 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in select-none">
      <div className="bg-white w-full max-w-[320px] rounded-3xl p-5 shadow-2xl border border-slate-100 flex flex-col items-center text-center">
        <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-3">
          <span className="material-symbols-outlined text-[26px]">logout</span>
        </div>
        <h3 className="text-base font-bold text-neutral-900 mb-1">Sign Out of FITsure?</h3>
        <p className="text-[11px] text-neutral-500 leading-relaxed mb-4">
          Your active biometric passkeys and encrypted telemetry streams will be locked for HIPAA security compliance.
        </p>

        <div className="flex space-x-2 w-full">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-bold text-xs active:scale-95 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirmLogout}
            className="flex-1 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold text-xs active:scale-95 transition cursor-pointer shadow-md"
          >
            Confirm Logout
          </button>
        </div>
      </div>
    </div>
  );
}

