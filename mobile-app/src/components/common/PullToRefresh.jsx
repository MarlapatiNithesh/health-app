import React, { useState, useRef, useEffect, useCallback } from 'react';
import { RefreshCw, ArrowDown, Check, Smartphone, Sparkles } from 'lucide-react';
import { toNative, isNative } from '../../native/nativeBridge';

/**
 * PullToRefresh - Smooth native-style drag-down sync component.
 * Mimics Google Health Connect / Apple HealthKit pull-to-refresh.
 * Supports both touch (mobile devices / WebView) and mouse drag (desktop preview).
 */
export function PullToRefresh({
  onRefresh,
  children,
  pullThreshold = 65,
  maxPull = 110,
  providerName = 'Google Health Connect',
  isAndroid = true,
  className = '',
}) {
  const containerRef = useRef(null);
  const [pullDistance, setPullDistance] = useState(0);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);

  const startYRef = useRef(0);
  const isDraggingRef = useRef(false);
  const canPullRef = useRef(false);

  // Check if scroll container or any parent scroll container is at top
  const isAtTop = () => {
    if (!containerRef.current) return true;
    if (containerRef.current.scrollTop > 1) return false;
    let p = containerRef.current.parentElement;
    while (p) {
      if (p.scrollTop > 1) return false;
      p = p.parentElement;
    }
    return true;
  };

  const handleStart = (clientY) => {
    if (isRefreshing) return;
    if (isAtTop()) {
      startYRef.current = clientY;
      isDraggingRef.current = true;
      canPullRef.current = true;
    } else {
      canPullRef.current = false;
    }
  };

  const handleMove = (clientY) => {
    if (!isDraggingRef.current || !canPullRef.current || isRefreshing) return;
    const diff = clientY - startYRef.current;
    if (diff > 0 && isAtTop()) {
      // Apply rubber-band damping
      const damped = Math.min(maxPull, Math.pow(diff, 0.82) * 1.8);
      setPullDistance(damped);
    } else {
      setPullDistance(0);
      isDraggingRef.current = false;
    }
  };

  const triggerRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setPullDistance(56); // Hold at indicator height

    // 1. Tell native Expo shell to sync health store
    try {
      toNative('PULL_DOWN_SYNC');
    } catch (e) {
      console.warn('[PullToRefresh] toNative error:', e);
    }

    // 2. Trigger parent callback (e.g. backend daily summary re-fetch)
    try {
      if (typeof onRefresh === 'function') {
        await onRefresh();
      }
    } catch (err) {
      console.warn('[PullToRefresh] onRefresh error:', err);
    }

    // 3. Vibration feedback if available
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(25);
      }
    } catch {}

    // 4. Show success state briefly
    setIsRefreshing(false);
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setPullDistance(0);
    }, 1200);
  }, [onRefresh]);

  const handleEnd = () => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    canPullRef.current = false;

    if (pullDistance >= pullThreshold && !isRefreshing) {
      triggerRefresh();
    } else {
      setPullDistance(0);
    }
  };

  // Touch event handlers
  const onTouchStart = (e) => {
    if (e.touches?.length === 1) {
      handleStart(e.touches[0].clientY);
    }
  };

  const onTouchMove = (e) => {
    if (e.touches?.length === 1) {
      handleMove(e.touches[0].clientY);
      // Prevent native rubber banding when pulling down from top
      if (pullDistance > 5 && isAtTop()) {
        if (e.cancelable) e.preventDefault();
      }
    }
  };

  const onTouchEnd = () => {
    handleEnd();
  };

  // Mouse drag handlers for desktop simulator
  const onMouseDown = (e) => {
    if (e.button === 0) {
      handleStart(e.clientY);
    }
  };

  const onMouseMove = (e) => {
    if (isDraggingRef.current) {
      handleMove(e.clientY);
    }
  };

  const onMouseUp = () => {
    if (isDraggingRef.current) {
      handleEnd();
    }
  };

  const progress = Math.min(1, pullDistance / pullThreshold);
  const isTriggerReady = pullDistance >= pullThreshold;

  return (
    <div
      ref={containerRef}
      className={`relative select-none ${className}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Pull down indicator banner */}
      <div
        className="w-full flex items-center justify-center overflow-hidden transition-all duration-150"
        style={{
          height: `${pullDistance}px`,
          opacity: pullDistance > 8 ? 1 : 0,
        }}
      >
        <div className="flex items-center gap-2.5 px-4 py-1.5 rounded-full bg-slate-900/90 text-white border border-slate-700/80 shadow-lg text-xs font-semibold backdrop-blur-md">
          {isRefreshing ? (
            <>
              <RefreshCw size={14} className="text-[#00A8D0] animate-spin shrink-0" />
              <span className="text-slate-200 text-[11px]">
                Syncing <strong className="text-[#00A8D0] font-bold">{providerName}</strong> in real-time…
              </span>
            </>
          ) : showSuccess ? (
            <>
              <div className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
                <Check size={11} className="text-white stroke-[3]" />
              </div>
              <span className="text-emerald-300 text-[11px] font-bold">
                {providerName} Synced!
              </span>
            </>
          ) : (
            <>
              <div
                className="w-4 h-4 flex items-center justify-center transition-transform duration-150 shrink-0"
                style={{
                  transform: `rotate(${progress * 180}deg)`,
                  color: isTriggerReady ? '#00A8D0' : '#94A3B8',
                }}
              >
                <ArrowDown size={14} />
              </div>
              <span className="text-slate-300 text-[11px]">
                {isTriggerReady ? (
                  <span className="text-[#00A8D0] font-bold">
                    Release to sync {isAndroid ? 'Google Health' : 'Apple Health'}
                  </span>
                ) : (
                  <span>
                    Drag down to sync {isAndroid ? 'Google Health' : 'Apple Health'}
                  </span>
                )}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Screen Content */}
      <div
        className="transition-transform duration-150"
        style={{
          transform: isDraggingRef.current ? `translateY(${Math.min(15, pullDistance * 0.15)}px)` : 'none',
        }}
      >
        {children}
      </div>
    </div>
  );
}
