import React, { useState, useEffect } from 'react';
import {
  AlertTriangle,
  Heart,
  Droplets,
  Footprints,
  Pill,
  Moon,
  Sparkles,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';

export function HeadsUpNotificationBanner({ onOpenNotificationCenter, onActionClick }) {
  const [currentNotif, setCurrentNotif] = useState(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleNewNotif = (e) => {
      const notif = e?.detail;
      if (!notif) return;

      setCurrentNotif(notif);
      setVisible(true);

      // Also dispatch native Android notification over WebView bridge
      if (typeof window !== 'undefined' && window.ReactNativeWebView) {
        try {
          window.ReactNativeWebView.postMessage(
            JSON.stringify({
              type: 'POP_NATIVE_NOTIFICATION',
              payload: {
                title: notif.title,
                body: notif.body,
                priority: notif.priority,
                category: notif.category,
                data: notif,
              },
            })
          );
        } catch {}
      }

      // Auto dismiss normal alerts after 7 seconds, keep critical emergency alerts until acted on
      if (notif.priority !== 'critical') {
        const timer = setTimeout(() => {
          setVisible(false);
        }, 7000);
        return () => clearTimeout(timer);
      }
    };

    const handleNativeTap = (e) => {
      if (typeof onOpenNotificationCenter === 'function') {
        onOpenNotificationCenter();
      }
    };

    window.addEventListener('newLiveNotification', handleNewNotif);
    window.addEventListener('nativeNotificationTap', handleNativeTap);

    return () => {
      window.removeEventListener('newLiveNotification', handleNewNotif);
      window.removeEventListener('nativeNotificationTap', handleNativeTap);
    };
  }, [onOpenNotificationCenter]);

  if (!visible || !currentNotif) return null;

  const isCritical = currentNotif.priority === 'critical' || currentNotif.category === 'emergency_protocol';
  const isMedibot = currentNotif.category === 'chrono_regimen' || currentNotif.category === 'medication_reminder';
  const isSleep = currentNotif.category === 'sleep_guard';

  // Category Icon & Color Theme
  let borderClass = 'border-cyan-500/40 shadow-cyan-950/60';
  let badgeBg = 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30';
  let pulseColor = 'bg-cyan-400';
  let Icon = Footprints;

  if (isCritical) {
    borderClass = 'border-rose-500/60 shadow-rose-950/80 animate-pulse';
    badgeBg = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    pulseColor = 'bg-rose-400';
    Icon = AlertTriangle;
  } else if (isMedibot) {
    borderClass = 'border-purple-500/40 shadow-purple-950/60';
    badgeBg = 'bg-purple-500/20 text-purple-300 border-purple-500/30';
    pulseColor = 'bg-purple-400';
    Icon = Pill;
  } else if (isSleep) {
    borderClass = 'border-indigo-500/40 shadow-indigo-950/60';
    badgeBg = 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    pulseColor = 'bg-indigo-400';
    Icon = Moon;
  }

  return (
    <div className="fixed top-2 left-3 right-3 z-50 max-w-[440px] mx-auto animate-in slide-in-from-top-6 duration-300 ease-out">
      <div
        className={`relative overflow-hidden bg-[#070b14]/95 backdrop-blur-2xl border ${borderClass} rounded-2xl p-3 shadow-2xl transition-all cursor-pointer`}
        onClick={() => {
          if (typeof onOpenNotificationCenter === 'function') onOpenNotificationCenter();
        }}
      >
        {/* Glow ambient background */}
        <div
          className={`absolute -top-10 -right-10 w-32 h-32 rounded-full blur-2xl pointer-events-none opacity-30 ${
            isCritical ? 'bg-rose-500' : isMedibot ? 'bg-purple-500' : 'bg-cyan-500'
          }`}
        />

        {/* Top Header Row */}
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="relative flex h-2 w-2 shrink-0">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`} />
              <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`} />
            </span>
            <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeBg}`}>
              {isCritical ? '0s Urgent Alert' : isMedibot ? 'MediBot Regimen' : isSleep ? 'Sleep Guard' : 'Live Pacing'}
            </span>
            <span className="text-[10px] text-slate-400 font-semibold truncate">
              Just Now • Fitsure Live
            </span>
          </div>

          <button
            onClick={(e) => {
              e.stopPropagation();
              setVisible(false);
            }}
            className="p-1 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition shrink-0"
          >
            <X size={14} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex items-start gap-2.5">
          <div
            className={`p-2 rounded-xl shrink-0 mt-0.5 ${
              isCritical
                ? 'bg-rose-500/20 text-rose-400'
                : isMedibot
                ? 'bg-purple-500/20 text-purple-400'
                : 'bg-cyan-500/20 text-cyan-400'
            }`}
          >
            <Icon size={18} />
          </div>

          <div className="flex-1 min-w-0">
            <h4 className="text-xs font-black text-white leading-tight truncate">
              {currentNotif.title}
            </h4>
            <p className="text-[11px] text-slate-300 line-clamp-2 mt-0.5 leading-relaxed font-medium">
              {currentNotif.body}
            </p>

            {/* Action Button */}
            {currentNotif.actionLabel && (
              <div className="mt-2 flex items-center gap-2">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (typeof onActionClick === 'function') {
                      onActionClick(currentNotif, currentNotif.actionLabel);
                    }
                    setVisible(false);
                  }}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black tracking-wide uppercase shadow-md transition flex items-center gap-1 cursor-pointer ${
                    isCritical
                      ? 'bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/40'
                      : 'bg-cyan-500 hover:bg-cyan-400 text-slate-950 shadow-cyan-500/30'
                  }`}
                >
                  <span>{currentNotif.actionLabel}</span>
                  <ChevronRight size={11} />
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

