import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export function CareScreen({ openAddMedModal }) {
  const [amlodipineTaken, setAmlodipineTaken] = useState(false);
  const [amlodipineSnoozed, setAmlodipineSnoozed] = useState(false);
  const [refillStatus, setRefillStatus] = useState('Refill');
  const [toastMessage, setToastMessage] = useState('');
  const [schedules, setSchedules] = useState([]);

  useEffect(() => {
    api.getMedicationSchedules()
      .then((res) => {
        if (res?.data && Array.isArray(res.data)) {
          setSchedules(res.data);
        }
      })
      .catch((err) => {
        console.warn('Could not load medication schedules from backend:', err.message);
      });
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleRefill = () => {
    setRefillStatus('Queued ✓');
    showToast('Auto-refill queued with CVS Pharmacy #0482. Delivery estimated in 48h.');
  };

  return (
    <div className="p-4 space-y-3.5 pb-28 select-none text-charcoal bg-appBg min-h-full">
      {toastMessage && (
        <div className="fixed top-14 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-lg border border-neutral-700 animate-fade-in flex items-center space-x-1.5">
          <span className="material-symbols-outlined text-[16px] text-[#97E432]">check_circle</span>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-base font-bold text-neutral-900">Care Plan & Chrono-Rx</h2>
          <p className="text-[10px] text-neutral-500">Automated Reminders & Refill Escalation</p>
        </div>
        <button 
          onClick={openAddMedModal}
          className="px-2.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center space-x-1 active:scale-95 transition cursor-pointer"
        >
          <span className="material-symbols-outlined text-[14px]">add</span>
          <span>Add Med</span>
        </button>
      </div>

      {/* Urgent Refill Warning Card */}
      <div className="bg-amber-50/80 border border-amber-200/80 rounded-2xl p-3 shadow-soft flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="material-symbols-outlined text-amber-600 text-[20px]">autorenew</span>
          <div>
            <h4 className="text-xs font-bold text-neutral-900">Atorvastatin 20 mg Refill</h4>
            <p className="text-[10px] text-amber-800">6 days remaining · Pharmacy auto-sync active</p>
          </div>
        </div>
        <button 
          onClick={handleRefill}
          className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white font-bold text-[10px] active:scale-95 transition cursor-pointer shadow-sm"
        >
          {refillStatus}
        </button>
      </div>

      {/* Chrono Timeline */}
      <div className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100 space-y-3">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider">Today's Schedule</h3>
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
            {amlodipineTaken ? '2 of 4 taken' : '1 of 4 taken'}
          </span>
        </div>
        
        {/* Dose 1: 08:00 Metformin Taken */}
        <div className="flex items-start space-x-3">
          <div className="flex flex-col items-center">
            <span className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px] font-bold">
              ✓
            </span>
            <div className="w-0.5 h-8 bg-neutral-200"></div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-900">08:00 · Metformin 500 mg</span>
              <span className="text-[9px] text-emerald-700 font-semibold bg-emerald-50 px-1.5 py-0.5 rounded">
                Taken 08:15
              </span>
            </div>
            <p className="text-[10px] text-neutral-500">With light breakfast</p>
          </div>
        </div>

        {/* Dose 2: 09:00 Amlodipine Due Now */}
        <div className="flex items-start space-x-3">
          <div className="flex flex-col items-center">
            <span className={`w-5 h-5 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${
              amlodipineTaken ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'
            }`}>
              {amlodipineTaken ? '✓' : '!'}
            </span>
            <div className="w-0.5 h-8 bg-neutral-200"></div>
          </div>
          <div className={`flex-1 p-2 rounded-xl border ${
            amlodipineTaken 
              ? 'bg-emerald-50/60 border-emerald-200/60' 
              : 'bg-amber-50/60 border-amber-200/60'
          }`}>
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-900">09:00 · Amlodipine 5 mg</span>
              <span className={`text-[9px] font-bold uppercase ${
                amlodipineTaken ? 'text-emerald-700' : 'text-amber-700'
              }`}>
                {amlodipineTaken ? 'Taken 09:40' : 'Due Now'}
              </span>
            </div>
            <p className="text-[10px] text-neutral-600 mb-1.5">For systolic BP stabilization</p>
            <div className="flex space-x-1.5">
              <button 
                onClick={() => {
                  setAmlodipineTaken(true);
                  showToast('Amlodipine logged as taken at current time.');
                }}
                className={`px-2.5 py-1 text-neutral-950 font-bold text-[10px] rounded-lg shadow-sm active:scale-95 transition cursor-pointer ${
                  amlodipineTaken 
                    ? 'bg-emerald-600 text-white' 
                    : 'bg-[#97E432] hover:bg-limeAccent'
                }`}
              >
                {amlodipineTaken ? '✓ Taken' : 'Mark Taken'}
              </button>
              <button 
                onClick={() => {
                  setAmlodipineSnoozed(true);
                  showToast('Snoozed for 15 minutes.');
                }}
                className="px-2.5 py-1 bg-white border border-neutral-200 text-neutral-700 font-medium text-[10px] rounded-lg active:scale-95 transition cursor-pointer"
              >
                {amlodipineSnoozed ? 'Snoozed 15m' : 'Snooze'}
              </button>
            </div>
          </div>
        </div>

        {/* Dose 3: 20:00 Metformin Dinner */}
        <div className="flex items-start space-x-3">
          <div className="flex flex-col items-center">
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-[10px]">
              ○
            </span>
            <div className="w-0.5 h-8 bg-neutral-200"></div>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-700">20:00 · Metformin 500 mg</span>
              <span className="text-[9px] text-neutral-400 font-medium">Upcoming</span>
            </div>
            <p className="text-[10px] text-neutral-400">With dinner</p>
          </div>
        </div>

        {/* Dose 4: 22:00 Atorvastatin Bedtime */}
        <div className="flex items-start space-x-3">
          <div className="flex flex-col items-center">
            <span className="w-5 h-5 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-[10px]">
              ○
            </span>
          </div>
          <div className="flex-1">
            <div className="flex justify-between items-center">
              <span className="text-xs font-bold text-neutral-700">22:00 · Atorvastatin 20 mg</span>
              <span className="text-[9px] text-neutral-400 font-medium">Bedtime</span>
            </div>
            <p className="text-[10px] text-neutral-400">Lipid management</p>
          </div>
        </div>
      </div>

      {/* Missed Dose Escalation Protocol Card */}
      <div className="bg-neutral-50 border border-neutral-200 rounded-2xl p-3">
        <div className="flex items-center space-x-2 mb-1">
          <span className="material-symbols-outlined text-neutral-700 text-[18px]">shield_with_heart</span>
          <h4 className="text-xs font-bold text-neutral-900">Missed Dose Escalation Protocol</h4>
        </div>
        <p className="text-[10px] text-neutral-600 leading-snug">
          If 30m overdue: Automated push alert sent. If 60m overdue: Caregiver beacon sends SMS to Sarah (Primary Contact +1 555 234-8910).
        </p>
      </div>

      {/* Pill OCR Verification Promotion */}
      <div className="bg-white rounded-2xl p-3.5 shadow-soft border border-neutral-100 flex items-center justify-between">
        <div className="flex items-center space-x-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#ecfccb] border border-[#d9f99d] flex items-center justify-center text-[#365314]">
            <span className="material-symbols-outlined text-[20px]">verified</span>
          </div>
          <div>
            <h4 className="text-xs font-bold text-neutral-900">Verify Blister & Pill Imprint</h4>
            <p className="text-[10px] text-neutral-500">Camera OCR checks pill geometry against FDA NDC register</p>
          </div>
        </div>
        <button
          onClick={openAddMedModal}
          className="px-2.5 py-1 rounded-xl bg-neutral-900 text-white font-bold text-[10px] active:scale-95 transition cursor-pointer"
        >
          Verify
        </button>
      </div>
    </div>
  );
}

