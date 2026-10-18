import React, { useEffect, useState } from 'react';
import { 
  Footprints, 
  Heart, 
  Moon, 
  Flame, 
  TrendingUp, 
  Weight, 
  ShieldCheck, 
  Check, 
  Smartphone, 
  Sparkles, 
  X,
  AlertCircle,
  RefreshCw,
  Lock
} from 'lucide-react';
import { api } from '../../services/api';
import { toNative } from '../../native/nativeBridge';
import { getHealthConsentStorageKeys } from '../../utils/healthConsent';

const AVAILABLE_PERMISSIONS = [
  {
    id: 'steps',
    name: 'Steps & Daily Activity',
    desc: 'Read step records from Apple Health / Health Connect; use the phone pedometer only when those records are empty',
    icon: Footprints,
    color: 'from-orange-500 to-amber-500',
    unit: 'steps/day',
    defaultChecked: true,
  },
  {
    id: 'heart_rate',
    name: 'Heart Rate & Pulse',
    desc: 'Capture resting heart rate and activity heart rate',
    icon: Heart,
    color: 'from-rose-500 to-red-500',
    unit: 'bpm',
    defaultChecked: false,
  },
  {
    id: 'spo2',
    name: 'Blood oxygen',
    desc: 'Oxygen readings shared by a supported watch or health app',
    icon: Heart,
    color: 'from-cyan-500 to-sky-600',
    unit: '%',
    defaultChecked: false,
  },
  {
    id: 'hrv',
    name: 'Heart rate variability',
    desc: 'HRV readings available in your phone health store',
    icon: Heart,
    color: 'from-fuchsia-500 to-violet-600',
    unit: 'ms',
    defaultChecked: false,
  },
  {
    id: 'blood_pressure_systolic',
    name: 'Blood pressure',
    desc: 'Systolic and diastolic readings from a connected health device',
    icon: Heart,
    color: 'from-rose-500 to-red-600',
    unit: 'mmHg',
    defaultChecked: false,
  },
  {
    id: 'blood_glucose',
    name: 'Blood glucose',
    desc: 'Glucose readings recorded by a compatible meter or health app',
    icon: Heart,
    color: 'from-violet-500 to-indigo-600',
    unit: 'mg/dL',
    defaultChecked: false,
  },
  {
    id: 'respiratory_rate',
    name: 'Respiratory rate',
    desc: 'Breathing rate readings available in your phone health store',
    icon: Heart,
    color: 'from-teal-500 to-emerald-600',
    unit: 'breaths/min',
    defaultChecked: false,
  },
  {
    id: 'sleep',
    name: 'Sleep Duration & Analysis',
    desc: 'Track sleep hours, restorative sleep, and sleep quality',
    icon: Moon,
    color: 'from-indigo-500 to-purple-500',
    unit: 'hours/night',
    defaultChecked: false,
  },
  {
    id: 'calories',
    name: 'Active Energy Burn',
    desc: 'Active kcal burned during walking, running, and workouts',
    icon: Flame,
    color: 'from-amber-500 to-orange-600',
    unit: 'kcal',
    defaultChecked: false,
  },
  {
    id: 'distance',
    name: 'Distance Walked / Run',
    desc: 'Kilometers and meters covered throughout the day',
    icon: TrendingUp,
    color: 'from-emerald-500 to-teal-500',
    unit: 'km/m',
    defaultChecked: false,
  },
  {
    id: 'weight',
    name: 'Body Weight & Vitals',
    desc: 'Weight recordings to calibrate BMI and calorie burn',
    icon: Weight,
    color: 'from-sky-500 to-blue-600',
    unit: 'kg',
    defaultChecked: false,
  },
];

