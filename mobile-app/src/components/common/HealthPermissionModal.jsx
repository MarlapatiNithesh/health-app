import React from 'react';
import { Activity, Heart, Moon, Flame, Droplet, ShieldCheck, Settings, X, CheckCircle2, AlertTriangle } from 'lucide-react';

const METRIC_ICONS = {
  steps: Activity,
  heart_rate: Heart,
  sleep: Moon,
  spo2: Droplet,
  calories: Flame,
  glucose: Droplet,
};

const METRIC_COLORS = {
  steps: 'from-emerald-500/20 to-teal-500/20 text-emerald-400 border-emerald-500/30',
  heart_rate: 'from-rose-500/20 to-red-500/20 text-rose-400 border-rose-500/30',
  sleep: 'from-indigo-500/20 to-purple-500/20 text-indigo-400 border-indigo-500/30',
  spo2: 'from-cyan-500/20 to-blue-500/20 text-cyan-400 border-cyan-500/30',
  calories: 'from-amber-500/20 to-orange-500/20 text-amber-400 border-amber-500/30',
  glucose: 'from-fuchsia-500/20 to-pink-500/20 text-fuchsia-400 border-fuchsia-500/30',
};

/**
 * HealthPermissionModal:
 * Implements the explain-before-asking and show-denied user interfaces
 * required by the healthCapture pipeline.
 */
export default function HealthPermissionModal({
  isOpen,
  mode = 'explain', // 'explain' | 'denied'
  metrics = [],
  missing = [],
  onConfirm,
  onCancel,
}) {
  if (!isOpen) return null;

  const isExplain = mode === 'explain';
  const displayMetrics = isExplain ? metrics : missing;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-lg bg-gradient-to-b from-slate-900 to-slate-950 border border-slate-800 rounded-3xl p-6 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Glow ambient background */}
        <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-48 h-48 bg-teal-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800/80">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isExplain
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
            }`}>
              {isExplain ? <ShieldCheck className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
            </div>
            <div>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {isExplain ? 'Health & Activity Access' : 'Permissions Incomplete'}
              </h3>
              <p className="text-xs text-slate-400">
                {isExplain ? 'Explain before asking · Original data pipeline' : 'Action needed to enable all features'}
              </p>
            </div>
          </div>
          <button
            onClick={onCancel}
            className="p-2 text-slate-400 hover:text-white rounded-xl hover:bg-slate-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Explanation text */}
        <div className="pt-4 pb-2">
          {isExplain ? (
            <p className="text-sm text-slate-300 leading-relaxed">
              To track your daily goals and stream live metrics from your smartwatch, we ask for access to the following metrics.
              <strong className="text-white block mt-1 font-medium">Here is what we ask for, and why:</strong>
            </p>
          ) : (
            <p className="text-sm text-amber-300/90 leading-relaxed bg-amber-500/10 p-3 rounded-2xl border border-amber-500/20">
              Without access to the metrics below, your live dial updates, activity counters, and health metrics won&apos;t reflect your real data.
            </p>
          )}
        </div>

        {/* Scrollable Metric List */}
        <div className="flex-1 overflow-y-auto my-3 pr-1 space-y-2.5 custom-scrollbar">
          {displayMetrics.map((item) => {
            const Icon = METRIC_ICONS[item.key] || Activity;
            const colorClass = METRIC_COLORS[item.key] || 'from-slate-800 to-slate-900 text-slate-300 border-slate-700';

            return (
              <div
                key={item.key}
                className="p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800/80 hover:border-slate-700 transition-all flex items-start gap-3.5"
              >
                <div className={`p-2.5 rounded-xl bg-gradient-to-br border shrink-0 ${colorClass}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-white tracking-tight">
                      {item.label}
                    </span>
                    {item.unit && (
                      <span className="text-[11px] px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
                        {item.unit}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 mt-1 leading-normal">
                    {item.why || 'Required for health metrics calculation and goal tracking.'}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Privacy Note */}
        {isExplain && (
          <div className="flex items-center gap-2 px-3 py-2 bg-slate-950/60 rounded-xl border border-slate-800/50 text-[11px] text-slate-400">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Only real sensor and watch data is collected. Zero fake or dummy data.</span>
          </div>
        )}

        {/* Action Buttons */}
        <div className="pt-4 mt-2 border-t border-slate-800/80 flex items-center gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 px-4 rounded-xl border border-slate-700 text-slate-300 hover:text-white hover:bg-slate-800 text-sm font-semibold transition-all"
          >
            {isExplain ? 'Not now' : 'Cancel'}
          </button>

          <button
            onClick={onConfirm}
            className={`flex-1 py-3 px-4 rounded-xl text-white text-sm font-semibold shadow-lg transition-all flex items-center justify-center gap-2 ${
              isExplain
                ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 shadow-emerald-500/25'
                : 'bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 shadow-amber-500/25'
            }`}
          >
            {isExplain ? (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Continue to Allow</span>
              </>
            ) : (
              <>
                <Settings className="w-4 h-4" />
                <span>Open Settings</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
