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

  const [editForm, setEditForm] = useState({
    firstName: member?.firstName || '',
    lastName: member?.lastName || '',
    dob: member?.dob ? member.dob.split('T')[0] : '1990-05-15',
    biologicalSex: member?.gender || member?.biologicalSex || 'female',
    heightCm: member?.heightCm || 172.5,
    weightKg: member?.weightKg || 68.4,
  });

  useEffect(() => {
    const pid = member?.id || 'me';
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
    api.getMedications(pid)
      .then(res => setPatientMeds(Array.isArray(res) ? res : res?.medications || []))
      .catch(() => {});

    // Fetch weight progress & history
    api.getWeightProgress()
      .then(res => setWeightProgress(res))
      .catch(() => {});

    api.getProfileHistory()
      .then(res => {
        if (Array.isArray(res)) setHistoryLogs(res);
        else if (res?.history) setHistoryLogs(res.history);
      })
      .catch(() => {});

    // Check scoped consents
    ['data_access', 'ai_processing', 'document_upload'].forEach(scope => {
      api.getScopedConsent(scope)
        .then(res => {
          if (res?.consent) {
            setConsents(prev => ({ ...prev, [scope]: res.consent.granted }));
          }
        })
        .catch(() => {});
    });
    api.getMemberConsent('health_data')
      .then((res) => setConsents((prev) => ({ ...prev, health_data: Boolean(res?.consent?.granted) })))
      .catch(() => {});
  }, [member?.id]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await updateMemberProfile({
        firstName: editForm.firstName,
        lastName: editForm.lastName,
        fullName: `${editForm.firstName} ${editForm.lastName}`.trim(),
        dob: editForm.dob,
        biologicalSex: editForm.biologicalSex,
        gender: editForm.biologicalSex,
        heightCm: parseFloat(editForm.heightCm),
        weightKg: parseFloat(editForm.weightKg),
      });
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

  const height = member?.heightCm || 172.5;
  const weight = member?.weightKg || 68.4;
  const bmi = (weight / ((height / 100) * (height / 100))).toFixed(1);

  return (
    <div className="px-5 py-4 space-y-4 animate-fade-in">
      {/* 1. Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">Member Profile</h1>
          <p className="text-xs font-semibold text-slate-400 mt-0.5">Demographics, Biometrics & Security</p>
        </div>

        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-50 text-[#00a8cc] border border-cyan-200/80 rounded-xl text-xs font-bold hover:bg-cyan-100/50 transition"
        >
          <Edit3 size={13} />
          <span>Edit</span>
        </button>
      </div>

      {/* 2. Profile Hero Card */}
      <div className="bg-white rounded-[26px] p-5 border border-slate-100 shadow-sm space-y-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white text-2xl font-extrabold shadow-md shadow-cyan-500/20">
            {(member?.firstName || member?.fullName || 'J')[0]}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-extrabold text-slate-900 truncate">
              {member?.fullName || `${member?.firstName || 'Jane'} ${member?.lastName || 'Doe'}`}
            </h2>
            <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium mt-0.5">
              <Phone size={12} className="text-slate-400" />
              <span>{member?.phone || member?.phoneE164 || '+14155552671'}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
              <span className="px-2.5 py-0.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full text-[10px] font-bold uppercase tracking-wider">
                {member?.status || 'Active Member'}
              </span>
              <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-full text-[10px] font-bold capitalize">
                Tier: {member?.insuranceTier || 'Corporate Gold'}
              </span>
            </div>
          </div>
        </div>

        {/* Biometrics Grid */}
        <div className="grid grid-cols-3 gap-2.5 pt-3 border-t border-slate-100 text-center">
          <div className="bg-slate-50 p-2.5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Height</span>
            <span className="text-base font-extrabold text-slate-900">{height}</span>
            <span className="text-[10px] text-slate-500 font-semibold ml-0.5">cm</span>
          </div>

          <div className="bg-slate-50 p-2.5 rounded-2xl">
            <span className="text-[10px] font-bold uppercase text-slate-400 block">Weight</span>
            <span className="text-base font-extrabold text-slate-900">{weight}</span>
            <span className="text-[10px] text-slate-500 font-semibold ml-0.5">kg</span>
          </div>

          <div className="bg-cyan-50/60 p-2.5 rounded-2xl border border-cyan-100">
            <span className="text-[10px] font-bold uppercase text-cyan-600 block">BMI</span>
            <span className="text-base font-extrabold text-cyan-900">{bmi}</span>
            <span className="text-[10px] text-cyan-600 font-semibold ml-0.5">Normal</span>
          </div>
        </div>
      </div>

      {/* 3. Patient Lifestyle, Health Goals & Medications Card */}
      <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 rounded-[26px] p-4 text-white shadow-sm space-y-3 border border-emerald-900/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <Sparkles size={16} />
            </div>
            <div>
              <h3 className="text-xs font-bold tracking-tight text-white">Lifestyle & Health Goals</h3>
              <p className="text-[10px] text-slate-400">Integrated into MediBot & Clinical 360 Chart</p>
            </div>
          </div>
          <button
            onClick={() => setShowLifestyleModal(true)}
            className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-400 text-slate-950 rounded-xl text-[11px] font-bold transition flex items-center gap-1 shadow-xs"
          >
            <span>Manage</span>
            <ChevronRight size={12} />
          </button>
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center">
          <div className="bg-white/5 border border-white/10 rounded-xl p-2">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Diet & Habits</span>
            <span className="text-[11px] font-bold text-emerald-300 mt-0.5 block truncate">
              {patientProfile?.lifestyle?.diet ? `${patientProfile.lifestyle.diet}` : (patientProfile?.lifestyle?.activityLevel || 'Not set')}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Health Targets</span>
            <span className="text-[11px] font-bold text-cyan-300 mt-0.5 block truncate">
              {patientProfile?.goals?.length ? `${patientProfile.goals.length} Goal(s)` : 'None set'}
            </span>
          </div>
          <div className="bg-white/5 border border-white/10 rounded-xl p-2">
            <span className="text-[9px] uppercase tracking-wider text-slate-400 block font-bold">Active Rx</span>
            <span className="text-[11px] font-bold text-indigo-300 mt-0.5 block truncate">
              {patientMeds?.length ? `${patientMeds.length} Active Rx` : 'None documented'}
            </span>
          </div>
        </div>
      </div>

      {/* 4. Clinical Consents & Privacy Management */}
      <div className="bg-white rounded-[26px] p-5 border border-slate-100 shadow-sm space-y-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck size={18} className="text-indigo-600" />
            <h3 className="text-sm font-bold text-slate-900">Clinical AI & Data Consents</h3>
          </div>
          <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
            HIPAA/GDPR
          </span>
        </div>

        <p className="text-xs text-slate-500 font-medium">
          Control granular permissions for MediBot AI triage, OCR processing, and wearable data sync.
        </p>

        <div className="space-y-2.5 pt-1">
          <div className="flex items-center justify-between text-xs py-1">
            <div>
              <strong className="text-slate-800 block">MediBot AI Processing</strong>
              <span className="text-[10px] text-slate-400">Allow MediBot to process your messages and relevant records to generate responses</span>
            </div>
            <button onClick={() => toggleConsent('ai_processing')} className="text-indigo-600">
              {consents.ai_processing ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} className="text-slate-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-t border-slate-50">
            <div>
              <strong className="text-slate-800 block">Document OCR & Vault</strong>
              <span className="text-[10px] text-slate-400">Upload and extract medications from prescriptions</span>
            </div>
            <button onClick={() => toggleConsent('document_upload')} className="text-indigo-600">
              {consents.document_upload ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} className="text-slate-300" />}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs py-1 border-t border-slate-50">
            <div>
              <strong className="text-slate-800 block">Share Phone Health Data</strong>
              <span className="text-[10px] text-slate-400">Allow synced readings in your health history and MediBot. Choose phone data types under Phone Health → Data Permissions.</span>
            </div>
            <button onClick={() => toggleConsent('health_data')} className="text-indigo-600">
              {consents.health_data ? <ToggleRight size={28} className="text-indigo-600" /> : <ToggleLeft size={28} className="text-slate-300" />}
            </button>
          </div>


        </div>
      </div>

      {/* 5. Account Actions */}
      <div className="space-y-2 pt-2">
        <button
          onClick={logout}
          className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-2"
        >
          <LogOut size={15} />
          <span>Log Out of Session</span>
        </button>

        <button
          onClick={handleDeleteAccount}
          className="w-full py-2.5 text-rose-500 hover:text-rose-600 hover:bg-rose-50 rounded-2xl text-xs font-bold transition flex items-center justify-center gap-1.5"
        >
          <Trash2 size={14} />
          <span>Delete Account (GDPR / Right to be Forgotten)</span>
        </button>
      </div>

      {/* Edit Profile Modal */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl p-6 w-full max-w-sm shadow-2xl space-y-4">
            <h3 className="font-extrabold text-slate-900 text-base">Edit Demographics & Biometrics</h3>

            <form onSubmit={handleUpdateProfile} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">First Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.firstName}
                    onChange={e => setEditForm({ ...editForm, firstName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Last Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.lastName}
                    onChange={e => setEditForm({ ...editForm, lastName: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 block mb-1">Date of Birth</label>
                <input
                  type="date"
                  value={editForm.dob}
                  onChange={e => setEditForm({ ...editForm, dob: e.target.value })}
                  className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Height (cm)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.heightCm}
                    onChange={e => setEditForm({ ...editForm, heightCm: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-600 block mb-1">Weight (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    value={editForm.weightKg}
                    onChange={e => setEditForm({ ...editForm, weightKg: e.target.value })}
                    className="w-full px-3 py-2 border rounded-xl text-xs font-medium focus:ring-2 focus:ring-cyan-500 outline-none"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[#00a8cc] hover:bg-cyan-600 text-white rounded-xl text-xs font-bold shadow-md shadow-cyan-500/20"
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
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-fade-in">
          <div className="bg-white w-full max-w-md max-h-[90vh] rounded-[28px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 text-white flex items-center justify-between border-b border-emerald-900/40">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Sparkles size={16} />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight">Daily Lifestyle & Target Goals</h3>
                  <p className="text-[10px] text-slate-400">Syncs directly with your Medical Chart & MediBot</p>
                </div>
              </div>
              <button
                onClick={() => setShowLifestyleModal(false)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <form onSubmit={handleSaveLifestyleAndGoals} className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar text-xs">
              {/* Diet */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">Dietary Preference</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Balanced', 'Vegetarian', 'Vegan', 'Low Carb / Keto', 'Mediterranean'].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, diet: d })}
                      className={`py-2 px-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between ${
                        lifestyleForm.diet === d
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{d}</span>
                      {lifestyleForm.diet === d && <Check size={12} className="text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Activity Level */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">Daily Physical Activity</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {['Sedentary', 'Lightly Active', 'Moderately Active', 'Very Active'].map((act) => (
                    <button
                      key={act}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, activityLevel: act })}
                      className={`py-2 px-2.5 rounded-xl border text-left font-bold transition flex items-center justify-between ${
                        lifestyleForm.activityLevel === act
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <span className="truncate">{act}</span>
                      {lifestyleForm.activityLevel === act && <Check size={12} className="text-emerald-600 shrink-0" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Smoking & Alcohol */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">Smoking Status</label>
                  <select
                    value={lifestyleForm.smoking || 'Non-smoker'}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, smoking: e.target.value })}
                    className="w-full px-2.5 py-2 border rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="Non-smoker">Non-smoker</option>
                    <option value="Former smoker">Former smoker</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>

                <div>
                  <label className="font-bold text-slate-800 block mb-1.5">Alcohol Intake</label>
                  <select
                    value={lifestyleForm.alcohol || 'Occasional'}
                    onChange={(e) => setLifestyleForm({ ...lifestyleForm, alcohol: e.target.value })}
                    className="w-full px-2.5 py-2 border rounded-xl bg-slate-50 border-slate-200 text-xs font-semibold outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="None">None (Teetotaler)</option>
                    <option value="Occasional">Occasional</option>
                    <option value="Moderate">Moderate</option>
                    <option value="Regular">Regular</option>
                  </select>
                </div>
              </div>

              {/* Sleep Target */}
              <div>
                <label className="font-bold text-slate-800 block mb-1.5">Nightly Sleep Target</label>
                <div className="grid grid-cols-4 gap-1.5">
                  {['6 Hours', '7 Hours', '8 Hours', '9+ Hours'].map((slp) => (
                    <button
                      key={slp}
                      type="button"
                      onClick={() => setLifestyleForm({ ...lifestyleForm, sleepTarget: slp })}
                      className={`py-2 px-1 text-center rounded-xl border font-bold text-[11px] transition ${
                        lifestyleForm.sleepTarget === slp
                          ? 'bg-purple-50 border-purple-500 text-purple-900 shadow-xs'
                          : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      {slp}
                    </button>
                  ))}
                </div>
              </div>

              {/* Health Goals List */}
              <div className="pt-2 border-t border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-slate-800">Target Health Goals ({goalsList.length})</label>
                  <span className="text-[10px] text-slate-400 font-medium">Synced to Patient 360</span>
                </div>

                {/* Add new goal input */}
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. Walk 10,000 steps daily"
                    value={newGoalInput}
                    onChange={(e) => setNewGoalInput(e.target.value)}
                    className="flex-1 px-3 py-2 border rounded-xl bg-slate-50 border-slate-200 text-xs font-medium outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (newGoalInput.trim() && !goalsList.includes(newGoalInput.trim())) {
                        setGoalsList([...goalsList, newGoalInput.trim()]);
                        setNewGoalInput('');
                      }
                    }}
                    className="px-3 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition flex items-center gap-1 shadow-xs"
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
                      className="px-2 py-0.5 bg-slate-100 text-slate-600 border border-slate-200 rounded-lg text-[10px] font-medium hover:bg-emerald-50 hover:border-emerald-300"
                    >
                      + {preset}
                    </button>
                  ))}
                </div>

                {/* Existing goals */}
                <div className="space-y-1 pt-1">
                  {goalsList.map((g, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded-xl">
                      <span className="font-semibold text-slate-800 text-[11px] truncate">{g}</span>
                      <button
                        type="button"
                        onClick={() => setGoalsList(goalsList.filter((_, i) => i !== idx))}
                        className="text-slate-400 hover:text-rose-500 p-1 transition"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Modal Actions */}
              <div className="flex gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowLifestyleModal(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLifestyle}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition shadow-md shadow-emerald-600/20"
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
