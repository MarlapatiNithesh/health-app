import React, { useState, useEffect, useRef } from 'react';
import { 
  FileHeart, 
  Activity, 
  Pill, 
  AlertCircle, 
  FlaskConical, 
  Calendar, 
  Plus, 
  X, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  ShieldAlert, 
  Stethoscope,
  Target,
  Heart,
  Apple,
  Sparkles,
  Check,
  Trash2,
  Download,
  Upload,
  FileText,
  TrendingUp,
  Droplets,
  Moon,
  Footprints,
  Filter,
  Eye,
  Info
} from 'lucide-react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';

export function Patient360Screen({ onClose }) {
  const { member } = useAuth();
  const patientId = member?.id || 'me';

  const [activeTab, setActiveTab] = useState('timeline'); // 'timeline' | 'lifestyle' | 'conditions' | 'medications' | 'allergies' | 'labs' | 'encounters'
  const [timeline, setTimeline] = useState([]);
  const [timelineFilter, setTimelineFilter] = useState('all'); // 'all' | 'documents' | 'medications' | 'labs' | 'conditions' | 'allergies'
  const [conditions, setConditions] = useState([]);
  const [medications, setMedications] = useState([]);
  const [allergies, setAllergies] = useState([]);
  const [labs, setLabs] = useState([]);
  const [encounters, setEncounters] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [dailyData, setDailyData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [downloadNotice, setDownloadNotice] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  const fileInputRef = useRef(null);

  // ── Patient Lifestyle & Goals State ──
  const [lifestyle, setLifestyle] = useState({
    diet: 'Balanced',
    smoking: 'Never',
    alcohol: 'Occasional',
    activityLevel: 'Moderately Active',
    sleepTarget: '8 Hours',
    waterTarget: '2.5 Liters',
  });
  const [goals, setGoals] = useState([]);
  const [newGoalText, setNewGoalText] = useState('');
  const [savingLifestyle, setSavingLifestyle] = useState(false);
  const [completedGoals, setCompletedGoals] = useState({});

  // Modals for adding items (User's own inputs, clean defaults)
  const [showAddCondition, setShowAddCondition] = useState(false);
  const [conditionForm, setConditionForm] = useState({ name: '', code: '', severity: 'moderate' });

  const [showAddMed, setShowAddMed] = useState(false);
  const [medForm, setMedForm] = useState({ name: '', dose: '', frequency: '', route: 'oral' });

  const [showAddAllergy, setShowAddAllergy] = useState(false);
  const [allergyForm, setAllergyForm] = useState({ substance: '', reaction: '', severity: 'moderate' });

  const [showAddLab, setShowAddLab] = useState(false);
  const [labForm, setLabForm] = useState({ testName: '', value: '', unit: 'mg/dL', refLow: '', refHigh: '', interpretation: 'normal' });

  const loadData = async () => {
    setLoading(true);
    try {
      // 0. Patient Profile (Lifestyle & Goals)
      api.getPatientChart(patientId)
        .then(res => {
          const p = res?.patient || res;
          if (p?.lifestyle && typeof p.lifestyle === 'object') {
            setLifestyle(prev => ({ ...prev, ...p.lifestyle }));
          }
          if (Array.isArray(p?.goals)) {
            setGoals(p.goals);
          }
        })
        .catch(() => {});

      // 1. Conditions
      api.getConditions(patientId)
        .then(res => setConditions(Array.isArray(res) ? res : res?.conditions || []))
        .catch(() => {});

      // 2. Medications
      api.getMedications(patientId)
        .then(res => setMedications(Array.isArray(res) ? res : res?.medications || []))
        .catch(() => {});

      // 3. Allergies
      api.getAllergies(patientId)
        .then(res => setAllergies(Array.isArray(res) ? res : res?.allergies || []))
        .catch(() => {});

      // 4. Labs
      api.getLabs(patientId)
        .then(res => setLabs(Array.isArray(res) ? res : res?.labs || []))
        .catch(() => {});

      // 5. Timeline
      api.getTimeline(patientId)
        .then(res => setTimeline(Array.isArray(res) ? res : res?.timeline || []))
        .catch(() => {});

      // 6. Encounters
      api.listEncounters()
        .then(res => setEncounters(Array.isArray(res) ? res : res?.encounters || []))
        .catch(() => {});

      // 7. Documents
      api.listDocuments()
        .then(res => setDocuments(Array.isArray(res) ? res : res?.documents || []))
        .catch(() => {});

      // 8. Real-time Telemetry / Daily Summary
      api.getDailySummary()
        .then(res => setDailyData(res))
        .catch(() => {});

    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [patientId]);

  // Document Upload with Auto-detection
  const handleUploadDocument = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingDoc(true);
    try {
      const res = await api.uploadDocument(file);
      const detected = res?.document?.docType || res?.docType || 'prescription';
      alert(`Success! Document "${file.name}" was auto-detected as [${detected.replace('_', ' ').toUpperCase()}]. All medical entities have been added to your Patient 360 chart.`);
      await loadData();
    } catch (err) {
      alert(`Upload failed: ${err.message || String(err)}`);
    } finally {
      setUploadingDoc(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleCreateCondition = async (e) => {
    e.preventDefault();
    try {
      await api.recordCondition(patientId, conditionForm);
      setShowAddCondition(false);
      setConditionForm({ name: '', code: '', severity: 'moderate' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateMed = async (e) => {
    e.preventDefault();
    try {
      await api.recordMedication(patientId, medForm);
      setShowAddMed(false);
      setMedForm({ name: '', dose: '', frequency: '', route: 'oral' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateAllergy = async (e) => {
    e.preventDefault();
    try {
      await api.recordAllergy(patientId, allergyForm);
      setShowAddAllergy(false);
      setAllergyForm({ substance: '', reaction: '', severity: 'moderate' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleCreateLab = async (e) => {
    e.preventDefault();
    try {
      await api.recordLab(patientId, { ...labForm, value: parseFloat(labForm.value) });
      setShowAddLab(false);
      setLabForm({ testName: '', value: '', unit: 'mg/dL', refLow: '', refHigh: '', interpretation: 'normal' });
      loadData();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSaveLifestyleAndGoals = async (e) => {
    if (e) e.preventDefault();
    setSavingLifestyle(true);
    try {
      await api.updatePatientProfile(patientId, {
        lifestyle,
        goals,
      });
      alert('Lifestyle habits and target goals saved to your medical chart!');
      loadData();
    } catch (err) {
      alert(`Save failed: ${err.message}`);
    } finally {
      setSavingLifestyle(false);
    }
  };

  const handleAddGoal = (e) => {
    if (e) e.preventDefault();
    const clean = newGoalText.trim();
    if (!clean) return;
    if (goals.includes(clean)) return;
    const updated = [...goals, clean];
    setGoals(updated);
    setNewGoalText('');
  };

  const handleRemoveGoal = (idx) => {
    const updated = goals.filter((_, i) => i !== idx);
    setGoals(updated);
  };

  const handleDownloadPdf = async () => {
    setDownloadingPdf(true);
    setDownloadNotice(null);
    try {
      const res = await api.downloadHealthSummaryPdf(patientId);
      setDownloadNotice({
        type: 'success',
        message: `Health Summary PDF saved (${res?.filename || 'Patient_Health_Summary.pdf'})`,
        url: api.getHealthSummaryPdfUrl(patientId),
      });
      setTimeout(() => setDownloadNotice(null), 10000);
    } catch (err) {
      setDownloadNotice({
        type: 'error',
        message: `Download failed: ${err.message}`,
        url: api.getHealthSummaryPdfUrl(patientId),
      });
      setTimeout(() => setDownloadNotice(null), 10000);
    } finally {
      setDownloadingPdf(false);
    }
  };

  // Real-time telemetry values from daily summary or native
  const actualSteps = dailyData?.steps?.count || (typeof window !== 'undefined' && window.__LATEST_HEALTH_TELEMETRY__?.today?.steps) || 0;
  const actualSleepMins = dailyData?.sleep?.durationMinutes || (typeof window !== 'undefined' && window.__LATEST_HEALTH_TELEMETRY__?.today?.sleepMinutes) || 0;
  const actualHydrationLiters = dailyData?.hydration?.volumeLiters || 0;
  const actualHeartRate = dailyData?.heart_rate?.resting || dailyData?.heart_rate?.avg || (typeof window !== 'undefined' && window.__LATEST_HEALTH_TELEMETRY__?.heartRate) || null;
  const actualBpSys = dailyData?.blood_pressure_systolic?.latest || null;
  const actualBpDia = dailyData?.blood_pressure_diastolic?.latest || null;

  // Compute goal progress percentage with real patient metrics
  const getGoalProgress = (goalText, idx) => {
    const text = (goalText || '').toLowerCase();

    // 1. Steps Goal (e.g. "Walk 10,000 steps daily")
    if (text.includes('step')) {
      const match = text.match(/(\d+[\d,]*)/);
      const target = match ? parseInt(match[1].replace(/,/g, ''), 10) : 10000;
      const pct = Math.min(100, Math.round((actualSteps / Math.max(1, target)) * 100));
      return {
        pct,
        currentText: `${actualSteps.toLocaleString()} / ${target.toLocaleString()} steps`,
        status: pct >= 100 ? 'Goal Met Today 🎉' : 'In Progress',
        color: pct >= 100 ? 'emerald' : 'sky',
        isMet: pct >= 100,
      };
    }

    // 2. Sleep Goal (e.g. "Target 8 hours sleep")
    if (text.includes('sleep') || text.includes('hour')) {
      const match = text.match(/(\d+)/);
      const targetHours = match ? parseFloat(match[1]) : 8;
      const targetMins = targetHours * 60;
      const pct = Math.min(100, Math.round((actualSleepMins / Math.max(1, targetMins)) * 100));
      const hoursLogged = (actualSleepMins / 60).toFixed(1);
      return {
        pct,
        currentText: `${hoursLogged}h / ${targetHours}h nightly`,
        status: actualSleepMins >= 420 ? 'Optimal Rest Met' : (actualSleepMins > 0 ? 'In Progress' : 'Pending Tonight\'s Sleep'),
        color: pct >= 85 ? 'emerald' : 'purple',
        isMet: pct >= 85,
      };
    }

    // 3. Water / Hydration Goal (e.g. "Drink 2.5L water daily")
    if (text.includes('water') || text.includes('hydration') || text.includes('drink')) {
      const match = text.match(/([\d.]+)\s*l/i);
      const target = match ? parseFloat(match[1]) : 2.5;
      const pct = Math.min(100, Math.round((actualHydrationLiters / Math.max(0.1, target)) * 100));
      return {
        pct,
        currentText: `${actualHydrationLiters.toFixed(1)}L / ${target.toFixed(1)}L`,
        status: pct >= 100 ? 'Hydration Met 💧' : 'In Progress',
        color: pct >= 100 ? 'emerald' : 'cyan',
        isMet: pct >= 100,
      };
    }

    // 4. Blood Pressure Goal (e.g. "Maintain BP < 120/80 mmHg")
    if (text.includes('bp') || text.includes('blood pressure')) {
      if (actualBpSys && actualBpDia) {
        const isNormal = actualBpSys <= 120 && actualBpDia <= 80;
        return {
          pct: isNormal ? 100 : 70,
          currentText: `${actualBpSys}/${actualBpDia} mmHg`,
          status: isNormal ? 'Target Met (Normal BP)' : 'Elevated Reading',
          color: isNormal ? 'emerald' : 'amber',
          isMet: isNormal,
        };
      }
      return {
        pct: 0,
        currentText: 'No reading today',
        status: 'Awaiting Today\'s BP Reading',
        color: 'slate',
        isMet: false,
      };
    }

    // 5. HbA1c Goal (e.g. "Keep HbA1c < 6.5%")
    if (text.includes('hba1c') || text.includes('a1c')) {
      const hba1cLab = labs.find(l => (l.testName || l.name || '').toLowerCase().includes('hba1c'));
      if (hba1cLab) {
        const val = parseFloat(hba1cLab.value ?? hba1cLab.valueNum ?? hba1cLab.valueText);
        const match = text.match(/([\d.]+)/);
        const target = match ? parseFloat(match[1]) : 6.5;
        const isGood = !isNaN(val) && val <= target;
        return {
          pct: isGood ? 100 : 65,
          currentText: `Latest: ${val}% (Target < ${target}%)`,
          status: isGood ? 'Clinical Target Achieved' : 'Active Management',
          color: isGood ? 'emerald' : 'amber',
          isMet: isGood,
        };
      }
      return {
        pct: 0,
        currentText: 'Awaiting lab test',
        status: 'Active Clinical Target',
        color: 'slate',
        isMet: false,
      };
    }

    // 6. Generic Habit Goal (User toggles done for today)
    const isDone = Boolean(completedGoals[idx]);
    return {
      pct: isDone ? 100 : 0,
      currentText: isDone ? 'Completed Today' : 'Daily Routine',
      status: isDone ? 'Marked Done Today' : 'Tap to Complete',
      color: isDone ? 'emerald' : 'slate',
      isMet: isDone,
    };
  };

  // Filtered timeline events
  const filteredTimeline = timeline.filter((event) => {
    if (timelineFilter === 'all') return true;
    const type = (event.eventType || event.type || '').toLowerCase();
    if (timelineFilter === 'documents') return type === 'document' || type === 'encounter';
    if (timelineFilter === 'medications') return type === 'medication';
    if (timelineFilter === 'labs') return type === 'lab_result';
    if (timelineFilter === 'conditions') return type === 'condition';
    if (timelineFilter === 'allergies') return type === 'allergy';
    return true;
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-2 sm:p-4 animate-fade-in">
      <div className="bg-white w-full max-w-lg h-[94vh] max-h-[850px] rounded-[32px] shadow-2xl flex flex-col overflow-hidden border border-slate-200">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900 p-4 text-white flex items-center justify-between border-b border-emerald-900/40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
              <FileHeart size={22} />
            </div>
            <div>
              <h3 className="text-base font-extrabold tracking-tight">Patient 360 Medical Chart</h3>
              <p className="text-[11px] text-slate-400 font-medium">Verified Records • Labs • Rx • Lifestyle & Goals</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Hidden File Input */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleUploadDocument} 
              accept=".pdf,image/*,.txt,.doc,.docx" 
              className="hidden" 
            />

            {/* Upload Document Button with Auto-detect */}
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingDoc}
              className="px-2.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 border border-white/15 shadow-xs"
              title="Upload prescription, lab report, discharge summary or scan (auto-detected)"
            >
              <Upload size={13} className="text-emerald-400" />
              <span>{uploadingDoc ? 'Analyzing…' : 'Upload Rx/Doc'}</span>
            </button>

            {/* PDF Summary Export */}
            <button
              onClick={handleDownloadPdf}
              disabled={downloadingPdf}
              className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              title="Download your Health Summary PDF"
            >
              <Download size={13} />
              <span>{downloadingPdf ? 'Exporting…' : 'PDF'}</span>
            </button>

            {/* Close */}
            <button 
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-slate-300 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* PDF Download Feedback Notification Banner */}
        {downloadNotice && (
          <div className={`px-4 py-2 text-xs font-bold flex items-center justify-between transition-all ${
            downloadNotice.type === 'success' 
              ? 'bg-emerald-500 text-white' 
              : 'bg-rose-500 text-white'
          }`}>
            <span>{downloadNotice.message}</span>
            {downloadNotice.url && (
              <a 
                href={downloadNotice.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline hover:opacity-80 ml-2"
              >
                View PDF
              </a>
            )}
          </div>
        )}

        {/* Tab Strip */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs font-bold">
          {[
            { id: 'timeline', label: 'Timeline', icon: Clock, count: timeline.length },
            { id: 'lifestyle', label: 'Lifestyle & Goals', icon: Target, count: goals.length },
            { id: 'conditions', label: 'Conditions', icon: Activity, count: conditions.length },
            { id: 'medications', label: 'Medications', icon: Pill, count: medications.length },
            { id: 'allergies', label: 'Allergies', icon: AlertCircle, count: allergies.length },
            { id: 'labs', label: 'Lab Panels', icon: FlaskConical, count: labs.length },
            { id: 'encounters', label: 'Encounters', icon: Stethoscope, count: encounters.length },
          ].map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1.5 rounded-xl transition flex items-center gap-1.5 shrink-0 ${
                activeTab === t.id 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:bg-slate-200/60'
              }`}
            >
              <t.icon size={13} />
              <span>{t.label}</span>
              {typeof t.count === 'number' && t.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                  activeTab === t.id ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-700'
                }`}>
                  {t.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Body Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">

          {/* ══════════════════════════════════════════════════════════
              0. LIFESTYLE & TARGET GOALS (REAL-TIME DATA & PERCENTAGES)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'lifestyle' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Patient Lifestyle & Goals
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Real-time progress tracked from your health devices, documents & daily habits.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleSaveLifestyleAndGoals}
                  disabled={savingLifestyle}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-sm transition active:scale-95"
                >
                  <Check size={13} />
                  <span>{savingLifestyle ? 'Saving…' : 'Save to Chart'}</span>
                </button>
              </div>

              {/* Target Health Goals Card with REAL PROGRESS */}
              <div className="bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 text-white p-4 rounded-3xl border border-emerald-900/60 space-y-3.5 shadow-sm">
                <div className="flex items-center justify-between border-b border-emerald-900/40 pb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                      <Target size={15} />
                    </div>
                    <div>
                      <span className="font-extrabold text-xs text-white">Target Health Goals ({goals.length})</span>
                      <p className="text-[10px] text-slate-400">Real-time completion percentage based on authentic health metrics</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    Live Telemetry
                  </span>
                </div>

                {/* Goals List with Real Percentage Bar */}
                {goals.length === 0 ? (
                  <p className="text-xs text-slate-400 text-center py-2">No target goals added yet. Add one below or click quick presets!</p>
                ) : (
                  <div className="space-y-2.5">
                    {goals.map((goal, idx) => {
                      const prog = getGoalProgress(goal, idx);
                      return (
                        <div
                          key={idx}
                          className="p-3 bg-white/5 border border-white/10 rounded-2xl space-y-2 hover:bg-white/8 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2 flex-1">
                              <button
                                type="button"
                                onClick={() => setCompletedGoals(prev => ({ ...prev, [idx]: !prev[idx] }))}
                                className={`w-5 h-5 rounded-lg border flex items-center justify-center transition shrink-0 ${
                                  prog.isMet 
                                    ? 'bg-emerald-500 border-emerald-400 text-slate-950' 
                                    : 'border-white/30 text-transparent hover:border-emerald-400'
                                }`}
                              >
                                <Check size={12} strokeWidth={3} />
                              </button>
                              <div>
                                <span className="font-bold text-xs text-white block">{goal}</span>
                                <span className="text-[10px] text-slate-400 font-medium">
                                  {prog.currentText} • <strong className="text-emerald-300">{prog.status}</strong>
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-xs font-black text-emerald-300">{prog.pct}%</span>
                              <button
                                type="button"
                                onClick={() => handleRemoveGoal(idx)}
                                className="text-slate-500 hover:text-rose-400 p-1 transition"
                                title="Remove goal"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Real Progress Bar */}
                          <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 rounded-full transition-all duration-500"
                              style={{ width: `${Math.max(4, prog.pct)}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Add Goal Input */}
                <div className="flex gap-2 pt-1">
                  <input
                    type="text"
                    value={newGoalText}
                    onChange={(e) => setNewGoalText(e.target.value)}
                    placeholder="Add target goal (e.g. Walk 10,000 steps daily)"
                    className="flex-1 px-3 py-2 bg-white/10 border border-white/15 rounded-xl text-xs text-white placeholder-slate-400 outline-none focus:border-emerald-400"
                    onKeyDown={(e) => { if (e.key === 'Enter') handleAddGoal(e); }}
                  />
                  <button
                    type="button"
                    onClick={handleAddGoal}
                    className="px-3.5 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold rounded-xl transition shadow-xs"
                  >
                    Add
                  </button>
                </div>

                {/* Quick Presets */}
                <div className="pt-1">
                  <span className="text-[10px] text-slate-400 font-bold block mb-1">Quick Clinical & Wellness Presets:</span>
                  <div className="flex flex-wrap gap-1">
                    {[
                      'Walk 10,000 steps daily',
                      'Target 8 hours sleep',
                      'Maintain BP < 120/80 mmHg',
                      'Drink 2.5L water daily',
                      'Keep HbA1c < 6.5%',
                      'Take morning medications'
                    ].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          if (!goals.includes(preset)) setGoals([...goals, preset]);
                        }}
                        className="px-2 py-0.5 bg-white/10 text-slate-200 border border-white/10 rounded-lg text-[10px] font-medium hover:bg-emerald-500/20 hover:border-emerald-400/50 transition"
                      >
                        + {preset}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lifestyle Habits Card */}
              <div className="bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-3.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-900 border-b border-slate-200/80 pb-2">
                  <Apple size={15} className="text-emerald-600" />
                  <span>Daily Lifestyle & Dietary Habits</span>
                </div>

                {/* Diet */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">Dietary Pattern</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Balanced', 'Vegetarian', 'Vegan', 'Low Carb / Keto', 'Mediterranean', 'Low Sodium / Diabetic'].map((d) => (
                      <button
                        key={d}
                        type="button"
                        onClick={() => setLifestyle({ ...lifestyle, diet: d })}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border ${
                          lifestyle.diet === d
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {d}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Physical Activity */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-slate-600">Physical Activity Level</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Sedentary', 'Light (1-2x/wk)', 'Moderate (3-5x/wk)', 'Highly Active'].map((act) => (
                      <button
                        key={act}
                        type="button"
                        onClick={() => setLifestyle({ ...lifestyle, activityLevel: act })}
                        className={`px-2.5 py-1 rounded-xl text-[11px] font-bold transition border ${
                          lifestyle.activityLevel === act
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                            : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {act}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Smoking & Alcohol */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Smoking</label>
                    <div className="flex flex-wrap gap-1">
                      {['Never', 'Former', 'Occasional', 'Regular'].map((s) => (
                        <button
                          key={s}
                          type="button"
                          onClick={() => setLifestyle({ ...lifestyle, smoking: s })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            lifestyle.smoking === s
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Alcohol</label>
                    <div className="flex flex-wrap gap-1">
                      {['None', 'Social', 'Moderate', 'Regular'].map((a) => (
                        <button
                          key={a}
                          type="button"
                          onClick={() => setLifestyle({ ...lifestyle, alcohol: a })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            lifestyle.alcohol === a
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {a}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Sleep & Water Targets */}
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Nightly Sleep Target</label>
                    <div className="flex flex-wrap gap-1">
                      {['6 Hours', '7 Hours', '8 Hours', '9+ Hours'].map((slp) => (
                        <button
                          key={slp}
                          type="button"
                          onClick={() => setLifestyle({ ...lifestyle, sleepTarget: slp })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            lifestyle.sleepTarget === slp
                              ? 'bg-purple-600 text-white border-purple-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {slp}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-slate-600">Daily Water Target</label>
                    <div className="flex flex-wrap gap-1">
                      {['2.0 Liters', '2.5 Liters', '3.0 Liters'].map((wtr) => (
                        <button
                          key={wtr}
                          type="button"
                          onClick={() => setLifestyle({ ...lifestyle, waterTarget: wtr })}
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-bold border ${
                            lifestyle.waterTarget === wtr
                              ? 'bg-cyan-600 text-white border-cyan-600'
                              : 'bg-white text-slate-600 border-slate-200'
                          }`}
                        >
                          {wtr}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              1. TIMELINE (PATIENT-CENTRIC, BEAUTIFUL & STORY-DRIVEN)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'timeline' && (
            <div className="space-y-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Unified Medical Journey Timeline
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Chronological story of your consultations, prescriptions, lab results & health events.
                  </p>
                </div>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                >
                  <Plus size={13} />
                  <span>Upload Doc</span>
                </button>
              </div>

              {/* Category Filter Chips */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1 text-[11px] font-bold">
                {[
                  { id: 'all', label: `All (${timeline.length})` },
                  { id: 'documents', label: '📄 Reports & Visits' },
                  { id: 'medications', label: '💊 Prescriptions' },
                  { id: 'labs', label: '🧪 Lab Results' },
                  { id: 'conditions', label: '🩺 Diagnoses' },
                  { id: 'allergies', label: '⚠️ Allergies' },
                ].map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setTimelineFilter(f.id)}
                    className={`px-2.5 py-1 rounded-xl transition shrink-0 ${
                      timelineFilter === f.id
                        ? 'bg-slate-900 text-white shadow-xs'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>

              {filteredTimeline.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-2 border border-slate-200">
                  <Clock size={28} className="text-slate-400 mx-auto" />
                  <p className="text-xs font-bold text-slate-700">No medical events found for this filter.</p>
                  <p className="text-[11px] text-slate-400">Upload a prescription or lab report to populate your chronological medical chart.</p>
                </div>
              ) : (
                <div className="space-y-3 relative before:absolute before:left-4 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
                  {filteredTimeline.map((event, idx) => {
                    const eventDate = event.eventTime 
                      ? new Date(event.eventTime).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) 
                      : 'Recent';
                    const eventType = (event.eventType || event.type || 'event').toLowerCase();
                    const rawSummary = event.summary || event.title || event.name || 'Medical Event';

                    // Determine Category, Icon & Styling
                    let icon = Clock;
                    let iconBg = 'bg-slate-100 text-slate-700';
                    let ringColor = 'ring-slate-100';
                    let categoryTitle = 'Medical Record';
                    let detailLine = null;
                    let badge = null;

                    if (eventType === 'document') {
                      icon = FileText;
                      iconBg = 'bg-purple-100 text-purple-700';
                      ringColor = 'ring-purple-50';
                      categoryTitle = 'Document Uploaded';
                      badge = 'Auto-Processed';
                      const matchedDoc = documents.find(d => d.id === event.refId || d.originalFilename === rawSummary.replace('Document uploaded: ', ''));
                      if (matchedDoc) {
                        badge = matchedDoc.docType ? matchedDoc.docType.replace('_', ' ').toUpperCase() : 'DOCUMENT';
                        detailLine = matchedDoc.summary;
                      }
                    } else if (eventType === 'encounter') {
                      icon = Stethoscope;
                      iconBg = 'bg-cyan-100 text-cyan-800';
                      ringColor = 'ring-cyan-50';
                      categoryTitle = 'Doctor Consultation';
                      badge = 'Consultation';
                      const matchedEnc = encounters.find(e => e.id === event.refId);
                      if (matchedEnc) {
                        const clinic = matchedEnc.symptomState?.facility;
                        const doc = matchedEnc.symptomState?.doctorName;
                        if (doc && clinic) detailLine = `${doc} • ${clinic}`;
                        else if (matchedEnc.symptomState?.primarySymptom) detailLine = `Reason: ${matchedEnc.symptomState.primarySymptom}`;
                      }
                    } else if (eventType === 'medication') {
                      icon = Pill;
                      iconBg = 'bg-indigo-100 text-indigo-700';
                      ringColor = 'ring-indigo-50';
                      categoryTitle = 'Prescription Prescribed';
                      badge = 'Active Rx';
                      const matchedMed = medications.find(m => m.id === event.refId || m.name === rawSummary);
                      if (matchedMed) {
                        detailLine = [matchedMed.dose, matchedMed.frequency, matchedMed.route ? `(${matchedMed.route})` : null].filter(Boolean).join(' • ');
                      }
                    } else if (eventType === 'lab_result') {
                      icon = FlaskConical;
                      iconBg = 'bg-emerald-100 text-emerald-800';
                      ringColor = 'ring-emerald-50';
                      categoryTitle = 'Laboratory Result';
                      badge = 'Lab Panel';
                      const matchedLab = labs.find(l => l.id === event.refId || l.name === rawSummary || l.testName === rawSummary);
                      if (matchedLab) {
                        const valStr = matchedLab.value ?? matchedLab.valueNum ?? matchedLab.valueText;
                        const unitStr = matchedLab.unit || '';
                        const interp = (matchedLab.interpretation || 'normal').toLowerCase();
                        badge = interp.toUpperCase();
                        detailLine = `${valStr} ${unitStr} ${matchedLab.refLow != null ? `(Reference: ${matchedLab.refLow} - ${matchedLab.refHigh})` : ''}`;
                        if (interp === 'high') {
                          iconBg = 'bg-amber-100 text-amber-800';
                          ringColor = 'ring-amber-50';
                        }
                      }
                    } else if (eventType === 'condition') {
                      icon = Activity;
                      iconBg = 'bg-rose-100 text-rose-700';
                      ringColor = 'ring-rose-50';
                      categoryTitle = 'Diagnosed Condition';
                      badge = 'Active';
                      const matchedCond = conditions.find(c => c.id === event.refId || c.name === rawSummary);
                      if (matchedCond?.code) {
                        detailLine = `ICD-10 Code: ${matchedCond.code}`;
                      } else {
                        detailLine = 'Document Confirmed Diagnosis';
                      }
                    } else if (eventType === 'allergy') {
                      icon = ShieldAlert;
                      iconBg = 'bg-rose-200 text-rose-900';
                      ringColor = 'ring-rose-100';
                      categoryTitle = 'Documented Allergy Alert';
                      badge = 'Safety Alert';
                      const matchedAllergy = allergies.find(a => a.id === event.refId || a.name === rawSummary || a.substance === rawSummary);
                      if (matchedAllergy) {
                        detailLine = matchedAllergy.reaction || matchedAllergy.details?.reaction || 'Allergic reaction recorded';
                      }
                    }

                    const EventIcon = icon;

                    return (
                      <div key={idx} className="flex items-start gap-3 relative pl-9">
                        {/* Timeline Node Icon */}
                        <div className={`w-7 h-7 rounded-full ${iconBg} ring-4 ${ringColor} flex items-center justify-center absolute left-0.5 top-2 shadow-xs shrink-0`}>
                          <EventIcon size={14} />
                        </div>

                        {/* Card Content */}
                        <div className="bg-white p-3.5 rounded-2xl border border-slate-200/90 shadow-xs flex-1 space-y-1.5 hover:border-slate-300 transition">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                              {categoryTitle}
                            </span>
                            <div className="flex items-center gap-1.5">
                              {badge && (
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${
                                  badge === 'HIGH' ? 'bg-amber-100 text-amber-900 border border-amber-200' :
                                  badge === 'SAFETY ALERT' ? 'bg-rose-100 text-rose-900 border border-rose-200' :
                                  'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                }`}>
                                  {badge}
                                </span>
                              )}
                              <span className="text-[10px] text-slate-400 font-medium">{eventDate}</span>
                            </div>
                          </div>

                          <h5 className="font-bold text-slate-900 text-xs leading-snug">{rawSummary}</h5>

                          {detailLine && (
                            <p className="text-[11px] text-slate-600 font-medium bg-slate-50 p-2 rounded-xl border border-slate-100/80 leading-relaxed">
                              {detailLine}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              2. CONDITIONS TAB
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'conditions' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Diagnoses ({conditions.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Document verified chronic and acute medical conditions.</p>
                </div>
                <button
                  onClick={() => setShowAddCondition(true)}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                >
                  <Plus size={13} />
                  <span>Record Condition</span>
                </button>
              </div>

              {conditions.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-1 border border-slate-200">
                  <Activity size={24} className="text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">No medical conditions recorded.</p>
                  <p className="text-[11px] text-slate-400">Diagnoses from uploaded prescriptions will appear here automatically.</p>
                </div>
              ) : (
                conditions.map((c, i) => (
                  <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <Heart size={13} />
                        </div>
                        <h5 className="text-xs font-bold text-slate-900">{c.name || 'Clinical Diagnosis'}</h5>
                      </div>
                      <div className="flex items-center gap-1.5 pl-8">
                        {c.code && (
                          <span className="text-[10px] font-mono text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                            ICD-10: {c.code}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500 font-medium">
                          {c.verificationStatus === 'patient_confirmed' ? 'Verified via Document' : 'Active Clinical Record'}
                        </span>
                      </div>
                    </div>

                    <span className="text-[10px] font-extrabold uppercase px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 shrink-0">
                      {c.severity || c.status || 'Active'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              3. MEDICATIONS TAB
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'medications' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Active Medications ({medications.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Prescribed medicines cross-checked against drug-allergy interactions.
                  </p>
                </div>
                <button
                  onClick={() => setShowAddMed(true)}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                >
                  <Plus size={13} />
                  <span>Add Medication</span>
                </button>
              </div>

              {medications.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-1 border border-slate-200">
                  <Pill size={24} className="text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">No active medications documented.</p>
                  <p className="text-[11px] text-slate-400">Upload a doctor prescription to add prescribed drugs automatically.</p>
                </div>
              ) : (
                medications.map((m, i) => (
                  <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                        <Pill size={16} />
                      </div>
                      <div>
                        <h5 className="text-xs font-bold text-slate-900">{m.name || 'Medication'}</h5>
                        <p className="text-[11px] text-slate-500 font-medium">
                          {[m.dose, m.frequency, m.route ? `(${m.route})` : null].filter(Boolean).join(' • ') || 'Oral dosage prescribed'}
                        </p>
                        <span className="text-[9px] text-emerald-700 font-semibold mt-0.5 inline-block">
                          ✓ Document Verified Prescription
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 shrink-0">
                      Active
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              4. ALLERGIES TAB
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'allergies' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Documented Allergies ({allergies.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Critical contraindications alerted to MediBot AI and prescribers.</p>
                </div>
                <button
                  onClick={() => setShowAddAllergy(true)}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                >
                  <Plus size={13} />
                  <span>Add Allergy</span>
                </button>
              </div>

              {allergies.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-1 border border-slate-200">
                  <ShieldAlert size={24} className="text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">No drug allergies documented.</p>
                  <p className="text-[11px] text-slate-400">Record allergies to ensure safe prescribing.</p>
                </div>
              ) : (
                allergies.map((a, i) => (
                  <div key={i} className="bg-rose-50/70 p-3.5 rounded-2xl border border-rose-200 flex items-start justify-between shadow-xs">
                    <div className="flex items-start gap-2.5">
                      <ShieldAlert size={18} className="text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h5 className="text-xs font-bold text-rose-950">{a.substance || a.name || 'Documented Allergy'}</h5>
                        <p className="text-[11px] text-rose-800 font-medium mt-0.5">
                          Reaction: {a.reaction || a.details?.reaction || 'Allergic reaction recorded'}
                        </p>
                        <p className="text-[10px] text-rose-600 mt-1">
                          ⚠️ Alert physicians & pharmacists before drug administration.
                        </p>
                      </div>
                    </div>
                    <span className="text-[10px] font-extrabold uppercase text-rose-900 bg-rose-200 px-2 py-0.5 rounded-full shrink-0">
                      {a.severity || 'Moderate'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              5. LAB PANELS TAB (CLEAR PATIENT EXPLANATIONS & NORMAL/HIGH)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'labs' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                    Diagnostic Lab Panels ({labs.length})
                  </h4>
                  <p className="text-[11px] text-slate-500 mt-0.5">Biochemistry, hematology, and pathology test results.</p>
                </div>
                <button
                  onClick={() => setShowAddLab(true)}
                  className="px-2.5 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1 hover:bg-emerald-100 transition"
                >
                  <Plus size={13} />
                  <span>Add Lab Result</span>
                </button>
              </div>

              {labs.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-1 border border-slate-200">
                  <FlaskConical size={24} className="text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">No laboratory observations recorded.</p>
                  <p className="text-[11px] text-slate-400">Upload a blood report to automatically extract tests, values, and reference ranges.</p>
                </div>
              ) : (
                labs.map((l, i) => {
                  const interp = (l.interpretation || 'normal').toLowerCase();
                  const isNormal = interp === 'normal';
                  const isHigh = interp === 'high';

                  return (
                    <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs flex items-center justify-between hover:border-slate-300 transition">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${
                            isNormal ? 'bg-emerald-50 text-emerald-700' : isHigh ? 'bg-amber-50 text-amber-700' : 'bg-sky-50 text-sky-700'
                          }`}>
                            <FlaskConical size={14} />
                          </div>
                          <div>
                            <h5 className="text-xs font-bold text-slate-900">{l.testName || l.name || 'Lab Observation'}</h5>
                            {(l.refLow != null || l.refHigh != null) && (
                              <span className="text-[10px] text-slate-400 font-medium">
                                Reference: {l.refLow} - {l.refHigh} {l.unit}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="text-right space-y-0.5">
                        <span className="text-sm font-black text-slate-900 block">
                          {l.value ?? l.valueText ?? l.valueNum ?? 'Recorded'}{' '}
                          {l.unit && <span className="text-[10px] text-slate-400 font-normal">{l.unit}</span>}
                        </span>
                        <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full inline-block ${
                          isNormal 
                            ? 'bg-emerald-100 text-emerald-900' 
                            : isHigh
                            ? 'bg-amber-100 text-amber-900' 
                            : 'bg-sky-100 text-sky-900'
                        }`}>
                          {isNormal ? '✓ Normal' : isHigh ? '▲ High' : '▼ Low'}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════
              6. ENCOUNTERS TAB (DOCTOR VISITS & CLINICS)
              ══════════════════════════════════════════════════════════ */}
          {activeTab === 'encounters' && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400">
                Consultation Encounters ({encounters.length})
              </h4>

              {encounters.length === 0 ? (
                <div className="bg-slate-50 p-6 rounded-3xl text-center space-y-1 border border-slate-200">
                  <Stethoscope size={24} className="text-slate-400 mx-auto mb-1" />
                  <p className="text-xs font-bold text-slate-700">No active doctor visits recorded.</p>
                  <p className="text-[11px] text-slate-400">Upload prescription documents or chat with MediBot AI to log consultation encounters.</p>
                </div>
              ) : (
                encounters.map((enc, i) => {
                  const encounterTitle = enc.summary || (enc.intent === 'record_query' ? 'Prescription & Records Review' : 'Clinical Consultation Session');
                  const encounterDate = enc.startedAt ? new Date(enc.startedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : null;
                  const complaint = enc.chiefComplaint || (enc.symptomState?.primarySymptom) || (Array.isArray(enc.symptomState?.diagnoses) ? enc.symptomState.diagnoses.join(', ') : 'Clinical consultation');
                  const isDocument = enc.intent === 'record_query' || enc.symptomState?.documentId;

                  return (
                    <div key={i} className="bg-white p-3.5 rounded-2xl border border-slate-200 shadow-xs space-y-2 hover:border-slate-300 transition">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="text-xs font-bold text-slate-900 block leading-tight">{encounterTitle}</span>
                          {encounterDate && (
                            <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1 mt-0.5">
                              <Clock size={11} /> {encounterDate}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {isDocument && (
                            <span className="text-[10px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full">
                              Doctor Rx
                            </span>
                          )}
                          <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                            enc.status === 'complete' 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-cyan-100 text-cyan-800'
                          }`}>
                            {enc.status === 'complete' ? 'Completed' : 'In Progress'}
                          </span>
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-600 font-medium bg-slate-50 p-2 rounded-xl border border-slate-100 leading-relaxed">
                        {complaint}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add Condition Modal */}
      {showAddCondition && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateCondition} className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Record Clinical Diagnosis</h4>
            <input
              type="text"
              required
              placeholder="Condition Name (e.g. Essential Hypertension)"
              value={conditionForm.name}
              onChange={e => setConditionForm({ ...conditionForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <input
              type="text"
              placeholder="ICD-10 Code (e.g. I10)"
              value={conditionForm.code}
              onChange={e => setConditionForm({ ...conditionForm, code: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <select
              value={conditionForm.severity}
              onChange={e => setConditionForm({ ...conditionForm, severity: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddCondition(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                Save Condition
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Medication Modal */}
      {showAddMed && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateMed} className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Add Prescribed Medication</h4>
            <input
              type="text"
              required
              placeholder="Medicine Name (e.g. Amoxicillin)"
              value={medForm.name}
              onChange={e => setMedForm({ ...medForm, name: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <input
              type="text"
              placeholder="Dose (e.g. 500 mg)"
              value={medForm.dose}
              onChange={e => setMedForm({ ...medForm, dose: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <input
              type="text"
              placeholder="Frequency (e.g. Twice daily after meals)"
              value={medForm.frequency}
              onChange={e => setMedForm({ ...medForm, frequency: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddMed(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                Save Medication
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Allergy Modal */}
      {showAddAllergy && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateAllergy} className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Document Drug Allergy</h4>
            <input
              type="text"
              required
              placeholder="Substance (e.g. Penicillin)"
              value={allergyForm.substance}
              onChange={e => setAllergyForm({ ...allergyForm, substance: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <input
              type="text"
              placeholder="Reaction (e.g. Skin Rash, Hives)"
              value={allergyForm.reaction}
              onChange={e => setAllergyForm({ ...allergyForm, reaction: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <select
              value={allergyForm.severity}
              onChange={e => setAllergyForm({ ...allergyForm, severity: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            >
              <option value="mild">Mild</option>
              <option value="moderate">Moderate</option>
              <option value="severe">Severe</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddAllergy(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold"
              >
                Save Allergy
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Add Lab Result Modal */}
      {showAddLab && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-4">
          <form onSubmit={handleCreateLab} className="bg-white rounded-3xl p-5 w-full max-w-sm space-y-3">
            <h4 className="font-extrabold text-sm text-slate-900">Add Laboratory Observation</h4>
            <input
              type="text"
              required
              placeholder="Test Name (e.g. Fasting Glucose)"
              value={labForm.testName}
              onChange={e => setLabForm({ ...labForm, testName: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                required
                placeholder="Value (e.g. 95)"
                value={labForm.value}
                onChange={e => setLabForm({ ...labForm, value: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
              />
              <input
                type="text"
                placeholder="Unit (e.g. mg/dL)"
                value={labForm.unit}
                onChange={e => setLabForm({ ...labForm, unit: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="number"
                step="any"
                placeholder="Ref Low (e.g. 70)"
                value={labForm.refLow}
                onChange={e => setLabForm({ ...labForm, refLow: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
              />
              <input
                type="number"
                step="any"
                placeholder="Ref High (e.g. 99)"
                value={labForm.refHigh}
                onChange={e => setLabForm({ ...labForm, refHigh: e.target.value })}
                className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
              />
            </div>
            <select
              value={labForm.interpretation}
              onChange={e => setLabForm({ ...labForm, interpretation: e.target.value })}
              className="w-full px-3 py-2 border rounded-xl text-xs outline-none"
            >
              <option value="normal">Normal</option>
              <option value="high">High</option>
              <option value="low">Low</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setShowAddLab(false)}
                className="flex-1 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-bold"
              >
                Save Lab Result
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
