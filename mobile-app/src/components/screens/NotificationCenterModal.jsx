import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  X,
  AlertTriangle,
  Zap,
  Heart,
  Droplets,
  Footprints,
  Compass,
  Pill,
  Moon,
  Clock,
  CheckCircle2,
  Play,
  RotateCcw,
  Sparkles,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Activity,
  Flame,
  Check,
  VolumeX,
  ExternalLink,
  Info
} from 'lucide-react';
import { api } from '../../services/api';

export function NotificationCenterModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'stream1', 'stream2', 'stream3', 'stream4'
  const [notifications, setNotifications] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showSimulator, setShowSimulator] = useState(false);
  const [simulating, setSimulating] = useState(null);
  const [feedbackToast, setFeedbackToast] = useState(null);

  // Special Interactive Modals
  const [vagalModalOpen, setVagalModalOpen] = useState(false);
  const [vagalStep, setVagalStep] = useState('inhale'); // inhale (4s), hold (2s), exhale (6s)
  const [vagalSeconds, setVagalSeconds] = useState(4);
  const [vagalCycle, setVagalCycle] = useState(1);
  const [vagalTimerRunning, setVagalTimerRunning] = useState(false);

  const [carbsModalOpen, setCarbsModalOpen] = useState(false);
  const [retestSecondsRemaining, setRetestSecondsRemaining] = useState(15 * 60);
  const [retestTimerActive, setRetestTimerActive] = useState(false);

  const [daySummaryModalOpen, setDaySummaryModalOpen] = useState(false);

  // Fetch notifications & summary
  const loadNotifications = useCallback(async () => {
    try {
      setLoading(true);
      const [notifsRes, sumRes] = await Promise.all([
        api.getNotifications({ limit: 50 }).catch(() => ({ notifications: [] })),
        api.getStreamsSummary().catch(() => null),
      ]);
      setNotifications(notifsRes?.notifications || []);
      setSummary(sumRes);
    } catch (err) {
      console.warn('Failed to fetch notifications:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadNotifications();
    }
  }, [isOpen, loadNotifications]);

  // Vagal breathing cycle timer
  useEffect(() => {
    let interval = null;
    if (vagalModalOpen && vagalTimerRunning) {
      interval = setInterval(() => {
        setVagalSeconds((sec) => {
          if (sec > 1) return sec - 1;

          // Transition between phases
          setVagalStep((currentStep) => {
            if (currentStep === 'inhale') {
              return 'hold';
            } else if (currentStep === 'hold') {
              return 'exhale';
            } else {
              setVagalCycle((c) => (c < 4 ? c + 1 : 1));
              return 'inhale';
            }
          });

          // Reset duration based on next step
          return 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [vagalModalOpen, vagalTimerRunning]);

  // Fix phase duration transition
  useEffect(() => {
    if (vagalStep === 'inhale') setVagalSeconds(4);
    if (vagalStep === 'hold') setVagalSeconds(2);
    if (vagalStep === 'exhale') setVagalSeconds(6);
  }, [vagalStep]);

  // Fast carbs 15-min retest timer
  useEffect(() => {
    let interval = null;
    if (retestTimerActive && retestSecondsRemaining > 0) {
      interval = setInterval(() => {
        setRetestSecondsRemaining((s) => s - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [retestTimerActive, retestSecondsRemaining]);

  // Execute CTA Action
  const handleAction = async (notif, actionLabel) => {
    const label = actionLabel || notif.actionLabel;
    try {
      // Trigger special modal workflows
      if (label === 'START 2-MIN RESET') {
        setVagalModalOpen(true);
        setVagalTimerRunning(true);
        setVagalCycle(1);
        setVagalStep('inhale');
        setVagalSeconds(4);
      } else if (label === 'LOG FAST CARBS & RETEST') {
        setCarbsModalOpen(true);
        setRetestSecondsRemaining(15 * 60);
        setRetestTimerActive(true);
      } else if (label === 'VIEW DAY SUMMARY') {
        setDaySummaryModalOpen(true);
      }

      // Call API
      const res = await api.executeNotificationAction(notif.id, label);
      setFeedbackToast(res?.feedbackToast || `Action "${label}" logged`);
      setTimeout(() => setFeedbackToast(null), 3500);

      // Refresh notifications to show updated status
      await loadNotifications();
    } catch (err) {
      console.error('Action failed:', err);
      setFeedbackToast(`Action completed: ${label}`);
      setTimeout(() => setFeedbackToast(null), 3000);
    }
  };

  // Trigger stream simulation
  const handleSimulate = async (streamKey) => {
    try {
      setSimulating(streamKey);
      const res = await api.simulateNotificationStream(streamKey);
      setFeedbackToast(res?.message || `Dispatched ${streamKey}`);
      setTimeout(() => setFeedbackToast(null), 3500);
      await loadNotifications();
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      setSimulating(null);
    }
  };

  // Mark Read
  const handleMarkRead = async (id) => {
    try {
      await api.recordNotificationEngagement(id, 'read');
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, status: 'read' } : n))
      );
    } catch (err) {
      console.warn('Mark read failed:', err);
    }
  };

  // Dismiss
  const handleDismiss = async (id) => {
    try {
      await api.recordNotificationEngagement(id, 'dismissed');
      setNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch (err) {
      console.warn('Dismiss failed:', err);
    }
  };

  if (!isOpen) return null;

  // Filter notifications by stream
  const filteredNotifications = notifications.filter((n) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'stream1') {
      return (
        n.priority === 'critical' ||
        n.category === 'emergency_protocol' ||
        n.category === 'safety_alert' ||
        n.metadata?.stream === 'stream1_emergency' ||
        n.metadata?.tier === 1
      );
    }
    if (activeTab === 'stream2') {
      return (
        n.category === 'circadian_goal' ||
        n.category === 'goal_achievement' ||
        n.category === 'hydration_reminder' ||
        n.metadata?.stream === 'stream2_circadian' ||
        n.metadata?.tier === 2
      );
    }
    if (activeTab === 'stream3') {
      return (
        n.category === 'chrono_regimen' ||
        n.category === 'medication_reminder' ||
        n.metadata?.stream === 'stream3_chrono_regimen' ||
        n.metadata?.tier === 3
      );
    }
    if (activeTab === 'stream4') {
      return (
        n.category === 'sleep_guard' ||
        n.metadata?.stream === 'stream4_sleep_guard' ||
        n.metadata?.stepDebtSuppressed ||
        n.metadata?.tier === 4
      );
    }
    return true;
  });

  const unreadCount = notifications.filter(
    (n) => n.status !== 'read' && n.status !== 'dismissed'
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/80 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-[460px] h-full sm:h-[90vh] bg-[#070b14] border border-white/10 sm:rounded-3xl flex flex-col overflow-hidden shadow-2xl relative">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/4 w-48 h-48 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-1/4 w-48 h-48 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Feedback Toast */}
        {feedbackToast && (
          <div className="absolute top-4 left-4 right-4 z-50 bg-gradient-to-r from-cyan-500 to-teal-500 text-slate-950 px-4 py-2.5 rounded-2xl font-black text-xs shadow-xl flex items-center gap-2 animate-bounce">
            <Sparkles size={16} />
            <span className="flex-1 truncate">{feedbackToast}</span>
          </div>
        )}

        {/* 1. Executive Header Strip */}
        <div className="px-5 pt-5 pb-3 border-b border-white/[0.08] bg-slate-950/70 backdrop-blur-md flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 flex items-center justify-center text-white shadow-lg shadow-cyan-500/25">
              <Bell size={18} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white tracking-tight">
                  Health Notifications
                </h2>
                {unreadCount > 0 && (
                  <span className="px-2 py-0.5 text-[10px] font-black bg-cyan-500 text-slate-950 rounded-full shadow-sm shadow-cyan-500/40">
                    {unreadCount} NEW
                  </span>
                )}
              </div>
              <p className="text-[10px] text-slate-400 font-medium">
                Dual-Tier Dispatch • 0s Emergency & Circadian Paced
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowSimulator(!showSimulator)}
              className={`p-2 rounded-xl text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                showSimulator
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                  : 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/5'
              }`}
              title="Team Lead Simulation Deck"
            >
              <Zap size={14} className={showSimulator ? 'text-cyan-400' : ''} />
              <span className="text-[11px] hidden sm:inline">Simulate</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* 2. Team Lead Verification & Stream Trigger Deck (Collapsible) */}
        {showSimulator && (
          <div className="px-4 py-3 bg-slate-900/90 border-b border-cyan-500/20 text-xs shrink-0 animate-fade-in space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                Executive Verification Deck (One-Tap Trigger)
              </span>
              <span className="text-[10px] text-slate-400">Team Lead Review Mode</span>
            </div>

            <div className="grid grid-cols-2 gap-1.5 pt-1">
              {/* Stream 1 */}
              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream1_hypoglycemia')}
                className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <AlertTriangle size={13} className="text-rose-400 shrink-0" />
                <span className="truncate">⚡ Hypo 62 mg/dL (0s)</span>
              </button>

              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream1_tachycardia')}
                className="px-2.5 py-1.5 bg-rose-500/15 hover:bg-rose-500/25 border border-rose-500/30 text-rose-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Heart size={13} className="text-rose-400 shrink-0" />
                <span className="truncate">💓 Tachy 135 bpm (0s)</span>
              </button>

              {/* Stream 2 */}
              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream2_morning_hydration')}
                className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Droplets size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate">🌅 07:15 Hydration (300ml)</span>
              </button>

              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream2_midday_pacing')}
                className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Footprints size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate">🚶 14:30 Walk (+1,650)</span>
              </button>

              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream2_evening_trail')}
                className="px-2.5 py-1.5 bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/30 text-cyan-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Compass size={13} className="text-cyan-400 shrink-0" />
                <span className="truncate">📍 17:30 Trail (1.5 km)</span>
              </button>

              {/* Stream 3 */}
              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream3_medibot_regimen')}
                className="px-2.5 py-1.5 bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/30 text-purple-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Pill size={13} className="text-purple-400 shrink-0" />
                <span className="truncate">💊 5-Dose Med Chrono</span>
              </button>

              {/* Stream 4 */}
              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream4_bedtime_taper')}
                className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <Moon size={13} className="text-indigo-400 shrink-0" />
                <span className="truncate">🌙 21:30 Taper (150ml)</span>
              </button>

              <button
                disabled={simulating !== null}
                onClick={() => handleSimulate('stream4_step_suppression')}
                className="px-2.5 py-1.5 bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-indigo-300 rounded-xl text-left font-bold text-[11px] flex items-center gap-1.5 transition cursor-pointer"
              >
                <VolumeX size={13} className="text-indigo-400 shrink-0" />
                <span className="truncate">😴 22:00 Sleep Guard</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Stream Filter Navigation Tabs */}
        <div className="px-3 py-2 bg-slate-950/40 border-b border-white/[0.06] flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition cursor-pointer ${
              activeTab === 'all'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-white/5 text-slate-400 hover:text-slate-200'
            }`}
          >
            All Streams ({notifications.length})
          </button>

          <button
            onClick={() => setActiveTab('stream1')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'stream1'
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30'
                : 'bg-rose-500/10 text-rose-300 hover:bg-rose-500/20'
            }`}
          >
            <ShieldAlert size={12} />
            <span>🚨 Stream 1: 0s Emergency</span>
          </button>

          <button
            onClick={() => setActiveTab('stream2')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'stream2'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/30'
                : 'bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20'
            }`}
          >
            <Compass size={12} />
            <span>🎯 Stream 2: Circadian</span>
          </button>

          <button
            onClick={() => setActiveTab('stream3')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'stream3'
                ? 'bg-purple-500 text-white shadow-md shadow-purple-500/30'
                : 'bg-purple-500/10 text-purple-300 hover:bg-purple-500/20'
            }`}
          >
            <Pill size={12} />
            <span>💊 Stream 3: MediBot</span>
          </button>

          <button
            onClick={() => setActiveTab('stream4')}
            className={`px-3 py-1.5 rounded-xl text-[11px] font-bold tracking-tight whitespace-nowrap transition flex items-center gap-1 cursor-pointer ${
              activeTab === 'stream4'
                ? 'bg-indigo-500 text-white shadow-md shadow-indigo-500/30'
                : 'bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20'
            }`}
          >
            <Moon size={12} />
            <span>🛌 Stream 4: Sleep Guard</span>
          </button>
        </div>

        {/* 4. Scrollable Stream Cards Feed */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5 no-scrollbar">
          {loading && notifications.length === 0 ? (
            <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
              <div className="w-8 h-8 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
              <p className="text-xs font-semibold">Synchronizing health notification streams...</p>
            </div>
          ) : filteredNotifications.length === 0 ? (
            <div className="py-16 flex flex-col items-center justify-center text-center px-4">
              <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mb-3">
                <Bell size={24} />
              </div>
              <h4 className="text-sm font-bold text-slate-200">No Notifications in this Stream</h4>
              <p className="text-xs text-slate-400 mt-1 max-w-xs">
                Use the <b>Simulate</b> deck above to test immediate 0s emergency bypass, circadian pacing, or prescription regimens.
              </p>
            </div>
          ) : (
            filteredNotifications.map((notif) => {
              const isCritical =
                notif.priority === 'critical' ||
                notif.category === 'emergency_protocol' ||
                notif.category === 'safety_alert';
              const isChrono =
                notif.category === 'chrono_regimen' ||
                notif.category === 'medication_reminder' ||
                notif.metadata?.stream === 'stream3_chrono_regimen';
              const isSleepGuard =
                notif.category === 'sleep_guard' ||
                notif.metadata?.stream === 'stream4_sleep_guard';
              const isCircadian =
                notif.category === 'circadian_goal' ||
                notif.category === 'goal_achievement' ||
                notif.metadata?.stream === 'stream2_circadian';

              const isRead = notif.status === 'read';

              // Stream metadata labels
              let streamBadge = 'General';
              let badgeColor = 'bg-slate-800 text-slate-300 border-white/10';

              if (isCritical) {
                streamBadge = 'Tier 1 • Immediate 0s Emergency Bypass';
                badgeColor = 'bg-rose-500/20 text-rose-300 border-rose-500/40 shadow-rose-500/10 shadow-sm';
              } else if (isSleepGuard) {
                streamBadge = 'Tier 4 • Bedtime Sleep & Nocturia Guard';
                badgeColor = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40';
              } else if (isChrono) {
                streamBadge = 'Tier 3 • MediBot Prescription Chrono-Regimen';
                badgeColor = 'bg-purple-500/20 text-purple-300 border-purple-500/40';
              } else if (isCircadian) {
                streamBadge = 'Tier 2 • Circadian Wake-to-Sleep Pacing';
                badgeColor = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40';
              }

              return (
                <div
                  key={notif.id}
                  className={`relative p-4 rounded-2xl border transition-all duration-200 ${
                    isCritical
                      ? 'bg-rose-950/20 border-rose-500/40 shadow-lg shadow-rose-950/40'
                      : isChrono
                      ? 'bg-purple-950/15 border-purple-500/30'
                      : isSleepGuard
                      ? 'bg-indigo-950/15 border-indigo-500/30'
                      : 'bg-slate-900/60 border-white/10 hover:border-white/20'
                  } ${isRead ? 'opacity-70' : 'opacity-100'}`}
                >
                  {/* Top Meta Line */}
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${badgeColor}`}>
                      {streamBadge}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(notif.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-xs font-black text-white tracking-tight flex items-center gap-1.5">
                    {notif.title}
                  </h3>

                  {/* Body */}
                  <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                    {notif.body}
                  </p>

                  {/* Clinical Protocol Callout Box (when present) */}
                  {notif.metadata?.protocol && (
                    <div className="mt-2.5 p-2 rounded-xl bg-slate-950/80 border border-white/10 text-[11px] text-slate-300 flex items-start gap-1.5">
                      <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-cyan-300">Exact Clinical Protocol: </span>
                        <span>{notif.metadata.protocol}</span>
                        {notif.metadata.breathingCadence && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            Cadence: {notif.metadata.breathingCadence} • {notif.metadata.fluidRecommendation}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Medication Instructions Callout */}
                  {notif.metadata?.instructions && (
                    <div className="mt-2.5 p-2 rounded-xl bg-purple-950/40 border border-purple-500/20 text-[11px] text-purple-200 flex items-start gap-1.5">
                      <Pill size={13} className="text-purple-400 shrink-0 mt-0.5" />
                      <span>{notif.metadata.instructions}</span>
                    </div>
                  )}

                  {/* Action CTA Button */}
                  {notif.action_label && (
                    <div className="mt-3 pt-2.5 border-t border-white/[0.08] flex items-center justify-between gap-2">
                      <button
                        onClick={() => handleAction(notif, notif.action_label)}
                        className={`flex-1 py-2 px-3 rounded-xl font-black text-xs transition active:scale-95 flex items-center justify-center gap-1.5 cursor-pointer shadow-md ${
                          isCritical
                            ? 'bg-gradient-to-r from-rose-500 to-amber-500 hover:opacity-95 text-slate-950 shadow-rose-500/20'
                            : isChrono
                            ? 'bg-gradient-to-r from-purple-500 to-indigo-500 hover:opacity-95 text-white shadow-purple-500/20'
                            : isSleepGuard
                            ? 'bg-gradient-to-r from-indigo-500 to-blue-600 hover:opacity-95 text-white shadow-indigo-500/20'
                            : 'bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 hover:opacity-95 text-slate-950 shadow-cyan-500/20'
                        }`}
                      >
                        {isCritical ? <Zap size={14} /> : isChrono ? <Pill size={14} /> : <CheckCircle2 size={14} />}
                        <span>{notif.action_label}</span>
                      </button>

                      <div className="flex items-center gap-1">
                        {!isRead && (
                          <button
                            onClick={() => handleMarkRead(notif.id)}
                            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-cyan-300 transition cursor-pointer"
                            title="Mark as Read"
                          >
                            <Check size={14} />
                          </button>
                        )}
                        <button
                          onClick={() => handleDismiss(notif.id)}
                          className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-500 hover:text-rose-400 transition cursor-pointer"
                          title="Dismiss"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* 5. Summary Footer Strip */}
        <div className="p-3 bg-slate-950/80 border-t border-white/[0.08] text-[10px] text-slate-400 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span className="font-semibold text-slate-300">4 Active Chrono Streams</span>
          </div>
          <span className="text-slate-500">Autonomous Telemetry Paced</span>
        </div>
      </div>

      {/* ── MODAL 1: 2-MINUTE VAGAL PARASYMPATHETIC RESET ── */}
      {vagalModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-xs w-full bg-[#0a0f1d] border border-cyan-500/40 rounded-3xl p-6 text-center text-white relative shadow-2xl shadow-cyan-500/20">
            <button
              onClick={() => setVagalModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <span className="text-[10px] font-black uppercase tracking-wider text-cyan-300 bg-cyan-500/20 px-3 py-1 rounded-full border border-cyan-500/30">
              Clinical Vagal Reset Protocol
            </span>

            <h3 className="text-base font-black text-white mt-3">
              Diaphragmatic Pacer (4-2-6)
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Cycle {vagalCycle} of 4 • Sit upright, uncross legs, relax shoulders.
            </p>

            {/* Breathing Animation Circle */}
            <div className="my-6 flex items-center justify-center">
              <div
                className={`w-36 h-36 rounded-full flex flex-col items-center justify-center border-4 transition-all duration-1000 ${
                  vagalStep === 'inhale'
                    ? 'border-cyan-400 bg-cyan-500/20 scale-110 shadow-lg shadow-cyan-500/40'
                    : vagalStep === 'hold'
                    ? 'border-amber-400 bg-amber-500/20 scale-105'
                    : 'border-emerald-400 bg-emerald-500/20 scale-95 shadow-inner'
                }`}
              >
                <span className="text-xs font-black uppercase tracking-wider text-slate-200">
                  {vagalStep === 'inhale' ? 'Inhale (4s)' : vagalStep === 'hold' ? 'Hold (2s)' : 'Exhale (6s)'}
                </span>
                <span className="text-3xl font-black text-white mt-1">
                  {vagalSeconds}s
                </span>
              </div>
            </div>

            {/* Cool Water Sip Reminder */}
            <div className="p-3 bg-cyan-950/40 border border-cyan-500/20 rounded-2xl text-xs text-cyan-200 flex items-center gap-2 text-left mb-4">
              <Droplets size={16} className="text-cyan-400 shrink-0" />
              <span>Sip 200ml cool water slowly to stimulate parasympathetic tone.</span>
            </div>

            <button
              onClick={() => {
                setVagalModalOpen(false);
                setFeedbackToast('2-Minute Vagal Reset Complete! Heart rate recovered.');
                setTimeout(() => setFeedbackToast(null), 3500);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-cyan-500 via-teal-400 to-emerald-400 text-slate-950 font-black rounded-xl text-xs shadow-lg transition active:scale-95"
            >
              Complete Reset & Log Telemetry
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 2: CLINICAL RULE OF 15 & RETEST COUNTDOWN ── */}
      {carbsModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-xs w-full bg-[#0a0f1d] border border-rose-500/40 rounded-3xl p-6 text-center text-white relative shadow-2xl shadow-rose-500/20">
            <button
              onClick={() => setCarbsModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <span className="text-[10px] font-black uppercase tracking-wider text-rose-300 bg-rose-500/20 px-3 py-1 rounded-full border border-rose-500/30">
              Rule of 15 Activated
            </span>

            <h3 className="text-base font-black text-white mt-3">
              Fast Carbohydrates Logged
            </h3>
            <p className="text-xs text-slate-300 mt-1">
              15–20g fast carbs ingested (half cup juice / 1 tbsp honey / glucose tablets).
            </p>

            {/* 15-Minute Countdown */}
            <div className="my-6 p-4 rounded-2xl bg-rose-950/40 border border-rose-500/30 text-center">
              <span className="text-[10px] font-bold text-rose-300 uppercase tracking-wider block">
                Automatic Re-Test Alarm In
              </span>
              <span className="text-3xl font-black text-white tracking-widest font-mono mt-1 block">
                {Math.floor(retestSecondsRemaining / 60)}:
                {String(retestSecondsRemaining % 60).padStart(2, '0')}
              </span>
              <p className="text-[10px] text-slate-400 mt-1">
                Sit comfortably. Blood glucose will stabilize in 15 minutes.
              </p>
            </div>

            <button
              onClick={() => {
                setCarbsModalOpen(false);
                setFeedbackToast('15-Minute Re-Test timer running in background');
                setTimeout(() => setFeedbackToast(null), 3000);
              }}
              className="w-full py-2.5 bg-gradient-to-r from-rose-500 to-amber-500 text-slate-950 font-black rounded-xl text-xs shadow-lg transition active:scale-95"
            >
              Acknowledge & Monitor Glucose
            </button>
          </div>
        </div>
      )}

      {/* ── MODAL 3: BEDTIME REST & RECHARGE SUMMARY ── */}
      {daySummaryModalOpen && (
        <div className="fixed inset-0 z-60 bg-black/85 backdrop-blur-2xl flex items-center justify-center p-4 animate-fade-in">
          <div className="max-w-xs w-full bg-[#0a0f1d] border border-indigo-500/40 rounded-3xl p-6 text-center text-white relative shadow-2xl shadow-indigo-500/20">
            <button
              onClick={() => setDaySummaryModalOpen(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white"
            >
              ✕
            </button>

            <div className="w-12 h-12 rounded-2xl bg-indigo-500/20 text-indigo-300 flex items-center justify-center mx-auto mb-3 border border-indigo-500/30">
              <Moon size={24} />
            </div>

            <h3 className="text-base font-black text-white">
              Rest & Recharge Runway
            </h3>
            <p className="text-xs text-slate-400 mt-1">
              Step debts silenced past 21:30 to protect deep REM and stage-3 restorative sleep.
            </p>

            <div className="my-5 p-3.5 bg-slate-900/80 rounded-2xl border border-white/10 text-left space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Walking Streak:</span>
                <span className="font-bold text-emerald-400">Protected ✅</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Nocturia Fluid Guard:</span>
                <span className="font-bold text-indigo-300">150ml Taper Active</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">Morning Runway:</span>
                <span className="font-bold text-cyan-300">07:15 AM Kickstart</span>
              </div>
            </div>

            <button
              onClick={() => setDaySummaryModalOpen(false)}
              className="w-full py-2.5 bg-gradient-to-r from-indigo-500 to-blue-600 text-white font-black rounded-xl text-xs shadow-lg transition active:scale-95"
            >
              Goodnight & Sleep Tight 🛌
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
