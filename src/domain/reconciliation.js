export const DEVICE_TIERS = {
  whoop: 1,
  oura: 1,
  garmin: 1,

  apple_watch: 2,
  samsung_health: 2,
  fitbit: 2,
  polar: 2,
  suunto: 2,
  coros: 2,
  ringconn: 2,
  withings: 2,
  ultrahuman: 2,
  inbody: 2,
  glucobase_cgm: 2,

  apple_health: 3,
  health_connect: 3,
};

const DEFAULT_PRIORITY = {
  steps: [
    'garmin', 'whoop', 'oura',
    'apple_watch', 'samsung_health', 'fitbit', 'polar', 'coros', 'suunto',
    'apple_health', 'health_connect',
  ],
  sleep: [
    'whoop', 'oura', 'garmin',
    'apple_watch', 'samsung_health', 'fitbit', 'withings',
    'apple_health', 'health_connect',
  ],
  hrv: [
    'whoop', 'oura', 'garmin',
    'apple_watch', 'samsung_health', 'fitbit', 'coros',
    'apple_health', 'health_connect',
  ],
  heart_rate: [
    'whoop', 'garmin', 'oura',
    'apple_watch', 'samsung_health', 'fitbit', 'polar', 'coros',
    'apple_health', 'health_connect',
  ],
  resting_heart_rate: [
    'whoop', 'garmin', 'oura',
    'apple_watch', 'samsung_health', 'fitbit',
    'apple_health', 'health_connect',
  ],
  spo2: [
    'whoop', 'garmin', 'oura',
    'apple_watch', 'samsung_health', 'fitbit',
    'apple_health', 'health_connect',
  ],
  workout: [
    'garmin', 'whoop', 'coros', 'polar', 'suunto',
    'apple_watch', 'samsung_health', 'fitbit',
    'apple_health', 'health_connect',
  ],
  weight: [
    'withings', 'inbody',
    'apple_health', 'health_connect',
  ],
  height: [
    'apple_health', 'health_connect',
  ],
  respiratory_rate: [
    'whoop', 'oura', 'garmin',
    'apple_watch', 'samsung_health',
    'apple_health', 'health_connect',
  ],
  temperature: [
    'oura', 'whoop', 'apple_watch',
    'apple_health', 'health_connect',
  ],
  blood_glucose: [
    'glucobase_cgm',
    'apple_health', 'health_connect',
  ],
  blood_pressure_systolic: [
    'withings',
    'apple_health', 'health_connect',
  ],
  blood_pressure_diastolic: [
    'withings',
    'apple_health', 'health_connect',
  ],
  vo2_max: [
    'garmin', 'apple_watch', 'coros', 'polar',
    'apple_health', 'health_connect',
  ],
  calories: [
    'garmin', 'whoop', 'apple_watch', 'samsung_health', 'fitbit',
    'apple_health', 'health_connect',
  ],
  distance: [
    'garmin', 'apple_watch', 'coros', 'polar', 'suunto',
    'apple_health', 'health_connect',
  ],
  hydration: [
    'apple_health', 'health_connect',
  ],
};

const CUMULATIVE_METRICS = new Set([
  'steps', 'sleep', 'workout', 'calories', 'distance', 'hydration',
]);

const AVERAGE_METRICS = new Set([
  'heart_rate', 'resting_heart_rate', 'hrv', 'spo2',
  'respiratory_rate', 'temperature', 'blood_glucose',
  'blood_pressure_systolic', 'blood_pressure_diastolic', 'vo2_max',
]);

export function reconcileDailyMetrics(samples, priority = DEFAULT_PRIORITY) {
  const samplesByMetric = groupBy(samples, (sample) => sample.metric || sample.metricType);
  const summary = {};

  for (const [metric, metricSamples] of samplesByMetric) {
    const providerGroups = groupBy(metricSamples, (sample) => sample.provider);
    const aggregates = [];

    for (const [provider, pSamples] of providerGroups) {
      const deviceGroups = groupBy(pSamples, (s) => s.deviceKey || s.device_key || 'default');
      let chosenSamples = pSamples;
      if (deviceGroups.size > 1) {
        let bestSamples = null;
        for (const [dKey, dSamples] of deviceGroups) {
          const isWatch = /watch|band|ring|tracker|wearable/i.test(dKey) ||
            dSamples.some((s) => (s.deviceTier ?? DEVICE_TIERS[provider] ?? 4) <= 2);
          if (isWatch) {
            bestSamples = dSamples;
            break;
          }
        }
        chosenSamples = bestSamples || pSamples;
      }

      aggregates.push(aggregateProviderSamples(metric, provider, chosenSamples));
    }

    const primary = choosePrimary(metric, aggregates, priority);
    if (!primary) continue;

    summary[metric] = {
      value: Math.round(primary.value * 100) / 100,
      unit: primary.unit,
      primary: primary.provider,
      breakdown: Object.fromEntries(
        aggregates.map((agg) => [agg.provider, Math.round(agg.value * 100) / 100]),
      ),
    };
  }

  return summary;
}

