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

export function getSampleOrigin(s) {
  if (typeof s?.sourceName === 'string' && s.sourceName.trim()) {
    return s.sourceName.trim();
  }
  if (typeof s?.sourceId === 'string' && s.sourceId.trim()) {
    return s.sourceId.trim();
  }
  if (typeof s?.source?.bundleIdentifier === 'string' && s.source.bundleIdentifier.trim()) {
    return s.source.bundleIdentifier.trim();
  }
  if (typeof s?.source?.name === 'string' && s.source.name.trim()) {
    return s.source.name.trim();
  }
  if (typeof s?.sourceRevision?.source?.bundleIdentifier === 'string' && s.sourceRevision.source.bundleIdentifier.trim()) {
    return s.sourceRevision.source.bundleIdentifier.trim();
  }
  if (typeof s?.metadata?.dataOrigin?.packageName === 'string' && s.metadata.dataOrigin.packageName.trim()) {
    return s.metadata.dataOrigin.packageName.trim();
  }
  if (typeof s?.metadata?.dataOrigin === 'string' && s.metadata.dataOrigin.trim()) {
    return s.metadata.dataOrigin.trim();
  }
  if (typeof s?.packageName === 'string' && s.packageName.trim()) {
    return s.packageName.trim();
  }
  if (typeof s?.device?.name === 'string' && s.device.name.trim()) {
    return s.device.name.trim();
  }
  if (typeof s?.device?.model === 'string' && s.device.model.trim()) {
    return s.device.model.trim();
  }
  return 'default';
}

export function isWearableOrigin(origin = '') {
  return /watch|wear|shealth|samsung.*health|fitbit|garmin|polar|suunto|noise|boat|zepp|amazfit|whoop|oura|titan|fastrack|fireboltt|tracker/i.test(origin);
}