export function HealthPermissionsModal({
  isOpen,
  onClose,
  onGranted,
  isSignupFlow = false,
  detectedPlatform,
  memberId = 'unknown-member',
  authToken = '',
}) {
  const platform = detectedPlatform || (typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '') ? 'android' : 'ios');
  const isAndroid = platform === 'android';
  const providerName = isAndroid ? 'Google Health Connect' : 'Apple HealthKit';
  const storageKeys = getHealthConsentStorageKeys(memberId);

  const [selected, setSelected] = useState(() => {
    try {
      const saved = localStorage.getItem(storageKeys.selected);
      if (saved) return JSON.parse(saved);
    } catch {}
    return AVAILABLE_PERMISSIONS.filter((p) => p.defaultChecked).map((p) => p.id);
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successInfo, setSuccessInfo] = useState(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKeys.selected);
      setSelected(saved ? JSON.parse(saved) : AVAILABLE_PERMISSIONS.filter((p) => p.defaultChecked).map((p) => p.id));
    } catch {
      setSelected(AVAILABLE_PERMISSIONS.filter((p) => p.defaultChecked).map((p) => p.id));
    }
  }, [storageKeys.selected]);

  if (!isOpen) return null;

  const togglePermission = (id) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    setSelected(AVAILABLE_PERMISSIONS.map((p) => p.id));
  };

  const clearAll = () => {
    setSelected([]);
  };

  const handleGrantAccess = async () => {
    setIsSubmitting(true);
    setSuccessInfo(null);
    try {
      // 1. Save locally
      localStorage.setItem(storageKeys.selected, JSON.stringify(selected));
      localStorage.setItem(storageKeys.configured, 'true');

      // Persist the member consent before asking the phone for health permissions.
      await api.recordMemberConsent('health_data', selected.length > 0, '1.0').catch(() => {});
      // Request the selected permissions directly from the phone health store,
      // or unlink the phone source when the user clears all selected types.
      if (selected.length > 0) {
        toNative('REQUEST_HEALTH_PERMISSIONS', {
          permissions: selected,
          memberId: String(memberId),
          authToken,
        });
      } else {
        await api.updatePhoneHealthConnection({
          provider: isAndroid ? 'health_connect' : 'apple_health',
          platform: isAndroid ? 'android' : 'ios',
          permissions: [],
          status: 'disconnected',
        }).catch((err) => console.warn('Could not update phone health connection:', err.message));
        toNative('REVOKE_HEALTH_ACCESS', { memberId: String(memberId) });
      }

      setSuccessInfo(selected.length
        ? `Permission request sent to ${providerName}. We will show connected after health data is available.`
        : 'Health data sharing is off. No phone health types are selected.');

      setTimeout(() => {
        setIsSubmitting(false);
        if (typeof onGranted === 'function') {
          onGranted(selected);
        } else if (typeof onClose === 'function') {
          onClose();
        }
      }, 1000);
    } catch (err) {
      console.error('Error granting health permissions:', err);
      setIsSubmitting(false);
      if (typeof onClose === 'function') onClose();
    }
  };

  const handleSkip = () => {
    localStorage.setItem(storageKeys.selected, JSON.stringify([]));
    localStorage.setItem(storageKeys.configured, 'true');
    if (typeof onClose === 'function') onClose();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 text-slate-800 shadow-2xl border border-slate-100 flex flex-col max-h-[92vh] overflow-hidden relative">
        {/* Close Button (if not required signup step) */}
        {!isSignupFlow && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition cursor-pointer z-10"
          >
            <X size={16} />
          </button>
        )}

        {/* Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#00A8D0] via-teal-500 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-teal-500/25 shrink-0">
            <Smartphone size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-slate-900 tracking-tight">
                Phone Health Access
              </h2>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 border border-teal-200">
                {isAndroid ? 'Google Health Connect' : 'Apple HealthKit'}
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Choose which readings already available in your phone health store Fitsure may read. The phone pedometer can count steps while the app is open.
            </p>
          </div>
        </div>

        {/* Selection Bar */}
        <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-100 text-xs">
          <span className="font-bold text-slate-600">
            {selected.length} of {AVAILABLE_PERMISSIONS.length} selected
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={selectAll}
              className="text-[11px] font-bold text-[#00A8D0] hover:underline cursor-pointer"
            >
              Select All
            </button>
            <span className="text-slate-300">•</span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[11px] font-bold text-slate-400 hover:underline cursor-pointer"
            >
              Clear
            </button>
          </div>
        </div>

        <p className="text-[11px] text-slate-500 leading-snug mb-3">
          {isAndroid
            ? 'If Health Connect has no step records, Fitsure can count steps with your phone while the app is open.'
            : 'If Apple Health has no step records, Fitsure can use the phone pedometer while the app is open.'}
          {' '}Phone pedometer updates pause while the app is in the background.
        </p>
        <p className="text-[11px] text-slate-500 leading-snug mb-3">
          These permissions share health readings available on this phone. Steps can also come from the phone pedometer while the app is open.
        </p>

        {/* Scrollable Permissions List */}
        <div className="flex-1 overflow-y-auto no-scrollbar space-y-2.5 pr-0.5 mb-4">
          {AVAILABLE_PERMISSIONS.map((perm) => {
            const Icon = perm.icon;
            const isChecked = selected.includes(perm.id);

            return (
              <div
                key={perm.id}
                onClick={() => togglePermission(perm.id)}
                className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between ${
                  isChecked
                    ? 'bg-teal-50/60 border-teal-300 shadow-sm'
                    : 'bg-slate-50/80 border-slate-200/80 hover:bg-slate-100/60'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white bg-gradient-to-tr ${perm.color} shadow-sm shrink-0`}
                  >
                    <Icon size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">
                      {perm.name}
                    </h4>
                    <p className="text-[11px] text-slate-500 leading-snug mt-0.5">
                      {perm.desc}
                    </p>
                  </div>
                </div>

                {/* Custom Checkbox */}
                <div
                  className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all shrink-0 ml-2 ${
                    isChecked
                      ? 'bg-[#00A8D0] border-[#00A8D0] text-white shadow-sm'
                      : 'border-slate-300 bg-white'
                  }`}
                >
                  {isChecked && <Check size={13} strokeWidth={3} />}
                </div>
              </div>
            );
          })}
        </div>

        {/* Privacy Note */}
        <div className="bg-slate-50 rounded-2xl p-2.5 border border-slate-100 flex items-center gap-2 text-[11px] text-slate-500 mb-4">
          <Lock size={13} className="text-emerald-500 shrink-0" />
          <span>
            Data is strictly private & synced directly to your secure Fitsure Health Locker.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="space-y-2 shrink-0">
          <button
            type="button"
            disabled={isSubmitting}
            onClick={handleGrantAccess}
            className="w-full py-3.5 px-4 bg-gradient-to-r from-[#00A8D0] via-teal-500 to-indigo-600 hover:from-[#0092B5] hover:to-indigo-700 text-white font-extrabold rounded-2xl text-xs uppercase tracking-wider shadow-lg shadow-teal-500/25 transition active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? (
              <>
                <RefreshCw size={14} className="animate-spin" />
                <span>Connecting & Syncing Data…</span>
              </>
            ) : successInfo ? (
              <>
                <Check size={14} strokeWidth={3} />
                <span>{successInfo}</span>
              </>
            ) : (
              <>
                <ShieldCheck size={15} />
                <span>{selected.length ? 'Grant Access & Capture Health Data' : 'Turn Off Health Sharing'}</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleSkip}
            className="w-full py-2.5 text-center text-xs font-bold text-slate-400 hover:text-slate-600 transition cursor-pointer"
          >
            {isSignupFlow ? 'Skip for now (I will configure later)' : 'Maybe Later'}
          </button>
        </div>
      </div>
    </div>
  );
}
