import React, { useState, useEffect } from 'react';
import { 
  User, 
  Phone, 
  Calendar, 
  Scale, 
  Ruler, 
  Shield, 
  History, 
  TrendingDown, 
  TrendingUp, 
  LogOut, 
  Trash2, 
  Edit3, 
  Check, 
  AlertCircle,
  ToggleLeft,
  ToggleRight,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  Plus,
  X,
  Target,
  Heart
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { toNative } from '../../native/nativeBridge';
import { api } from '../../services/api';

export function ProfileScreen({ openVaultModal, openPatient360Modal }) {
  const { member, logout, updateMemberProfile } = useAuth();
  const [weightProgress, setWeightProgress] = useState(null);
  const [historyLogs, setHistoryLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [showConsentModal, setShowConsentModal] = useState(false);
  
  // Scoped Consents
  const [consents, setConsents] = useState({
    global: false,
    data_access: false,
    ai_processing: false,
    document_upload: false,
    health_data: false,
  });

  const [patientProfile, setPatientProfile] = useState(null);
  const [patientMeds, setPatientMeds] = useState([]);
  const [showLifestyleModal, setShowLifestyleModal] = useState(false);
  const [savingLifestyle, setSavingLifestyle] = useState(false);
  const [lifestyleForm, setLifestyleForm] = useState({
    diet: 'Balanced',
    activityLevel: 'Moderately Active',
    smoking: 'Non-smoker',
    alcohol: 'Occasional',
    sleepTarget: '8 Hours',
  });
  const [goalsList, setGoalsList] = useState([]);
  const [newGoalInput, setNewGoalInput] = useState('');

  const getInitialDob = (m) => {
    if (!m?.dob) return '1994-12-31';
    if (typeof m.dob === 'string') return m.dob.split('T')[0];
    try {
      return new Date(m.dob).toISOString().split('T')[0];
    } catch {
      return '1994-12-31';
    }
  };

  const [editForm, setEditForm] = useState({
    firstName: member?.firstName || member?.fullName?.split(' ')[0] || '',
    lastName: member?.lastName || member?.fullName?.split(' ').slice(1).join(' ') || '',
    dob: getInitialDob(member),
    biologicalSex: member?.gender || member?.biologicalSex || 'male',
    heightCm: Number(member?.heightCm) || 170,
    weightKg: Number(member?.weightKg) || 65,
  });

  useEffect(() => {
    if (member) {
      const parts = (member.fullName || '').trim().split(/\s+/).filter(Boolean);
      const fName = member.firstName || parts[0] || '';
      const lName = member.lastName || parts.slice(1).join(' ') || '';
      setEditForm({
        firstName: fName,
        lastName: lName,
        dob: getInitialDob(member),
        biologicalSex: member.gender || member.biologicalSex || 'male',
        heightCm: Number(member.heightCm) || 170,
        weightKg: Number(member.weightKg) || 65,
      });
    }
  }, [member]);

  useEffect(() => {
    const pid = member?.id || 'me';
    if (typeof api?.getPatientChart === 'function') {
      api.getPatientChart(pid)
        .then(res => {
          const p = res?.patient || res;
          setPatientProfile(p);
          if (p?.lifestyle && typeof p.lifestyle === 'object') {
            setLifestyleForm(prev => ({ ...prev, ...p.lifestyle }));
          }
          if (Array.isArray(p?.goals)) {
            setGoalsList(p.goals);
          }
        })
        .catch(() => {});
    }

    if (typeof api?.getMedications === 'function') {
      api.getMedications(pid)
        .then(res => setPatientMeds(Array.isArray(res) ? res : res?.medications || []))
        .catch(() => {});
    }

    // Fetch weight progress & history
    if (typeof api?.getWeightProgress === 'function') {
      api.getWeightProgress()
        .then(res => setWeightProgress(res))
        .catch(() => {});
    }

    if (typeof api?.getProfileHistory === 'function') {
      api.getProfileHistory()
        .then(res => {
          if (Array.isArray(res)) setHistoryLogs(res);
          else if (res?.history) setHistoryLogs(res.history);
        })
        .catch(() => {});
    }

    // Load initial scoped consents
    if (typeof api?.getScopedConsents === 'function') {
      api.getScopedConsents()
        .then(res => {
          const c = res?.consents || res || {};
          setConsents({
            global: Boolean(c.global ?? true),
            data_access: Boolean(c.data_access ?? true),
            ai_processing: Boolean(c.ai_processing ?? true),
            document_upload: Boolean(c.document_upload ?? true),
            health_data: Boolean(c.health_data),
          });
        })
        .catch(() => {});
    }
  }, [member]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fName = editForm.firstName?.trim() || '';
      const lName = editForm.lastName?.trim() || '';
      const fullName = `${fName} ${lName}`.trim() || member?.fullName || 'Member';
      const payload = {
        firstName: fName,
        lastName: lName,
        fullName,
        dob: editForm.dob,
        gender: editForm.biologicalSex || 'male',
        biologicalSex: editForm.biologicalSex || 'male',
        heightCm: parseFloat(editForm.heightCm) || 170,
        weightKg: parseFloat(editForm.weightKg) || 65,
      };

      if (typeof updateMemberProfile === 'function') {
        await updateMemberProfile(payload);
      } else if (typeof api?.updateProfile === 'function') {
        await api.updateProfile(payload);
      }
      setIsEditing(false);
    } catch (err) {
      alert(`Update failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveLifestyleAndGoals = async (e) => {
    e?.preventDefault();
    setSavingLifestyle(true);
    try {
      const pid = member?.id || 'me';
      await api.updatePatientProfile(pid, {
        lifestyle: lifestyleForm,
        goals: goalsList,
      });
      setShowLifestyleModal(false);
      const res = await api.getPatientChart(pid);
      setPatientProfile(res?.patient || res);
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingLifestyle(false);
    }
  };

  const toggleConsent = async (scope) => {
    const nextVal = !consents[scope];
    setConsents(prev => ({ ...prev, [scope]: nextVal }));
    try {
      if (scope === 'health_data') {
        await api.recordMemberConsent('health_data', nextVal, '1.0');
        if (!nextVal) {
          await api.updatePhoneHealthConnection({ provider: 'apple_health', permissions: [], status: 'disconnected' }).catch(() => {});
          await api.updatePhoneHealthConnection({ provider: 'health_connect', platform: 'android', permissions: [], status: 'disconnected' }).catch(() => {});
          toNative('REVOKE_HEALTH_ACCESS');
        }
      } else if (scope === 'global') {
        await api.setGlobalConsent('global', nextVal);
      } else {
        await api.setScopedConsent(scope, nextVal);
      }
    } catch (err) {
      console.warn('Failed to update consent on server:', err.message);
    }
  };

  const handleDeleteAccount = async () => {
    if (!confirm('Are you sure you want to delete your account? All medical vault documents, biometrics, and consent logs will be permanently erased per GDPR/CCPA right-to-be-forgotten.')) {
      return;
    }
    try {
      await api.deleteAccount();
      alert('Your account and clinical records have been permanently erased per GDPR/CCPA.');
    } catch (err) {
      if (!err.message?.toLowerCase().includes('deleted')) {
        alert(`Account deletion notice: ${err.message}`);
      }
    } finally {
      logout();
    }
  };

  const height = Number(member?.heightCm) || 170;
  const weight = Number(member?.weightKg) || 65;
  const bmi = height > 0 ? (weight / ((height / 100) * (height / 100))).toFixed(1) : '22.5';

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in text-slate-100">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight">Member Profile</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Demographics, Biometrics & Security</p>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 glass-subcard bg-cyan-500/10 text-cyan-300 border border-cyan-400/30 rounded-xl text-xs font-bold hover:bg-cyan-500/20 transition cursor-pointer"
        >
          <Edit3 size={13} />
          <span>Edit</span>
        </button>
      </div>

      {/* 2. Profile Hero Card */}
      <div className="glass-card rounded-[28px] p-5 border border-white/[0.08] border-t-white/[0.18] shadow-2xl space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 via-teal-400 to-purple-600 flex items-center justify-center text-slate-950 text-2xl font-black shadow-lg shadow-cyan-500/25 ring-2 ring-white/20 shrink-0">
            {(member?.firstName || member?.fullName || 'J')[0]}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-black text-white truncate">
              {member?.fullName || `${member?.firstName || 'Jane'} ${member?.lastName || 'Doe'}`}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium mt-0.5">
              <Phone size={12} className="text-cyan-400" />
              <span>{member?.phone || member?.phoneE164 || '+14155552671'}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 glass-pill bg-emerald-500/15 text-emerald-300 border border-emerald-400/30 text-[10px] font-extrabold uppercase tracking-wider">
                {member?.status || 'Active Member'}
              </span>
              <span className="px-2.5 py-0.5 glass-pill bg-cyan-500/15 text-cyan-300 border border-cyan-400/30 text-[10px] font-extrabold capitalize">
                Tier: {member?.insuranceTier || 'Corporate Gold'}
              </span>
            </div>
          </div>
        </div>

        {/* Biometrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-white/[0.08] text-center">
          <div className="glass-subcard bg-slate-900/60 p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Height</span>
            <span className="text-base font-black text-white">{height}</span>
            <span className="text-[10px] text-slate-400 font-semibold ml-0.5">cm</span>
          </div>

          <div className="glass-subcard bg-slate-900/60 p-2.5 rounded-2xl border border-white/5">
            <span className="text-[10px] font-bold uppercase text-slate-400 block tracking-wider">Weight</span>
            <span className="text-base font-black text-white">{weight}</span>
            <span className="text-[10px] text-slate-400 font-semibold ml-0.5">kg</span>
          </div>

          <div className="glass-subcard bg-cyan-950/40 p-2.5 rounded-2xl border border-cyan-500/30 shadow-sm shadow-cyan-500/10">
            <span className="text-[10px] font-bold uppercase text-cyan-400 block tracking-wider">BMI</span>
            <span className="text-base font-black text-cyan-300 text-glow-cyan">{bmi}</span>
            <span className="text-[10px] text-cyan-400 font-bold ml-0.5">Normal</span>
          </div>
        </div>
      </div>

      {/* 3. Patient Lifestyle, Health Goals & Medications Card */}
      <div className="glass-card rounded-[28px] p-5 shadow-2xl border border-white/[0.08] border-t-white/[0.18] space-y-3 relative overflow-hidden">
        {/* Subtle accent aurora */}
        <div className="pointer-events-none absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl" />

        <div className="flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-xs font-black tracking-wide text-white">Lifestyle & Health Goals</h3>
              <p className="text-[10px] text-slate-400 font-medium">Integrated into MediBot & Clinical 360 Chart</p>
            </div>
          </div>
          <button
            onClick={() => setShowLifestyleModal(true)}
            className="px-3 py-1.5 glass-pill bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-400/40 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
          >
            <span>Manage</span>
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center relative z-10">
          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Diet & Habits</span>
            <span className="text-[11px] font-black text-emerald-300 mt-0.5 block truncate">
              {patientProfile?.lifestyle?.diet ? `${patientProfile.lifestyle.diet}` : (patientProfile?.lifestyle?.activityLevel || 'Not set')}
            </span>
          </div>
          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Health Targets</span>
            <span className="text-[11px] font-black text-cyan-300 mt-0.5 block truncate">
              {patientProfile?.goals?.length ? `${patientProfile.goals.length} Goal(s)` : 'None set'}
            </span>
          </div>
          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-xl p-2.5">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Active Rx</span>
            <span className="text-[11px] font-black text-purple-300 mt-0.5 block truncate">
              {patientMeds?.length ? `${patientMeds.length} Active Rx` : 'None documented'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Clinical Consents & Privacy Management */}
      <div className="glass-card rounded-[28px] p-5 border border-white/[0.08] border-t-white/[0.18] shadow-2xl space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-cyan-400" />
            <h3 className="text-sm font-black text-white">Clinical AI & Data Consents</h3>
          </div>
          <span className="text-[10px] font-extrabold text-cyan-300 bg-cyan-500/15 border border-cyan-400/30 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
            HIPAA • GDPR
          </span>
        </div>

        <p className="text-xs text-slate-400 font-medium">
          Control granular permissions for MediBot AI triage, OCR processing, and wearable data sync.
        </p>

        <div className="space-y-2.5 pt-1">
          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="pr-3">
              <strong className="text-white block font-bold">MediBot AI Processing</strong>
              <span className="text-[10px] text-slate-400">Allow MediBot to process your messages and relevant records to generate responses</span>
            </div>
            <button onClick={() => toggleConsent('ai_processing')} className="cursor-pointer text-cyan-400 shrink-0">
              {consents.ai_processing ? <ToggleRight size={30} className="text-cyan-400" /> : <ToggleLeft size={30} className="text-slate-600" />}
            </button>
          </div>

          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="pr-3">
              <strong className="text-white block font-bold">Document OCR & Vault</strong>
              <span className="text-[10px] text-slate-400">Upload and extract medications from prescriptions</span>
            </div>
            <button onClick={() => toggleConsent('document_upload')} className="cursor-pointer text-cyan-400 shrink-0">
              {consents.document_upload ? <ToggleRight size={30} className="text-cyan-400" /> : <ToggleLeft size={30} className="text-slate-600" />}
            </button>
          </div>

          <div className="glass-subcard bg-slate-900/60 border border-white/5 rounded-2xl p-3 flex items-center justify-between text-xs">
            <div className="pr-3">
              <strong className="text-white block font-bold">Share Phone Health Data</strong>
              <span className="text-[10px] text-slate-400">Allow continuous telemetry from HealthKit / Health Connect to sync with Dr. MediBot</span>
            </div>
            <button onClick={() => toggleConsent('health_data')} className="cursor-pointer text-cyan-400 shrink-0">
              {consents.health_data ? <ToggleRight size={30} className="text-cyan-400" /> : <ToggleLeft size={30} className="text-slate-600" />}
            </button>
          </div>
        </div>
      </div>

      {/* 5. Account Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={logout}
          className="w-full py-3 glass-subcard bg-slate-900/80 hover:bg-slate-800/80 text-slate-200 border border-white/10 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer shadow-sm"
        >
          <LogOut size={15} />
          <span>Log Out of Session</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="w-full py-2.5 glass-subcard bg-rose-950/20 hover:bg-rose-950/40 text-rose-400 border border-rose-500/20 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Trash2 size={14} />
          <span>Delete Account (GDPR / Right to be Forgotten)</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="glass-card bg-slate-950/95 border border-white/[0.12] rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-black text-white text-base">Edit Demographics & Biometrics</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.dob}
                  onChange={e => setEditForm({ ...editForm, dob: e.target.value })}
                  className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.heightCm}
                    onChange={e => setEditForm({ ...editForm, heightCm: e.target.value })}
                    className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.weightKg}
                    onChange={e => setEditForm({ ...editForm, weightKg: e.target.value })}
                    className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 block mb-1">Biological Sex / Gender</label>
                <select
                  value={editForm.biologicalSex || 'male'}
                  onChange={e => setEditForm({ ...editForm, biologicalSex: e.target.value })}
                  className="w-full px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                >
                  <option value="male" className="bg-slate-900 text-white">Male</option>
                  <option value="female" className="bg-slate-900 text-white">Female</option>
                  <option value="other" className="bg-slate-900 text-white">Other</option>
                  <option value="prefer_not_to_say" className="bg-slate-900 text-white">Prefer not to say</option>
                </select>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 glass-subcard bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-gradient-to-r from-cyan-500 to-teal-400 hover:opacity-95 text-slate-950 rounded-xl text-xs font-black shadow-md shadow-cyan-500/25 cursor-pointer"
                >
                  {loading ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Lifestyle Habits & Health Goals Modal ── */}
      {showLifestyleModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-3 animate-fade-in">
          <div className="glass-card bg-slate-950/95 w-full max-w-md max-h-[90vh] rounded-[28px] shadow-2xl flex flex-col overflow-hidden border border-white/[0.12]">
            {/* Modal Header */}
            <div className="glass-subcard bg-slate-900/80 p-4 text-white flex items-center justify-between border-b border-white/10">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-black tracking-tight text-white">Daily Lifestyle & Target Goals</h3>
                  <p className="text-[10px] text-slate-400">Syncs directly with your Medical Chart & MediBot</p>
                </div>
              </div>
              <button
                onClick={() => setShowLifestyleModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveLifestyleAndGoals} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-xs">
              {/* Diet */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Dietary Preference</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Balanced', 'Vegetarian', 'Vegan', 'Low Carb / Keto', 'Mediterranean'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, diet: d })}
                      className={`py-2 px-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between cursor-pointer ${
                        lifestyleForm.diet === d
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-xs'
                          : 'glass-subcard bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{d}</span>
                      {lifestyleForm.diet === d && <Check size={12} className="text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Daily Physical Activity</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, activityLevel: act })}
                      className={`py-2 px-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between cursor-pointer ${
                        lifestyleForm.activityLevel === act
                          ? 'bg-emerald-500/20 border-emerald-400/60 text-emerald-300 shadow-xs'
                          : 'glass-subcard bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <span className="truncate">{act}</span>
                      {lifestyleForm.activityLevel === act && <Check size={12} className="text-emerald-400 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smoking & Alcohol */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">Smoking Status</label>
                  <select
                    value={lifestyleForm.smoking || 'Non-smoker'}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, smoking: e.target.value })}
                    className="w-full px-2.5 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  >
                    <option value="Non-smoker" className="bg-slate-900 text-white">Non-smoker</option>
                    <option value="Former smoker" className="bg-slate-900 text-white">Former smoker</option>
                    <option value="Occasional" className="bg-slate-900 text-white">Occasional</option>
                    <option value="Regular" className="bg-slate-900 text-white">Regular</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-300 block mb-1.5">Alcohol Intake</label>
                  <select
                    value={lifestyleForm.alcohol || 'Occasional'}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, alcohol: e.target.value })}
                    className="w-full px-2.5 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-semibold text-white outline-none focus:border-cyan-400"
                  >
                    <option value="None" className="bg-slate-900 text-white">None (Teetotaler)</option>
                    <option value="Occasional" className="bg-slate-900 text-white">Occasional</option>
                    <option value="Moderate" className="bg-slate-900 text-white">Moderate</option>
                    <option value="Regular" className="bg-slate-900 text-white">Regular</option>
                  </select>
                </div>
              </div>

              {/* Sleep Target */}
              <div>
                <label className="font-bold text-slate-300 block mb-1.5">Nightly Sleep Target</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['6 Hours', '7 Hours', '8 Hours', '9+ Hours'].map((slp) => (
                    <button
                      key={slp}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, sleepTarget: slp })}
                      className={`py-2 px-1 text-center rounded-xl border font-bold text-[11px] transition cursor-pointer ${
                        lifestyleForm.sleepTarget === slp
                          ? 'bg-purple-500/20 border-purple-400/60 text-purple-300 shadow-xs'
                          : 'glass-subcard bg-slate-900/60 border-white/10 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {slp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health Goals List */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-300">Target Health Goals ({goalsList.length})</label>
                  <span className="text-[10px] text-slate-400 font-medium">Synced to Patient 360</span>
                </div>

                {/* Add new goal input */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Walk 10,000 steps daily"
                    value={newGoalInput}
                    onChange={(e) => setNewGoalInput(e.target.value)}
                    className="flex-1 px-3 py-2 glass-subcard bg-slate-900/80 border border-white/10 rounded-xl text-xs font-medium text-white placeholder:text-slate-500 outline-none focus:border-cyan-400"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newGoalInput.trim() && !goalsList.includes(newGoalInput.trim())) {
                        setGoalsList([...goalsList, newGoalInput.trim()]);
                        setNewGoalInput('');
                      }
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs cursor-pointer"
                  >
                    <Plus size={14} />
                    <span>Add</span>
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="flex flex-wrap gap-1">
                  {[
                    'Walk 10,000 steps daily',
                    'Target 8 hours sleep',
                    'Maintain BP < 120/80 mmHg',
                    'Drink 2.5L water daily',
                    'Keep HbA1c < 6.5%',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => {
                        if (!goalsList.includes(preset)) setGoalsList([...goalsList, preset]);
                      }}
                      className="px-2 py-0.5 glass-subcard bg-slate-900/80 text-cyan-300 border border-cyan-400/30 rounded-lg text-[10px] font-bold hover:bg-cyan-500/20 transition cursor-pointer"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Existing goals */}
                <div className="space-y-1 pt-1">
                  {goalsList.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 glass-subcard bg-slate-900/60 border border-white/5 rounded-xl">
                      <span className="font-semibold text-slate-200 text-[11px] truncate">{g}</span>
                      <button
                        type="button"
                        onClick={() => setGoalsList(goalsList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-400 p-1 transition cursor-pointer"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowLifestyleModal(false)}
                  className="flex-1 py-2.5 glass-subcard bg-slate-800/80 hover:bg-slate-700/80 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLifestyle}
                  className="flex-1 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-400 hover:opacity-95 text-slate-950 rounded-xl text-xs font-black transition shadow-md shadow-emerald-500/25 cursor-pointer"
                >
                  {savingLifestyle ? 'Saving…' : 'Save to Chart'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