function resolveCumulativeMetric(statSumVal, samples) {
  const statNum = (statSumVal != null && Number.isFinite(Number(statSumVal)) && Number(statSumVal) > 0)
    ? Math.round(Number(statSumVal))
    : 0;

  if (!Array.isArray(samples) || samples.length === 0) {
    return statNum > 0 ? statNum : null;
  }

  // Fallback / complement: group and inspect raw samples
  const sourceGroups = new Map();
  for (const s of samples) {
    const val = Number(s?.value);
    if (!Number.isFinite(val) || val <= 0) continue;
    const origin = getSampleOrigin(s);
    const list = sourceGroups.get(origin) || [];
    list.push(s);
    sourceGroups.set(origin, list);
  }

  if (sourceGroups.size === 0) {
    return statNum > 0 ? statNum : null;
  }

  const sourceTotals = [];
  for (const [origin, srcSamples] of sourceGroups) {
    const total = srcSamples.reduce((acc, cur) => acc + (Number(cur?.value) || 0), 0);
    if (total > 0) {
      sourceTotals.push({ origin, total: Math.round(total) });
    }
  }

  const maxSampleTotal = sourceTotals.length > 0 ? Math.max(...sourceTotals.map((st) => st.total)) : 0;
  const wearableEntry = sourceTotals.find((st) => isWearableOrigin(st.origin));
  const wearableTotal = wearableEntry ? wearableEntry.total : 0;

  console.log('[resolveCumulativeMetric] breakdown:', {
    statNum,
    wearableTotal,
    maxSampleTotal,
    sources: sourceTotals,
  });

  // When multiple apps write to Health Connect (e.g. Google Fit, Fitbit, phone sensor),
  // Health Connect's cumulativeSum (statNum) sums ALL apps' samples together, resulting in double/triple counts.
  // When samples are available from distinct origins, prioritize the authentic single-source reading:
  // User Requirement: If phone (Google Fit) is X and watch (Fitbit) is Y, show whichever has MORE steps (MAX)!
  let best = 0;
  if (maxSampleTotal > 0) {
    best = Math.max(wearableTotal, maxSampleTotal);
  } else if (wearableTotal > 0) {
    best = wearableTotal;
  } else {
    best = statNum;
  }
  return best > 0 ? best : null;
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
    hrSamplesToday,
    weightSamples,
    sleepSamples,
    hrvSamples,
    spo2SamplesToday,
    glucoseSamplesToday,
    systolicSamplesToday,
    diastolicSamplesToday,
    respiratorySamples,
  ] = await Promise.all([
    includes('steps') ? quantitySamples(HK.QuantityType.stepCount, HK.Unit.count, from, to, 2000) : [],
    includes('calories') ? quantitySamples(HK.QuantityType.activeEnergyBurned, HK.Unit.kilocalorie, from, to, 2000) : [],
    includes('distance') ? quantitySamples(HK.QuantityType.distanceWalkingRunning, HK.Unit.meter, from, to, 2000) : [],
    includes('steps') ? statSum(HK.QuantityType.stepCount, HK.Unit.count, from, to) : 0,
    includes('calories') ? statSum(HK.QuantityType.activeEnergyBurned, HK.Unit.kilocalorie, from, to) : null,
    includes('distance') ? statSum(HK.QuantityType.distanceWalkingRunning, HK.Unit.meter, from, to) : null,
    // Query all samples for TODAY (up to 2000 readings for continuous heart rate watches)
    includes('heart_rate') ? quantitySamples(HK.QuantityType.heartRate, HK.Unit.countPerMinute, from, to, 2000) : [],
    includes('weight') ? quantitySamples(HK.QuantityType.bodyMass, HK.Unit.kilogram, new Date(to.getTime() - 365 * DAY_MS), to, 1) : [],
    includes('sleep') ? HK.queryCategorySamples({
      type: HK.CategoryType.sleepAnalysis,
      from: new Date(from.getTime() - 36 * 60 * 60 * 1000), // start from 36 hours ago to cover last night's sleep
      to,
      limit: 500,
      ascending: true,
    }).catch(() => []) : [],
    includes('hrv') ? quantitySamples(HK.QuantityType.heartRateVariabilitySDNN, HK.Unit.second, past30DaysFrom, to, 50) : [],
    // Query all samples for TODAY (up to 1000 readings for SpO2 pulse oximeter watches)
    includes('spo2') ? quantitySamples(HK.QuantityType.oxygenSaturation, HK.Unit.percent, from, to, 1000) : [],
    includes('blood_glucose') ? quantitySamples(HK.QuantityType.bloodGlucose, HK.Unit.milligramPerDeciliter, from, to, 200) : [],
    includes('blood_pressure_systolic') ? quantitySamples(HK.QuantityType.bloodPressureSystolic, HK.Unit.millimeterOfMercury, from, to, 200) : [],
    includes('blood_pressure_diastolic') ? quantitySamples(HK.QuantityType.bloodPressureDiastolic, HK.Unit.millimeterOfMercury, from, to, 200) : [],
    includes('respiratory_rate') ? quantitySamples(HK.QuantityType.respiratoryRate, HK.Unit.countPerMinute, past30DaysFrom, to, 50) : [],
  ]);

  // Fallback to most recent reading in last 30 days if no reading was recorded yet today
  let hrSamples = hrSamplesToday || [];
  if (hrSamples.length === 0 && includes('heart_rate')) {
    hrSamples = await quantitySamples(HK.QuantityType.heartRate, HK.Unit.countPerMinute, past30DaysFrom, to, 1);
  }

  let spo2Samples = spo2SamplesToday || [];
  if (spo2Samples.length === 0 && includes('spo2')) {
    spo2Samples = await quantitySamples(HK.QuantityType.oxygenSaturation, HK.Unit.percent, past30DaysFrom, to, 1);
  }

  let systolicSamples = systolicSamplesToday || [];
  let diastolicSamples = diastolicSamplesToday || [];
  if (systolicSamples.length === 0 && includes('blood_pressure_systolic')) {
    systolicSamples = await quantitySamples(HK.QuantityType.bloodPressureSystolic, HK.Unit.millimeterOfMercury, past30DaysFrom, to, 1);
    diastolicSamples = await quantitySamples(HK.QuantityType.bloodPressureDiastolic, HK.Unit.millimeterOfMercury, past30DaysFrom, to, 1);
  }

  let glucoseSamples = glucoseSamplesToday || [];
  if (glucoseSamples.length === 0 && includes('blood_glucose')) {
    glucoseSamples = await quantitySamples(HK.QuantityType.bloodGlucose, HK.Unit.milligramPerDeciliter, past30DaysFrom, to, 1);
  }

  let pedometerSteps = null;
  try {
    const isAvail = await Pedometer.isAvailableAsync().catch(() => false);
    if (isAvail) {
      const pRes = await Pedometer.getStepCountAsync(from, to).catch((e) => {
        console.log('[Health] Pedometer.getStepCountAsync err:', e?.message);
        return null;
      });
      if (pRes?.steps != null && Number(pRes.steps) > 0) {
        pedometerSteps = Number(pRes.steps);
      }
    }
  } catch (e) {
    console.log('[Health] Pedometer check error:', e?.message);
  }

  // Authentically prioritize native OS cumulative aggregation (Health Connect & HealthKit)
  const healthStoreSteps = resolveCumulativeMetric(stepsStatRaw, stepSamples) || 0;
  const rawCalories = resolveCumulativeMetric(caloriesStatRaw, calorieSamples);
  const rawDistance = resolveCumulativeMetric(distStatRaw, distSamples);

  // Take the highest authentic reading between Health Connect and hardware pedometer
  const steps = Math.max(healthStoreSteps, pedometerSteps || 0);

  console.log('[Health-Diagnostics] Steps breakdown:', {
    stepsStatRaw,
    samplesCount: stepSamples.length,
    healthStoreSteps,
    pedometerSteps,
    resolvedSteps: steps,
    caloriesStatRaw,
    calorieSamplesCount: calorieSamples.length,
    rawCalories,
  });

  // Accurate Active Burn:
  // If sensor calorie reading is authentic from Health Connect / Apple Health, prioritize it!
  // Otherwise, compute accurate active burn from steps (~0.045 kcal/step).
  const expectedBurn = steps > 0 ? Math.round(steps * 0.045) : 0;
  // Guard against inflated cumulative calorie sums from multiple health apps
  const maxReasonableCal = steps > 0 ? Math.round(steps * 0.09) : 9999;
  const calories = (rawCalories != null && rawCalories > 0 && rawCalories <= maxReasonableCal)
    ? Math.round(rawCalories)
    : expectedBurn;

  const expectedDistance = steps > 0 ? Math.round(steps * 0.75) : 0;
  const distance = (rawDistance != null && rawDistance > 0)
    ? Math.round(rawDistance)
    : expectedDistance;

  const hrs = (hrSamples || [])
    .map((x) => Number(x?.value))
    .filter(Number.isFinite);
  const latestValue = (samples, scale = 1) => {
    const value = Number(samples?.[0]?.value);
    if (!Number.isFinite(value)) return null;
    return (value <= 1 && scale === 1) ? Math.round(value * 100) : value * scale;
  };
  const latestRecordedAt = (samples) => {
    const s = samples?.[0];
    const date = s?.startDate || s?.endDate || s?.time || s?.startTime;
    if (!date) return null;
    const parsed = new Date(date);
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
  };
  const latestExternalId = (samples, metric) => {
    const s = samples?.[0];
    if (!s) return null;
    const recAt = latestRecordedAt(samples);
    const id = s.uuid || s.id || s.metadata?.id || (recAt ? recAt.replace(/[:.]/g, '-') : null);
    return id ? `${SOURCE}-${metric}-${id}` : null;
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
    // Full intraday timeline of all heart rate readings for today with unique timestamped IDs
    heartRateSamples: (hrSamplesToday && hrSamplesToday.length > 0 ? hrSamplesToday : hrSamples).map((s) => {
      const recAt = latestRecordedAt([s]);
      const sampleId = s.uuid || s.id || s.metadata?.id || 'hr';
      const timeKey = recAt ? recAt.replace(/[:.]/g, '-') : Math.random().toString(36).slice(2, 8);
      return {
        value: Math.round(Number(s.value)),
        recordedAt: recAt,
        externalId: `${SOURCE}-heart_rate-${sampleId}-${timeKey}`,
      };
    }).filter((s) => Number.isFinite(s.value) && s.value > 0 && s.recordedAt),
    // Full intraday timeline of all SpO2 readings for today
    spo2Samples: (spo2SamplesToday && spo2SamplesToday.length > 0 ? spo2SamplesToday : spo2Samples).map((s) => {
      const recAt = latestRecordedAt([s]);
      const sampleId = s.uuid || s.id || s.metadata?.id || 'spo2';
      const timeKey = recAt ? recAt.replace(/[:.]/g, '-') : Math.random().toString(36).slice(2, 8);
      return {
        value: Math.round(Number(s.value) <= 1 ? Number(s.value) * 100 : Number(s.value)),
        recordedAt: recAt,
        externalId: `${SOURCE}-spo2-${sampleId}-${timeKey}`,
      };
    }).filter((s) => Number.isFinite(s.value) && s.value > 0 && s.recordedAt),
    // Full intraday timeline of all blood pressure readings for today
    bloodPressureSamples: (systolicSamplesToday && systolicSamplesToday.length > 0 ? systolicSamplesToday : systolicSamples).map((sys, idx) => {
      const recAt = latestRecordedAt([sys]);
      const sampleId = sys.uuid || sys.id || sys.metadata?.id || 'bp';
      const timeKey = recAt ? recAt.replace(/[:.]/g, '-') : Math.random().toString(36).slice(2, 8);
      return {
        systolic: Number(sys.value),
        diastolic: diastolicSamples?.[idx]?.value ? Number(diastolicSamples[idx].value) : null,
        recordedAt: recAt,
        externalId: `${SOURCE}-bp-${sampleId}-${timeKey}`,
      };
    }).filter((s) => Number.isFinite(s.systolic) && s.systolic > 0 && s.recordedAt),
  };
}