function aggregateProviderSamples(metric, provider, samples) {
  const sorted = [...samples].sort(
    (a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt),
  );
  const latest = sorted[0];

  const dailyTotals = samples.filter((s) => s.aggregation === 'daily_total');
  let value;

  if (dailyTotals.length > 0) {
    value = Math.max(...dailyTotals.map((s) => s.value));
  } else if (CUMULATIVE_METRICS.has(metric)) {
    const values = samples.map((s) => s.value);
    value = values.reduce((sum, v) => sum + v, 0);
  } else if (AVERAGE_METRICS.has(metric)) {
    const values = samples.map((s) => s.value);
    value = values.reduce((sum, v) => sum + v, 0) / values.length;
  } else {
    value = latest.value;
  }

  return { provider, value, unit: latest.unit, latestAt: latest.recordedAt };
}

function choosePrimary(metric, aggregates, priority) {
  return [...aggregates].sort((a, b) => {
    const rankDiff = providerRank(metric, a.provider, priority)
                   - providerRank(metric, b.provider, priority);
    return rankDiff || (Date.parse(b.latestAt) - Date.parse(a.latestAt));
  })[0];
}

function providerRank(metric, provider, priority) {
  const metricPriority = priority[metric];
  if (metricPriority) {
    const rank = metricPriority.indexOf(provider);
    if (rank !== -1) return rank;
  }

  const tier = DEVICE_TIERS[provider] ?? 4;
  return 100 + tier;
}

function groupBy(items, keyFn) {
  const groups = new Map();
  for (const item of items) {
    const key = keyFn(item);
    let list = groups.get(key);
    if (!list) {
      list = [];
      groups.set(key, list);
    }
    list.push(item);
  }
  return groups;
}

export function reconcileWorkouts(workouts, priority = DEFAULT_PRIORITY) {
  if (!Array.isArray(workouts) || workouts.length <= 1) return workouts || [];

  const sorted = [...workouts].sort((a, b) => {
    const aStart = new Date(a.startedAt || a.started_at).getTime();
    const bStart = new Date(b.startedAt || b.started_at).getTime();
    return aStart - bStart;
  });

  const reconciled = [];

  for (const current of sorted) {
    const curStart = new Date(current.startedAt || current.started_at).getTime();
    const curEnd = new Date(current.endedAt || current.ended_at || curStart + (current.durationSecs || current.duration_secs || 0) * 1000).getTime();

    const prev = reconciled[reconciled.length - 1];
    if (!prev) {
      reconciled.push(current);
      continue;
    }

    const prevStart = new Date(prev.startedAt || prev.started_at).getTime();
    const prevEnd = new Date(prev.endedAt || prev.ended_at || prevStart + (prev.durationSecs || prev.duration_secs || 0) * 1000).getTime();

    const overlapStart = Math.max(curStart, prevStart);
    const overlapEnd = Math.min(curEnd, prevEnd);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    const minDuration = Math.min(curEnd - curStart, prevEnd - prevStart);
    const isOverlapping = minDuration > 0 && (overlapDuration / minDuration) >= 0.5;

    if (isOverlapping) {
      const prevRank = providerRank('workout', prev.provider, priority);
      const curRank = providerRank('workout', current.provider, priority);
      if (curRank < prevRank) {
        reconciled[reconciled.length - 1] = current;
      }
    } else {
      reconciled.push(current);
    }
  }

  return reconciled;
}

export function reconcileSleepSessions(sessions, priority = DEFAULT_PRIORITY) {
  if (!Array.isArray(sessions) || sessions.length <= 1) return sessions || [];

  const sorted = [...sessions].sort((a, b) => {
    const aStart = new Date(a.startedAt || a.started_at).getTime();
    const bStart = new Date(b.startedAt || b.started_at).getTime();
    return aStart - bStart;
  });

  const reconciled = [];

  for (const current of sorted) {
    const curStart = new Date(current.startedAt || current.started_at).getTime();
    const curEnd = new Date(current.endedAt || current.ended_at).getTime();

    const prev = reconciled[reconciled.length - 1];
    if (!prev) {
      reconciled.push(current);
      continue;
    }

    const prevStart = new Date(prev.startedAt || prev.started_at).getTime();
    const prevEnd = new Date(prev.endedAt || prev.ended_at).getTime();

    const overlapStart = Math.max(curStart, prevStart);
    const overlapEnd = Math.min(curEnd, prevEnd);
    const overlapDuration = Math.max(0, overlapEnd - overlapStart);

    const minDuration = Math.min(curEnd - curStart, prevEnd - prevStart);
    const isOverlapping = minDuration > 0 && (overlapDuration / minDuration) >= 0.5;

    if (isOverlapping) {
      const prevRank = providerRank('sleep', prev.provider, priority);
      const curRank = providerRank('sleep', current.provider, priority);
      if (curRank < prevRank) {
        reconciled[reconciled.length - 1] = current;
      }
    } else {
      reconciled.push(current);
    }
  }

  return reconciled;
}

export { DEFAULT_PRIORITY, CUMULATIVE_METRICS, AVERAGE_METRICS };
