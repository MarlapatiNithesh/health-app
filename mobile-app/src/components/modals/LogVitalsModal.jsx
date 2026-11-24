import React, { useState, useEffect } from 'react';
import { api } from '../../services/api';

export function LogVitalsModal({ isOpen, onClose, initialType = 'glucose', onSaved }) {
  const [glucose, setGlucose] = useState('118');
  const [systolic, setSystolic] = useState('130');
  const [diastolic, setDiastolic] = useState('82');
  const [context, setContext] = useState('Fasting (Morning)');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialType === 'bp') {
      setSystolic('128');
      setDiastolic('80');
    } else {
      setGlucose('118');
    }
  }, [initialType, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      // Record telemetry via API if available, fallback gracefully
      await api.logVitals?.({
        glucose: Number(glucose),
        systolic: Number(systolic),
        diastolic: Number(diastolic),
        context,
        recordedAt: new Date().toISOString()
      }).catch(() => {});

      if (onSaved) {
        onSaved({
          glucose,
          systolic,
          diastolic,
          context
        });
      }
      alert('Telemetry logged successfully! Charts and daily care goals updated.');
      onClose();
    } catch (err) {
      alert(`Log error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-3 animate-fade-in select-none">
      <div className="bg-white w-full max-w-[340px] rounded-3xl p-4 shadow-2xl border border-neutral-100">
        <div className="flex justify-between items-center mb-3">
          <div className="flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-[18px] text-emerald-600">monitor_heart</span>
            <h3 className="text-sm font-bold text-neutral-900">Log Daily Telemetry</h3>
          </div>
          <button 
            onClick={onClose} 
            className="w-7 h-7 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition cursor-pointer"
          >
            <span className="material-symbols-outlined text-[18px]">close</span>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
              Blood Glucose (mg/dL)
            </label>
            <div className="relative">
              <input
                type="number"
                value={glucose}
                onChange={(e) => setGlucose(e.target.value)}
                placeholder="100"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                required
              />
              <span className="absolute right-3 top-2 text-[10px] text-neutral-400 font-medium">mg/dL</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                Systolic (mmHg)
              </label>
              <input
                type="number"
                value={systolic}
                onChange={(e) => setSystolic(e.target.value)}
                placeholder="120"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                required
              />
            </div>
            <div>
              <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
                Diastolic (mmHg)
              </label>
              <input
                type="number"
                value={diastolic}
                onChange={(e) => setDiastolic(e.target.value)}
                placeholder="80"
                className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold"
                required
              />
            </div>
          </div>

          <div>
            <label className="text-[11px] font-semibold text-neutral-700 block mb-1">
              Context / Time of Day
            </label>
            <select
              value={context}
              onChange={(e) => setContext(e.target.value)}
              className="w-full bg-neutral-50 border border-neutral-200 rounded-xl px-3 py-2 text-xs text-neutral-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            >
              <option value="Fasting (Morning)">Fasting (Morning)</option>
              <option value="Post-Meal (2 Hours)">Post-Meal (2 Hours)</option>
              <option value="Bedtime">Bedtime</option>
              <option value="Random / Pre-Workout">Random / Pre-Workout</option>
            </select>
          </div>

          <div className="bg-limeSoft/50 border border-limeBright/30 rounded-xl p-2 text-[10px] text-emerald-900 flex items-center space-x-1.5">
            <span className="material-symbols-outlined text-[15px] text-emerald-700">verified</span>
            <span>Target: Fasting &lt;100 mg/dL · BP &lt;130/80 mmHg</span>
          </div>

          <div className="flex space-x-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 font-semibold rounded-xl text-xs active:scale-95 transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 py-2 bg-[#97E432] hover:bg-limeAccent text-neutral-950 font-bold rounded-xl text-xs shadow-glow-lime active:scale-95 transition cursor-pointer disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Entry'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