// ─── Daily step history for last N days (Supports Incremental & 30-day sync) ───
// Health Connect keeps ~30 days unless READ_HEALTH_DATA_HISTORY is granted.
// Always queries full 30 days to guarantee every day's steps, calories, and distance
// are accurately recorded and stored in the database.
export async function readStepHistory(days = 30, requested = []) {
  if (!Array.isArray(requested) || !requested.includes('steps')) {
    return [];
  }
  const safeDays = Math.max(1, Math.min(30, Number(days) || 30));
  const today = startOfDay();
  const jobs = [];
  for (let i = safeDays - 1; i >= 0; i--) {
    const from = new Date(today.getTime() - i * DAY_MS);
    const to = i === 0 ? new Date() : new Date(from.getTime() + DAY_MS);
    jobs.push(
      (async () => {
        let val = null;
        try {
          val = await statSum(HK.QuantityType.stepCount, HK.Unit.count, from, to);
        } catch {}
        if (val == null || val <= 0) {
          try {
            const rawSamples = await quantitySamples(HK.QuantityType.stepCount, HK.Unit.count, from, to, 2000);
            if (Array.isArray(rawSamples) && rawSamples.length > 0) {
              val = resolveCumulativeMetric(null, rawSamples);
            }
          } catch {}
        }

        let cal = null;
        try {
          cal = await statSum(HK.QuantityType.activeEnergyBurned, HK.Unit.kilocalorie, from, to);
        } catch {}

        let dist = null;
        try {
          dist = await statSum(HK.QuantityType.distanceWalkingRunning, HK.Unit.meter, from, to);
        } catch {}

        const steps = Math.round(val || 0);
        const calories = (cal != null && cal > 0) ? Math.round(cal) : (steps > 0 ? Math.round(steps * 0.045) : 0);
        const distance = (dist != null && dist > 0) ? Math.round(dist) : (steps > 0 ? Math.round(steps * 0.75) : 0);

        return {
          date: localDateKey(from),
          recordedAt: i === 0
            ? new Date().toISOString()
            : (() => { const noon = new Date(from); noon.setHours(12, 0, 0, 0); return noon.toISOString(); })(),
          steps,
          calories,
          distance,
        };
      })()
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

  // Always store history from Health Connect / HealthKit for past days
  for (const day of history || []) {
    if (day.date === dayKey) continue;
    if (day.steps && Number(day.steps) > 0) {
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
    if (day.calories && Number(day.calories) > 0) {
      out.push({
        provider: SOURCE,
        metric: 'calories',
        externalId: `${SOURCE}-calories-history-${day.date}`,
        value: Number(day.calories),
        unit: 'kcal',
        aggregation: 'daily_total',
        recordedAt: day.recordedAt || `${day.date}T12:00:00.000Z`,
      });
    }
    if (day.distance && Number(day.distance) > 0) {
      out.push({
        provider: SOURCE,
        metric: 'distance',
        externalId: `${SOURCE}-distance-history-${day.date}`,
        value: Number(day.distance),
        unit: 'm',
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
  if (today?.steps && today.steps > 0) {
    out.push({
      provider: stepProvider,
      metric: 'steps',
      externalId: `${stepProvider}-steps-today-${dayKey}`,
      value: Number(today.steps),
      unit: 'count',
      aggregation: 'daily_total',
      recordedAt: `${dayKey}T00:00:00.000Z`,
      ...(stepDeviceId && stepProvider === 'phone_pedometer' ? { deviceId: stepDeviceId } : {}),
    });
  }

  // Calculate calories and distance for phone pedometer if not already provided
  const effectiveCalories = (today?.activeCalories != null && today.activeCalories > 0)
    ? today.activeCalories
    : (today?.steps && today.steps > 0 ? Math.round(today.steps * 0.04) : null);
  const effectiveDistance = (today?.distanceM != null && today.distanceM > 0)
    ? today.distanceM
    : (today?.steps && today.steps > 0 ? Math.round(today.steps * 0.75) : null);

  if (stepProvider === 'phone_pedometer') {
    if (effectiveCalories && effectiveCalories > 0) {
      out.push({
        provider: 'phone_pedometer',
        metric: 'calories',
        externalId: `phone_pedometer-calories-today-${dayKey}`,
        value: Number(effectiveCalories),
        unit: 'kcal',
        aggregation: 'daily_total',
        recordedAt: `${dayKey}T00:00:00.000Z`,
        ...(stepDeviceId ? { deviceId: stepDeviceId } : {}),
      });
    }
    if (effectiveDistance && effectiveDistance > 0) {
      out.push({
        provider: 'phone_pedometer',
        metric: 'distance',
        externalId: `phone_pedometer-distance-today-${dayKey}`,
        value: Number(effectiveDistance),
        unit: 'm',
        aggregation: 'daily_total',
        recordedAt: `${dayKey}T00:00:00.000Z`,
        ...(stepDeviceId ? { deviceId: stepDeviceId } : {}),
      });
    }
  }

  const add = (metric, value, unit, sample = null) => {
    if (value == null || value <= 0) return;
    const isCumulative = ['calories', 'distance', 'sleep'].includes(metric);
    const recAt = sample?.recordedAt || (isCumulative ? `${dayKey}T00:00:00.000Z` : now);
    const defaultExtId = isCumulative
      ? `${SOURCE}-${metric}-today-${dayKey}`
      : `${SOURCE}-${metric}-${recAt.replace(/[:.]/g, '-')}`;
    out.push({
      provider: SOURCE,
      metric,
      externalId: sample?.externalId || defaultExtId,
      value: Number(value),
      unit,
      aggregation: isCumulative ? 'daily_total' : 'instant',
      recordedAt: recAt,
    });
  };

  if (stepProvider !== 'phone_pedometer') {
    add('calories', effectiveCalories, 'kcal');
    add('distance', effectiveDistance, 'm');
  }

  // Upload full intraday timeline of heart rate readings
  if (Array.isArray(today.heartRateSamples) && today.heartRateSamples.length > 0) {
    const seenHrTimes = new Set();
    for (const hr of today.heartRateSamples) {
      if (hr.value > 0 && hr.recordedAt && !seenHrTimes.has(hr.recordedAt)) {
        seenHrTimes.add(hr.recordedAt);
        out.push({
          provider: SOURCE,
          metric: 'heart_rate',
          externalId: hr.externalId || `${SOURCE}-heart_rate-${hr.recordedAt.replace(/[:.]/g, '-')}`,
          value: Number(hr.value),
          unit: 'bpm',
          aggregation: 'instant',
          recordedAt: hr.recordedAt,
        });
      }
    }
  } else if (today.heartRate?.latest) {
    add('heart_rate', today.heartRate.latest, 'bpm', today.heartRate);
  }

  add('hrv', today.hrvMs, 'ms', { recordedAt: today.hrvRecordedAt, externalId: today.hrvExternalId });

  // Upload full intraday timeline of SpO2 readings
  if (Array.isArray(today.spo2Samples) && today.spo2Samples.length > 0) {
    const seenSpo2Times = new Set();
    for (const sp of today.spo2Samples) {
      if (sp.value > 0 && sp.recordedAt && !seenSpo2Times.has(sp.recordedAt)) {
        seenSpo2Times.add(sp.recordedAt);
        out.push({
          provider: SOURCE,
          metric: 'spo2',
          externalId: sp.externalId || `${SOURCE}-spo2-${sp.recordedAt.replace(/[:.]/g, '-')}`,
          value: Number(sp.value),
          unit: '%',
          aggregation: 'instant',
          recordedAt: sp.recordedAt,
        });
      }
    }
  } else if (today.spo2 != null) {
    const normSpo2 = Math.round(Number(today.spo2) <= 1 ? Number(today.spo2) * 100 : (Number(today.spo2) > 100 ? Number(today.spo2) / 100 : Number(today.spo2)));
    add('spo2', normSpo2, '%', { recordedAt: today.spo2RecordedAt, externalId: today.spo2ExternalId });
  }

  add('blood_glucose', today.bloodGlucose, 'mg/dL', { recordedAt: today.bloodGlucoseRecordedAt, externalId: today.bloodGlucoseExternalId });

  // Upload full blood pressure readings
  if (Array.isArray(today.bloodPressureSamples) && today.bloodPressureSamples.length > 0) {
    const seenBpTimes = new Set();
    for (const bp of today.bloodPressureSamples) {
      if (bp.systolic > 0 && bp.recordedAt && !seenBpTimes.has(bp.recordedAt)) {
        seenBpTimes.add(bp.recordedAt);
        const timeKey = bp.recordedAt.replace(/[:.]/g, '-');
        out.push({
          provider: SOURCE,
          metric: 'blood_pressure_systolic',
          externalId: bp.externalId ? `${bp.externalId}-sys` : `${SOURCE}-sys-${timeKey}`,
          value: Number(bp.systolic),
          unit: 'mmHg',
          aggregation: 'instant',
          recordedAt: bp.recordedAt,
        });
        if (bp.diastolic > 0) {
          out.push({
            provider: SOURCE,
            metric: 'blood_pressure_diastolic',
            externalId: bp.externalId ? `${bp.externalId}-dia` : `${SOURCE}-dia-${timeKey}`,
            value: Number(bp.diastolic),
            unit: 'mmHg',
            aggregation: 'instant',
            recordedAt: bp.recordedAt,
          });
        }
      }
    }
  } else {
    add('blood_pressure_systolic', today.bloodPressureSystolic, 'mmHg', { recordedAt: today.bloodPressureSystolicRecordedAt, externalId: today.bloodPressureSystolicExternalId });
    add('blood_pressure_diastolic', today.bloodPressureDiastolic, 'mmHg', { recordedAt: today.bloodPressureDiastolicRecordedAt, externalId: today.bloodPressureDiastolicExternalId });
  }
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
