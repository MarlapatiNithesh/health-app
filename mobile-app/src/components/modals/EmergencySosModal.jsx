import React, { useState, useEffect } from 'react';

export function EmergencySosModal({ isOpen, onClose }) {
  const [countdown, setCountdown] = useState(10);
  const [isSirenOn, setIsSirenOn] = useState(true);
  const [dispatched, setDispatched] = useState(false);
  const [alertSent, setAlertSent] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCountdown(10);
      setDispatched(false);
      setAlertSent(false);
      return;
    }
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          setDispatched(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleCall911 = () => {
    window.location.href = 'tel:911';
  };

  const handleAlertSarah = () => {
    setAlertSent(true);
    setTimeout(() => {
      alert('Caregiver SOS Beacon sent via SMS & Automated Phone Alert to Sarah Martinez (+1 555 234-8910). GPS coordinates attached.');
    }, 200);
  };

  const handleHypoProtocol = () => {
    alert('Hypoglycemia Emergency Protocol: Drink 15g fast-acting carbs (4 oz juice or 3 glucose tabs). Recheck glucose in 15 minutes.');
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-md flex items-center justify-center p-3 animate-fade-in select-none">
      <div className="bg-white w-full max-w-[360px] rounded-3xl p-4 shadow-2xl border border-red-200 relative overflow-hidden flex flex-col max-h-[92vh]">
        {/* Top Emergency Status Header */}
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-500 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-600"></span>
            </span>
            <div className="flex flex-col">
              <span className="text-[9px] font-extrabold text-red-600 uppercase tracking-wider">CODE RED · PRIORITY 1</span>
              <h3 className="text-sm font-extrabold text-neutral-900 leading-tight">Medical Emergency Beacon</h3>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        {/* Circular Countdown Gauge */}
        <div className="bg-red-50 border border-red-200 rounded-2xl p-3.5 mb-3 flex flex-col items-center text-center relative overflow-hidden">
          <div className="relative w-28 h-28 flex items-center justify-center my-1">
            <div className="absolute inset-0 rounded-full bg-red-500/10 animate-pulse"></div>
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="42" fill="transparent" stroke="#FFD7CF" strokeWidth="6" />
              <circle
                cx="50"
                cy="50"
                r="42"
                fill="transparent"
                stroke="#D94833"
                strokeWidth="6"
                strokeDasharray={263.89}
                strokeDashoffset={dispatched ? 0 : 263.89 * (1 - countdown / 10)}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-linear"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-[9px] font-bold text-red-600 uppercase">
                {dispatched ? 'DISPATCHED' : 'AUTO DISPATCH'}
              </span>
              <span className="text-2xl font-black text-neutral-900 leading-none my-0.5">
                {dispatched ? 'EMS' : `${countdown}s`}
              </span>
              <span className="text-[9px] text-neutral-500 font-medium">
                {dispatched ? 'Units En Route' : 'Cancels on Tap'}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between w-full mt-2 pt-2 border-t border-red-200/60 text-[10px]">
            <button 
              onClick={() => setIsSirenOn(!isSirenOn)}
              className="flex items-center space-x-1 font-bold text-red-700 bg-red-100/80 px-2 py-0.5 rounded-full"
            >
              <span className="material-symbols-outlined text-[14px]">
                {isSirenOn ? 'volume_up' : 'volume_off'}
              </span>
              <span>{isSirenOn ? 'High-Decibel Siren ON' : 'Siren Muted'}</span>
            </button>
            <span className="text-red-700 font-semibold">GPS Synced</span>
          </div>
        </div>

        {/* Patient Clinical Summary Banner */}
        <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-2.5 mb-3 text-[11px] leading-snug text-neutral-800">
          <div className="flex justify-between items-center mb-1">
            <strong className="text-neutral-900 font-bold">Anna Martinez (54F) · MRN #FIT-84920</strong>
            <span className="text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Telemetry Active</span>
          </div>
          <div className="text-[10px] text-neutral-600 space-y-0.5">
            <div><strong>Conditions:</strong> Type 2 Diabetes · Essential Hypertension</div>
            <div><strong>Critical:</strong> Glucose 52 mg/dL (Dropping) · Systolic 162 mmHg</div>
            <div><strong>Allergies:</strong> Penicillin (Severe Anaphylaxis)</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 mb-2">
          <button 
            onClick={handleCall911}
            className="w-full py-2.5 bg-red-600 hover:bg-red-700 active:scale-95 text-white font-black text-xs rounded-xl flex items-center justify-center space-x-1.5 shadow-md transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px]">call</span>
            <span>Call 112 / 911 Emergency Dispatch</span>
          </button>

          <button 
            onClick={handleAlertSarah}
            className={`w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 transition active:scale-95 cursor-pointer ${
              alertSent 
                ? 'bg-emerald-600 text-white' 
                : 'bg-neutral-900 hover:bg-neutral-800 text-white'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">
              {alertSent ? 'check_circle' : 'notifications_active'}
            </span>
            <span>{alertSent ? 'Sarah Alerted · Live GPS Broadcasted' : 'Alert Caregiver Sarah (Daughter)'}</span>
          </button>

          <button 
            onClick={handleHypoProtocol}
            className="w-full py-2 bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold rounded-xl text-xs flex items-center justify-center space-x-1.5 active:scale-95 transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[16px] text-amber-700">water_drop</span>
            <span>Hypoglycemia Emergency Protocol (15g Carbs)</span>
          </button>
        </div>

        <button 
          onClick={onClose} 
          className="w-full py-1.5 text-center text-xs text-neutral-400 hover:text-neutral-700 font-semibold cursor-pointer"
        >
          Dismiss & Resume Monitoring
        </button>
      </div>
    </div>
  );
}

