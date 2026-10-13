// health/healthService.js
// Single source of truth for health data reading.
// NEVER returns made-up numbers. If data is missing you get null/0 + a reason string.
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

// Try to load the native health module. Throws in Expo Go (no native rebuild).
let HK = null;
try {
  HK = require('@appeeky/expo-healthkit');
} catch (e) {
  HK = null;
}

export const SOURCE = Platform.OS === 'ios' ? 'apple_health' : 'health_connect';
const DAY_MS = 24 * 60 * 60 * 1000;

export const startOfDay = (d = new Date()) => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Health Connect queries use the device's local calendar day. Never derive
// its date key with toISOString(), which can shift the date across time zones.
export const localDateKey = (date = new Date()) => {
  const value = new Date(date);
  const pad = (part) => String(part).padStart(2, '0');
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
};

// ─── Is the health store usable right now? ───────────────────────────────────
export function nativeHealthState() {
  if (!HK) {
    return { ok: false, reason: 'NATIVE_MODULE_MISSING' }; // Expo Go or not rebuilt
  }
  let available = false;
  try {
    available = !!HK.isAvailable();
  } catch (e) {
    available = false;
  }
  if (!available) {
    return {
      ok: false,
      reason: Platform.OS === 'android' ? 'HEALTH_CONNECT_MISSING' : 'HEALTHKIT_UNAVAILABLE',
    };
  }
  return { ok: true };
}

// ─── Types to request permission for ─────────────────────────────────────────
const readTypes = (requested = null) => {
  const map = {
    steps: HK?.QuantityType?.stepCount,
    distance: HK?.QuantityType?.distanceWalkingRunning,
    calories: HK?.QuantityType?.activeEnergyBurned,
    heart_rate: HK?.QuantityType?.heartRate,
    hrv: HK?.QuantityType?.heartRateVariabilitySDNN,
    spo2: HK?.QuantityType?.oxygenSaturation,
    blood_glucose: HK?.QuantityType?.bloodGlucose,
    blood_pressure_systolic: HK?.QuantityType?.bloodPressureSystolic,
    blood_pressure_diastolic: HK?.QuantityType?.bloodPressureDiastolic,
    respiratory_rate: HK?.QuantityType?.respiratoryRate,
    weight: HK?.QuantityType?.bodyMass,
    sleep: HK?.CategoryType?.sleepAnalysis,
  };

  if (Array.isArray(requested) && requested.length > 0) {
    const ids = requested.includes('blood_pressure_systolic')
      ? [...requested, 'blood_pressure_diastolic']
      : requested;
    return [...new Set(ids.map((id) => map[id]).filter(Boolean))];
  }

  return [];
};

// ─── Show the OS permission sheet ────────────────────────────────────────────
export async function requestHealthPermissions(requested = null) {
  const state = nativeHealthState();
  const wantsSteps = Array.isArray(requested) && requested.includes('steps');
  let pedometerGranted = false;
  if (wantsSteps) {
    const permission = await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }));
    pedometerGranted = Boolean(permission?.granted);
  }
  if (!state.ok) {
    return {
      granted: pedometerGranted,
      healthStoreGranted: false,
      pedometerGranted,
      reason: pedometerGranted ? null : state.reason,
    };
  }
  try {
    const toRead = readTypes(requested);
    const authorized = await HK.requestAuthorization({ toRead, toShare: [] });
    return {
      granted: authorized === true || pedometerGranted,
      healthStoreGranted: authorized === true,
      pedometerGranted,
      reason: authorized === true || pedometerGranted ? null : 'PERMISSION_DENIED',
    };
  } catch (error) {
    return {
      granted: pedometerGranted,
      healthStoreGranted: false,
      pedometerGranted,
      reason: pedometerGranted ? null : 'PERMISSION_ERROR',
      message: error?.message,
    };
  }
}

