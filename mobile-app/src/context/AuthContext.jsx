import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api';
import { toNative, isNative } from '../native/nativeBridge';
import { getHealthConsentStorageKeys, getHealthMemberId } from '../utils/healthConsent';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem('wellness_token') || '');
  const [member, setMember] = useState(() => {
    try {
      const saved = localStorage.getItem('wellness_member');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [loading, setLoading] = useState(false);
  const [authError, setAuthError] = useState(null);
  
  // App-level gamification & tracker state
  const [livaPoints, setLivaPoints] = useState(() => {
    return parseInt(localStorage.getItem('wellness_points') || '1450', 10);
  });

  const [habits, setHabits] = useState(() => {
    const saved = localStorage.getItem('wellness_habits');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      { id: '1', name: 'Morning Walk', desc: 'Take a 20-minute walk before 9 AM', time: '07:00', category: 'exercise', streak: 12, completed: false, icon: 'walk' },
      { id: '2', name: 'Drink Water', desc: 'Drink at least 8 glasses of water', time: '08:00', category: 'nutrition', streak: 8, completed: false, icon: 'water' },
      { id: '3', name: 'Meditation', desc: '10 minutes of mindful breathing', time: '09:00', category: 'mind', streak: 5, completed: true, icon: 'mind' },
      { id: '4', name: 'Healthy Lunch', desc: 'Include 50% vegetables and lean protein', time: '13:00', category: 'nutrition', streak: 3, completed: false, icon: 'food' },
      { id: '5', name: 'Post-lunch Stretch', desc: '5-minute standing desk mobility', time: '14:30', category: 'exercise', streak: 7, completed: false, icon: 'stretch' },
      { id: '6', name: 'Evening Jog / Steps', desc: 'Hit daily 8,000 steps milestone', time: '18:00', category: 'exercise', streak: 9, completed: false, icon: 'run' },
      { id: '7', name: 'Digital Detox', desc: 'No screens 45 minutes before sleep', time: '22:00', category: 'sleep', streak: 4, completed: false, icon: 'detox' },
      { id: '8', name: 'Sleep by 11 PM', desc: 'Target 7.5 hours of restorative sleep', time: '23:00', category: 'sleep', streak: 11, completed: false, icon: 'sleep' },
    ];
  });

  const [challenges, setChallenges] = useState(() => {
    const saved = localStorage.getItem('wellness_challenges');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'c1',
        title: '10K Steps Challenge',
        program: 'Company Wellness Program',
        status: 'joined',
        description: 'Walk 10,000 steps every day for 30 days. Compete with your colleagues and earn reward points!',
        progress: 52,
        participants: 234,
        daysLeft: 0,
        rewardPoints: 500,
        icon: 'walk',
      },
      {
        id: 'c2',
        title: 'Sleep Well February',
        program: 'Company Wellness Program',
        status: 'joined',
        description: 'Maintain 7+ hours of sleep for 28 nights. Better sleep means better health outcomes!',
        progress: 18,
        participants: 189,
        daysLeft: 0,
        rewardPoints: 350,
        icon: 'sleep',
      },
      {
        id: 'c3',
        title: 'Hydration Hero',
        program: 'Corporate Vitality Initiative',
        status: 'available',
        description: 'Drink 2.5 Liters of water daily for 14 continuous days. Keep your metabolism optimized!',
        progress: 0,
        participants: 156,
        daysLeft: 8,
        rewardPoints: 250,
        icon: 'water',
      },
      {
        id: 'c4',
        title: 'Mindful Workplace Marathon',
        program: 'Stress Reduction Series',
        status: 'available',
        description: 'Log 10 minutes of meditation or breathing exercises 5 days a week.',
        progress: 0,
        participants: 312,
        daysLeft: 12,
        rewardPoints: 350,
        icon: 'mind',
      }
    ];
  });

  const [hydrationGlasses, setHydrationGlasses] = useState(() => {
    return parseInt(localStorage.getItem('wellness_hydration') || '0', 10);
  });

  // Live hardware telemetry from Expo / Phone
  const [nativeTelemetry, setNativeTelemetry] = useState(() => {
    if (typeof window !== 'undefined' && window.__LATEST_HEALTH_TELEMETRY__) {
      const t = window.__LATEST_HEALTH_TELEMETRY__;
      return {
        ...t,
        liveSteps: t.liveSteps || t.today?.steps || 0,
      };
    }
    const isAndroid = typeof navigator !== 'undefined' && /android/i.test(navigator.userAgent || '');
    return {
      batteryLevel: null,
      liveSteps: 0,
      motionIntensity: 0,
      platform: isAndroid ? 'android' : 'ios',
      isNativeExpo: isNative,
      isNativeApp: isNative,
      permissionGranted: null,
    };
  });

  useEffect(() => {
    const handleTelemetry = (data) => {
      if (!data) return;
      window.__LATEST_HEALTH_TELEMETRY__ = data;
      // Support both old shape (liveSteps) and new shape (today.steps)
      const normalizedSteps =
        data.today?.steps != null
          ? data.today.steps
          : data.health?.steps?.today != null
          ? data.health.steps.today
          : typeof data.liveSteps === 'number'
          ? data.liveSteps
          : undefined;
      const normalizedSleep =
        data.today?.sleepMinutes != null
          ? data.today.sleepMinutes
          : data.health?.sleep?.durationMinutes != null
          ? data.health.sleep.durationMinutes
          : undefined;
      setNativeTelemetry((prev) => ({
        ...prev,
        ...data,
        batteryLevel:
          typeof data.batteryLevel === 'number' && data.batteryLevel >= 0
            ? data.batteryLevel
            : typeof data.battery === 'number' && data.battery >= 0
            ? data.battery
            : prev.batteryLevel,
        liveSteps: typeof normalizedSteps === 'number' ? normalizedSteps : prev.liveSteps,
        sleepMinutes: typeof normalizedSleep === 'number' ? normalizedSleep : prev.sleepMinutes,
        platform: data.platform || prev.platform,
        healthSource:
          data.healthSource ||
          data.source?.toUpperCase() ||
          (data.platform === 'ios' ? 'APPLE_HEALTH' : 'HEALTH_CONNECT'),
        healthAvailable: data.status === 'ok' || data.healthAvailable || prev.healthAvailable,
        healthAuthorized: data.status === 'ok' || data.healthAuthorized || prev.healthAuthorized,
        health: data.health || prev.health,
        permissionGranted: data.status !== 'permission_denied' && (data.permissionGranted !== undefined ? data.permissionGranted : prev.permissionGranted),
        isNativeApp: data.isNativeApp || prev.isNativeApp,
        healthStatus: data.status,        // 'ok' | 'permission_denied' | 'no_data' | 'sensor_only'
        healthReason: data.reason,        // Reason string when not ok
        today: data.today || prev.today,  // New shape from healthService
        history: data.history || prev.history,
      }));
    };

    if (typeof window !== 'undefined') {
      window.onNativeHealthTelemetry = handleTelemetry;
      const onCustomTelemetry = (e) => { if (e?.detail) handleTelemetry(e.detail); };
      window.addEventListener('nativeHealthTelemetry', onCustomTelemetry);

      if (window.__LATEST_HEALTH_TELEMETRY__) {
        handleTelemetry(window.__LATEST_HEALTH_TELEMETRY__);
      }

      // Ask the shell to re-send telemetry (works for both old and new shell)
      toNative('REQUEST_NATIVE_TELEMETRY');

      return () => window.removeEventListener('nativeHealthTelemetry', onCustomTelemetry);
    }
  }, []);

  // Restore the web-saved health selection into the native shell on app restart.
  // SecureStore is member-scoped and may be empty after an app reinstall/key migration.
  useEffect(() => {
    if (!isNative || !token || !member) return;
    const memberId = getHealthMemberId(member);
    const storageKeys = getHealthConsentStorageKeys(memberId);
    let selectedPermissions = [
      'steps', 'sleep', 'heart_rate', 'hydration', 'blood_pressure_systolic',
      'blood_pressure_diastolic', 'blood_glucose', 'spo2'
    ];
    try {
      const saved = JSON.parse(localStorage.getItem(storageKeys.selected) || '[]');
      if (Array.isArray(saved) && saved.length > 0) selectedPermissions = saved;
    } catch {}
    toNative('LOGIN_SUCCESS', { token, memberId, permissions: selectedPermissions });
  }, [token, member]);

  const requestHealthPermissions = () => {
    if (typeof window !== 'undefined' && window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_HEALTH_PERMISSIONS' }));
    }
  };

  useEffect(() => {
    localStorage.setItem('wellness_habits', JSON.stringify(habits));
  }, [habits]);

  useEffect(() => {
    localStorage.setItem('wellness_challenges', JSON.stringify(challenges));
  }, [challenges]);

  useEffect(() => {
    localStorage.setItem('wellness_points', String(livaPoints));
  }, [livaPoints]);

  useEffect(() => {
    localStorage.setItem('wellness_hydration', String(hydrationGlasses));
  }, [hydrationGlasses]);

  // Listen for auth expiration or account deletion events from API client
  useEffect(() => {
    const handleAuthExpired = () => {
      logout();
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  // Load user profile if token is present
  useEffect(() => {
    if (token) {
      api.getProfile()
        .then((data) => {
          if (data) {
            setMember(prev => ({ ...(prev || {}), ...data }));
            localStorage.setItem('wellness_member', JSON.stringify(data));
          }
        })
        .catch((err) => {
          console.warn('Failed to refresh profile with existing token:', err.message);
          const lower = String(err.message || '').toLowerCase();
          // If the account was deleted or credentials revoked, purge zombie session immediately
          if (err.status === 401 || err.status === 403 || lower.includes('deleted') || lower.includes('inactive')) {
            logout();
          }
        });
    }
  }, [token]);

  const loginWithToken = async (jwtToken, memberData) => {
    setToken(jwtToken);
    setMember(memberData);
    localStorage.setItem('wellness_token', jwtToken);
    localStorage.setItem('wellness_member', JSON.stringify(memberData));
    setAuthError(null);

    // Health sharing is an explicit, member-scoped choice collected during first sign-in.
    const memberId = getHealthMemberId(memberData);
    const storageKeys = getHealthConsentStorageKeys(memberId);
    let selectedPermissions = [];
    const healthPermissionsConfigured = localStorage.getItem(storageKeys.configured) === 'true';
    if (healthPermissionsConfigured) {
      try {
        const saved = JSON.parse(localStorage.getItem(storageKeys.selected) || '[]');
        if (Array.isArray(saved)) selectedPermissions = saved;
      } catch {}
      await api.recordMemberConsent('health_data', Array.isArray(selectedPermissions) && selectedPermissions.length > 0, '1.0')
        .catch((e) => console.warn('Could not persist the selected health sharing choice:', e.message));
    }

    // Persist the explicit choice before the native shell starts a sync using this session.
    toNative('LOGIN_SUCCESS', {
      token: jwtToken,
      memberId,
      permissions: healthPermissionsConfigured ? selectedPermissions : undefined,
    });

  };

  const logout = () => {
    setToken('');
    setMember(null);
    localStorage.removeItem('wellness_token');
    localStorage.removeItem('wellness_member');
    // Tell the native shell to clear its stored token and health subscriptions
    toNative('LOGOUT');
  };

  const updateMemberProfile = async (updates) => {
    try {
      const updated = await api.updateProfile(updates);
      setMember(prev => {
        const next = { ...prev, ...updated };
        localStorage.setItem('wellness_member', JSON.stringify(next));
        return next;
      });
      return updated;
    } catch (err) {
      throw err;
    }
  };

  const toggleHabit = (id) => {
    setHabits(prev => prev.map(h => {
      if (h.id === id) {
        const nextState = !h.completed;
        if (nextState) {
          setLivaPoints(pts => pts + 25);
        }
        return {
          ...h,
          completed: nextState,
          streak: nextState ? h.streak + 1 : Math.max(0, h.streak - 1),
        };
      }
      return h;
    }));
  };

  const addHabit = (habit) => {
    setHabits(prev => [...prev, { ...habit, id: String(Date.now()), completed: false, streak: 0 }]);
  };

  const joinChallenge = (id) => {
    setChallenges(prev => prev.map(c => {
      if (c.id === id) {
        return { ...c, status: 'joined', participants: c.participants + 1 };
      }
      return c;
    }));
  };

  const logWater = async (delta = 1) => {
    const next = Math.max(0, Math.min(10, hydrationGlasses + delta));
    setHydrationGlasses(next);
    try {
      localStorage.setItem('wellness_hydration', String(next));
    } catch {}
    if (token) {
      try {
        await api.logManualHealthSamples([
          {
            provider: 'manual',
            externalId: `water-${Date.now()}`,
            metric: 'hydration',
            value: 250,
            unit: 'mL',
            recordedAt: new Date().toISOString(),
          }
        ]);
        if (delta > 0) {
          setLivaPoints(p => {
            const nextPts = p + 10;
            try { localStorage.setItem('wellness_points', String(nextPts)); } catch {}
            return nextPts;
          });
        }
      } catch (err) {
        console.warn('Hydration sync warning:', err?.message || err);
      }
    }
  };

  return (
    <AuthContext.Provider
      value={{
        token,
        member,
        loading,
        setLoading,
        authError,
        setAuthError,
        isAuthenticated: !!token,
        loginWithToken,
        logout,
        updateMemberProfile,
        livaPoints,
        setLivaPoints,
        habits,
        toggleHabit,
        addHabit,
        challenges,
        joinChallenge,
        hydrationGlasses,
        setHydrationGlasses,
        logWater,
        nativeTelemetry,
        requestHealthPermissions,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