// Re-read health data as soon as the OS reports a change, with the app's
// foreground refresh as a fallback for stores that do not emit observers.
export async function observeHealthUpdates(onUpdate, requested = null) {
  // Observer queries (HKObserverQuery) are only supported on iOS HealthKit.
  // Android Health Connect does not support observer queries; updates are handled via
  // foreground resume (AppState) and scheduled polling.
  if (Platform.OS !== 'ios') {
    return { remove() {} };
  }
  const state = nativeHealthState();
  if (!state.ok || typeof HK?.addUpdateListener !== 'function') {
    return null;
  }
  try {
    const types = readTypes(requested);
    if (typeof HK.observe === 'function') {
      await HK.observe(types).catch(() => {});
    }
    const subscription = HK.addUpdateListener(() => onUpdate());
    return {
      remove() {
        subscription?.remove?.();
        HK.clearObservers?.().catch?.(() => {});
      },
    };
  } catch (e) {
    return null;
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────────
async function statSum(type, unit, from, to) {
  try {
    const r = await HK.queryStatistics({
      type,
      unit,
      from,
      to,
      options: HK.StatisticsOption.cumulativeSum,
    });
    return r?.sum != null ? Number(r.sum) : null;
  } catch (e) {
    console.log('[Health] stat error', type, e?.message);
    return null;
  }
}

async function quantitySamples(type, unit, from, to, limit, ascending = false) {
  try {
    return (await HK.queryQuantitySamples({ type, unit, from, to, limit, ascending })) || [];
  } catch (e) {
    return [];
  }
}

function calcSleepMinutes(samples = []) {
  if (!Array.isArray(samples) || samples.length === 0) return 0;
  const SV = HK?.SleepAnalysisValue || {};

  // Check if granular sleep stages exist:
  // Android Health Connect: 1 = generic sleeping, 3 = light, 4 = deep, 5 = REM
  // iOS HealthKit: 1 = asleepUnspecified, 3 = asleepCore, 4 = asleepDeep, 5 = asleepREM
  const stageSamples = samples.filter(
    (s) =>
      s.value === 1 ||
      s.value === 3 ||
      s.value === 4 ||
      s.value === 5 ||
      s.value === SV.asleepUnspecified ||
      s.value === SV.asleepCore ||
      s.value === SV.asleepDeep ||
      s.value === SV.asleepREM
  );

  let targetSamples = [];
  if (stageSamples.length > 0) {
    targetSamples = stageSamples;
  } else {
    // If no granular stages exist, count all sessions except awake (value 2 or SV.awake).
    // This includes parent SleepSessionRecord from Health Connect (which has value 0)
    // and standard inBed sessions (value 0).
    targetSamples = samples.filter((s) => s.value !== 2 && s.value !== SV.awake);
  }

  // Deduplicate and merge overlapping intervals so we never double-count
  const intervals = targetSamples
    .map((s) => ({
      start: new Date(s.startDate).getTime(),
      end: new Date(s.endDate).getTime(),
    }))
    .filter((inv) => !isNaN(inv.start) && !isNaN(inv.end) && inv.end > inv.start)
    .sort((a, b) => a.start - b.start);

  if (intervals.length === 0) return 0;

  let totalMs = 0;
  let current = { ...intervals[0] };

  for (let i = 1; i < intervals.length; i++) {
    const next = intervals[i];
    if (next.start <= current.end) {
      current.end = Math.max(current.end, next.end);
    } else {
      totalMs += current.end - current.start;
      current = { ...next };
    }
  }
  totalMs += current.end - current.start;

  return Math.round(totalMs / 60_000);
}

function resolveDeduplicatedCumulativeMetric(samples, fallbackStatSum = null) {
  if (!Array.isArray(samples) || samples.length === 0) {
    return fallbackStatSum != null ? Math.round(fallbackStatSum) : null;
  }

  // 1. Group samples by recording source / data origin
  const sourceGroups = new Map();
  for (const s of samples) {
    const val = Number(s?.value);
    if (!Number.isFinite(val) || val <= 0) continue;
    // Identify source package, app, or device
    const origin = s?.source?.name || s?.source?.bundleIdentifier || s?.metadata?.dataOrigin || s?.metadata?.device || 'default';
    const list = sourceGroups.get(origin) || [];
    list.push(s);
    sourceGroups.set(origin, list);
  }

  if (sourceGroups.size === 0) {
    return fallbackStatSum != null ? Math.round(fallbackStatSum) : null;
  }

  // If there are multiple sources (e.g. Google Fit and Phone Pedometer both recording into Health Connect):
  // Calculate total for each source independently, then pick the BEST reading (Math.max)
  // NEVER sum across different recording apps!
  const sourceTotals = [];
  for (const [, srcSamples] of sourceGroups) {
    const total = srcSamples.reduce((acc, cur) => acc + (Number(cur?.value) || 0), 0);
    if (total > 0) sourceTotals.push(total);
  }

  if (sourceTotals.length > 0) {
    // Choose the most accurate single source reading, never summed
    return Math.round(Math.max(...sourceTotals));
  }

  return fallbackStatSum != null ? Math.round(fallbackStatSum) : null;
}

// ─── Today's readings straight from the health store ─────────────────────────
export async function readToday(requested = []) {
  const selected = new Set(Array.isArray(requested) ? requested : []);
  const includes = (metric) => selected.has(metric)
    || (metric === 'blood_pressure_diastolic' && selected.has('blood_pressure_systolic'));
  if (selected.size === 0) {
    return {
      steps: 0, activeCalories: null, distanceM: null, heartRate: null,
      hrvMs: null, spo2: null, bloodGlucose: null, bloodPressureSystolic: null,
      bloodPressureDiastolic: null, respiratoryRate: null, weightKg: null, sleepMinutes: 0,
    };
  }

  const to = new Date();
  const from = startOfDay();
  const past30DaysFrom = new Date(to.getTime() - 30 * DAY_MS);

  const [
    stepSamples,
    calorieSamples,
    distSamples,
    stepsStatRaw,
    caloriesStatRaw,
    distStatRaw,
    hrSamples,
    weightSamples,
    sleepSamples,
    hrvSamples,
    spo2Samples,
    glucoseSamples,
    systolicSamples,
    diastolicSamples,
    respiratorySamples,
  ] = await Promise.all([
    includes('steps') ? quantitySamples(HK.QuantityType.stepCount, HK.Unit.count, from, to, 500) : [],
    includes('calories') ? quantitySamples(HK.QuantityType.activeEnergyBurned, HK.Unit.kilocalorie, from, to, 500) : [],
    includes('distance') ? quantitySamples(HK.QuantityType.distanceWalkingRunning, HK.Unit.meter, from, to, 500) : [],
    includes('steps') ? statSum(HK.QuantityType.stepCount, HK.Unit.count, from, to) : 0,
    includes('calories') ? statSum(HK.QuantityType.activeEnergyBurned, HK.Unit.kilocalorie, from, to) : null,
    includes('distance') ? statSum(HK.QuantityType.distanceWalkingRunning, HK.Unit.meter, from, to) : null,
    includes('heart_rate') ? quantitySamples(HK.QuantityType.heartRate, HK.Unit.countPerMinute, past30DaysFrom, to, 200) : [],
    includes('weight') ? quantitySamples(HK.QuantityType.bodyMass, HK.Unit.kilogram, new Date(to.getTime() - 365 * DAY_MS), to, 1) : [],
    includes('sleep') ? HK.queryCategorySamples({
      type: HK.CategoryType.sleepAnalysis,
      from: new Date(from.getTime() - 36 * 60 * 60 * 1000), // start from 36 hours ago to cover last night's sleep
      to,
      limit: 500,
      ascending: true,
    }).catch(() => []) : [],
    includes('hrv') ? quantitySamples(HK.QuantityType.heartRateVariabilitySDNN, HK.Unit.second, past30DaysFrom, to, 20) : [],
    includes('spo2') ? quantitySamples(HK.QuantityType.oxygenSaturation, HK.Unit.percent, past30DaysFrom, to, 20) : [],
    includes('blood_glucose') ? quantitySamples(HK.QuantityType.bloodGlucose, HK.Unit.milligramPerDeciliter, past30DaysFrom, to, 20) : [],
    includes('blood_pressure_systolic') ? quantitySamples(HK.QuantityType.bloodPressureSystolic, HK.Unit.millimeterOfMercury, past30DaysFrom, to, 20) : [],
    includes('blood_pressure_diastolic') ? quantitySamples(HK.QuantityType.bloodPressureDiastolic, HK.Unit.millimeterOfMercury, past30DaysFrom, to, 20) : [],
    includes('respiratory_rate') ? quantitySamples(HK.QuantityType.respiratoryRate, HK.Unit.countPerMinute, past30DaysFrom, to, 20) : [],
  ]);

  // Authentically deduplicate cumulative metrics across apps (never sum across parallel sources)
  const steps = resolveDeduplicatedCumulativeMetric(stepSamples, stepsStatRaw) || 0;
  const calories = resolveDeduplicatedCumulativeMetric(calorieSamples, caloriesStatRaw);
  const distance = resolveDeduplicatedCumulativeMetric(distSamples, distStatRaw);

  const hrs = (hrSamples || [])
    .map((x) => Number(x?.value))
    .filter(Number.isFinite);
  const latestValue = (samples, scale = 1) => {
    const value = Number(samples?.[0]?.value);
    return Number.isFinite(value) ? value * scale : null;
  };
  const latestRecordedAt = (samples) => {
    const date = samples?.[0]?.startDate || samples?.[0]?.endDate;
    if (!date) return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const latestExternalId = (samples, metric) => {
    const uuid = samples?.[0]?.uuid;
    return uuid ? `${SOURCE}-${metric}-${uuid}` : null;
  };
  const sameSampleTime = (left, right) => {
    const leftTime = left?.[0]?.startDate ? new Date(left[0].startDate).getTime() : (left?.[0]?.endDate ? new Date(left[0].endDate).getTime() : NaN);
    const rightTime = right?.[0]?.startDate ? new Date(right[0].startDate).getTime() : (right?.[0]?.endDate ? new Date(right[0].endDate).getTime() : NaN);
    if (!Number.isFinite(leftTime) || !Number.isFinite(rightTime)) return false;
    return Math.abs(leftTime - rightTime) <= 120_000;
  };
  const bloodPressurePairValid = sameSampleTime(systolicSamples, diastolicSamples)
    || (Boolean(systolicSamples?.[0]?.value) && Boolean(diastolicSamples?.[0]?.value));

  return {
    steps: steps ?? 0,
    activeCalories: calories != null ? Math.round(calories) : null,
    distanceM: distance != null ? Math.round(distance) : null,
    heartRate: hrs.length
      ? {
          latest: Math.round(hrs[0]),
          avg: Math.round(hrs.reduce((a, b) => a + b, 0) / hrs.length),
          recordedAt: latestRecordedAt(hrSamples),
          externalId: latestExternalId(hrSamples, 'heart_rate'),
        }
      : null,
    // HealthKit converts SDNN to the requested seconds unit; Health Connect's
    // RMSSD mapping returns canonical milliseconds for this identifier.
    hrvMs: latestValue(hrvSamples, Platform.OS === 'ios' ? 1000 : 1),
    hrvRecordedAt: latestRecordedAt(hrvSamples),
    hrvExternalId: latestExternalId(hrvSamples, 'hrv'),
    spo2: latestValue(spo2Samples),
    spo2RecordedAt: latestRecordedAt(spo2Samples),
    spo2ExternalId: latestExternalId(spo2Samples, 'spo2'),
    bloodGlucose: latestValue(glucoseSamples),
    bloodGlucoseRecordedAt: latestRecordedAt(glucoseSamples),
    bloodGlucoseExternalId: latestExternalId(glucoseSamples, 'blood_glucose'),
    bloodPressureSystolic: (bloodPressurePairValid || systolicSamples?.[0]?.value) ? latestValue(systolicSamples) : null,
    bloodPressureSystolicRecordedAt: latestRecordedAt(systolicSamples),
    bloodPressureSystolicExternalId: latestExternalId(systolicSamples, 'blood_pressure_systolic'),
    bloodPressureDiastolic: (bloodPressurePairValid || diastolicSamples?.[0]?.value) ? latestValue(diastolicSamples) : null,
    bloodPressureDiastolicRecordedAt: latestRecordedAt(diastolicSamples),
    bloodPressureDiastolicExternalId: latestExternalId(diastolicSamples, 'blood_pressure_diastolic'),

    respiratoryRate: latestValue(respiratorySamples),
    respiratoryRateRecordedAt: latestRecordedAt(respiratorySamples),
    respiratoryRateExternalId: latestExternalId(respiratorySamples, 'respiratory_rate'),
    weightKg: weightSamples?.[0]?.value != null ? Number(weightSamples[0].value) : null,
    weightRecordedAt: latestRecordedAt(weightSamples),
    weightExternalId: latestExternalId(weightSamples, 'weight'),
    sleepMinutes: calcSleepMinutes(sleepSamples),
  };
}

// ─── Daily step history for last N days ──────────────────────────────────────
// Health Connect keeps ~30 days unless READ_HEALTH_DATA_HISTORY is granted.
export async function readStepHistory(days = 30, requested = []) {
  if (!Array.isArray(requested) || !requested.includes('steps')) {
    return [];
  }
  const today = startOfDay();
  const jobs = [];
  for (let i = days - 1; i >= 0; i--) {
    const from = new Date(today.getTime() - i * DAY_MS);
    const to = i === 0 ? new Date() : new Date(from.getTime() + DAY_MS);
    jobs.push(
      statSum(HK.QuantityType.stepCount, HK.Unit.count, from, to).then(async (v) => {
        let val = v;
        if ((val == null || val <= 0) && i < 7) {
          try {
            const rawSamples = await quantitySamples(HK.QuantityType.stepCount, HK.Unit.count, from, to, 500);
            if (Array.isArray(rawSamples) && rawSamples.length > 0) {
              const sum = rawSamples.reduce((acc, cur) => acc + (Number(cur?.value) || 0), 0);
              if (sum > 0) val = sum;
            }
          } catch {}
        }
        return {
          date: localDateKey(from),
          recordedAt: i === 0
            ? new Date().toISOString()
            : (() => { const noon = new Date(from); noon.setHours(12, 0, 0, 0); return noon.toISOString(); })(),
          steps: Math.round(val || 0),
        };
      })
    );
  }
  return Promise.all(jobs);
}

// ─── Convert readings → backend PhoneHealthSample[] ──────────────────────────
// Backend schema (validateHealthSample) requires:
//   provider  metric  externalId  recordedAt  unit  value  [deviceId]
// Metric names must match HEALTH_METRICS Map in validation/input.js:
//   'steps'  'heart_rate'  'calories'  'sleep'  'distance'  'weight'
export function buildSamples(today, history, { stepProvider = SOURCE, stepDeviceId = null } = {}) {
  const now = new Date().toISOString();
  const dayKey = localDateKey();
  const out = [];

  if (stepProvider !== 'phone_pedometer') {
    for (const day of history || []) {
      if (day.date === dayKey) continue;
      if (day.steps) {
        out.push({
          provider: SOURCE,
          metric: 'steps',
          externalId: `${SOURCE}-steps-history-${day.date}`,
          value: Number(day.steps),
          unit: 'count',
          aggregation: 'daily_total',
          recordedAt: day.recordedAt || `${day.date}T12:00:00.000Z`,
        });
      }
      if (day.heartRate) {
        out.push({
          provider: SOURCE,
          metric: 'heart_rate',
          externalId: `${SOURCE}-hr-history-${day.date}`,
          value: Number(day.heartRate),
          unit: 'bpm',
          aggregation: 'instant',
          recordedAt: `${day.date}T08:30:00.000Z`,
        });
      }
      if (day.sleepMinutes) {
        out.push({
          provider: SOURCE,
          metric: 'sleep',
          externalId: `${SOURCE}-sleep-history-${day.date}`,
          value: Number(day.sleepMinutes),
          unit: 'minutes',
          aggregation: 'interval',
          recordedAt: `${day.date}T06:30:00.000Z`,
        });
      }
      if (day.bloodGlucose) {
        out.push({
          provider: SOURCE,
          metric: 'blood_glucose',
          externalId: `${SOURCE}-glucose-history-${day.date}`,
          value: Number(day.bloodGlucose),
          unit: 'mg/dL',
          aggregation: 'instant',
          recordedAt: `${day.date}T08:00:00.000Z`,
        });
      }
      if (day.spo2) {
        out.push({
          provider: SOURCE,
          metric: 'spo2',
          externalId: `${SOURCE}-spo2-history-${day.date}`,
          value: Number(day.spo2),
          unit: '%',
          aggregation: 'instant',
          recordedAt: `${day.date}T08:15:00.000Z`,
        });
      }
      if (day.bloodPressureSystolic) {
        out.push({
          provider: SOURCE,
          metric: 'blood_pressure_systolic',
          externalId: `${SOURCE}-sys-history-${day.date}`,
          value: Number(day.bloodPressureSystolic),
          unit: 'mmHg',
          aggregation: 'instant',
          recordedAt: `${day.date}T08:20:00.000Z`,
        });
      }
      if (day.bloodPressureDiastolic) {
        out.push({
          provider: SOURCE,
          metric: 'blood_pressure_diastolic',
          externalId: `${SOURCE}-dia-history-${day.date}`,
          value: Number(day.bloodPressureDiastolic),
          unit: 'mmHg',
          aggregation: 'instant',
          recordedAt: `${day.date}T08:20:00.000Z`,
        });
      }
    }
  }
  if (today?.steps && today.steps > 0) {
    out.push({
      provider: stepProvider,
      metric: 'steps',
      externalId: `${stepProvider}-steps-today-${dayKey}`,
      value: Number(today.steps),
      unit: 'count',
      aggregation: 'daily_total',
      recordedAt: now,
      ...(stepDeviceId && stepProvider === 'phone_pedometer' ? { deviceId: stepDeviceId } : {}),
    });
  }

  if (stepProvider === 'phone_pedometer') return out;

  const add = (metric, value, unit, sample = null) => {
    if (value == null || value <= 0) return;
    out.push({
      provider: SOURCE,
      metric,
      externalId: sample?.externalId || `${SOURCE}-${metric}-today-${dayKey}`,
      value: Number(value),
      unit,
      aggregation: ['calories', 'distance', 'sleep'].includes(metric) ? 'daily_total' : 'instant',
      recordedAt: sample?.recordedAt || now,
    });
  };
  add('calories', today.activeCalories, 'kcal');
  add('distance', today.distanceM, 'm');
  add('heart_rate', today.heartRate?.latest, 'bpm', today.heartRate);
  add('hrv', today.hrvMs, 'ms', { recordedAt: today.hrvRecordedAt, externalId: today.hrvExternalId });
  add('spo2', today.spo2 != null ? today.spo2 * 100 : null, '%', { recordedAt: today.spo2RecordedAt, externalId: today.spo2ExternalId });
  add('blood_glucose', today.bloodGlucose, 'mg/dL', { recordedAt: today.bloodGlucoseRecordedAt, externalId: today.bloodGlucoseExternalId });
  add('blood_pressure_systolic', today.bloodPressureSystolic, 'mmHg', { recordedAt: today.bloodPressureSystolicRecordedAt, externalId: today.bloodPressureSystolicExternalId });
  add('blood_pressure_diastolic', today.bloodPressureDiastolic, 'mmHg', { recordedAt: today.bloodPressureDiastolicRecordedAt, externalId: today.bloodPressureDiastolicExternalId });
  add('respiratory_rate', today.respiratoryRate, 'count/min', { recordedAt: today.respiratoryRateRecordedAt, externalId: today.respiratoryRateExternalId });
  add('weight', today.weightKg, 'kg', { recordedAt: today.weightRecordedAt, externalId: today.weightExternalId });
  add('sleep', today.sleepMinutes, 'minutes');

  return out;
}

// ─── Fallback: phone pedometer when Health Connect / HealthKit is not usable ──
// iOS: gives today's total from CMPedometer history
// Android (Expo Go): only counts steps since the subscription started
export async function startLiveSteps(onSteps, initialSteps = 0) {
  try {
    const available = await Pedometer.isAvailableAsync().catch(() => false);
    if (!available) return null;

    const perm = await Pedometer.requestPermissionsAsync().catch(() => ({ granted: false }));
    if (!perm?.granted) return null;

    let base = Number(initialSteps) || 0;
    if (Platform.OS === 'ios') {
      const r = await Pedometer.getStepCountAsync(startOfDay(), new Date()).catch(() => null);
      base = Math.max(base, r?.steps || 0);
    }

    onSteps(base); // Immediately report current count
    return Pedometer.watchStepCount((r) => onSteps(base + (r?.steps || 0)));
  } catch (e) {
    console.log('[Health] startLiveSteps error:', e?.message);
    return null;
  }
}
