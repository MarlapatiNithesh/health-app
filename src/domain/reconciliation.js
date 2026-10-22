export const DEVICE_TIERS = {

  whoop: 1,
  oura: 1,
  garmin: 1,
  withings: 1,
  ultrahuman: 1,

  polar: 2,
  suunto: 2,
  sensorbio: 2,
  strava: 2,
  fitbit: 2,
  google_health: 2,
  samsung_health: 2,
  apple_health: 2,
  health_connect: 2,

  bluetooth_ble: 1,
  ble_direct: 1,

  phone: 3,
  phone_pedometer: 3,
};

const DEFAULT_PRIORITY = {
  steps: [
    'garmin', 'whoop', 'oura', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health', 'polar', 'suunto', 'strava',
    'apple_health', 'health_connect', 'phone', 'phone_pedometer',
  ],
  sleep: [
    'whoop', 'oura', 'garmin', 'withings', 'ultrahuman', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health',
    'apple_health', 'health_connect', 'phone',
  ],
  hrv: [
    'whoop', 'oura', 'garmin', 'sensorbio', 'ultrahuman', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health', 'polar',
    'apple_health', 'health_connect',
  ],
  heart_rate: [
    'garmin', 'whoop', 'oura', 'withings', 'sensorbio', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health', 'polar', 'suunto',
    'apple_health', 'health_connect', 'phone',
  ],
  resting_heart_rate: [
    'whoop', 'garmin', 'oura', 'withings', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health', 'polar',
    'apple_health', 'health_connect',
  ],
  spo2: [
    'garmin', 'whoop', 'oura', 'ultrahuman', 'withings', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health',
    'apple_health', 'health_connect',
  ],
  workout: [
    'garmin', 'whoop', 'polar', 'suunto', 'strava', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health',
    'apple_health', 'health_connect',
  ],
  weight: [
    'withings', 'samsung_health', 'google_health',
    'apple_health', 'health_connect',
  ],
  height: [
    'apple_health', 'health_connect',
  ],
  respiratory_rate: [
    'whoop', 'oura', 'garmin', 'sensorbio',
    'samsung_health', 'apple_health', 'health_connect',
  ],
  temperature: [
    'oura', 'whoop', 'ultrahuman', 'sensorbio',
    'samsung_health', 'apple_health', 'health_connect',
  ],
  blood_glucose: [
    'ultrahuman', 'withings', 'google_health',
    'samsung_health', 'apple_health', 'health_connect',
  ],
  blood_pressure_systolic: [
    'withings', 'samsung_health', 'google_health',
    'apple_health', 'health_connect',
  ],
  blood_pressure_diastolic: [
    'withings', 'samsung_health', 'google_health',
    'apple_health', 'health_connect',
  ],
  vo2_max: [
    'garmin', 'polar', 'suunto',
    'samsung_health', 'apple_health', 'health_connect',
  ],
  calories: [
    'garmin', 'whoop', 'oura', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health', 'polar', 'suunto', 'strava',
    'apple_health', 'health_connect', 'phone',
  ],
  distance: [
    'garmin', 'polar', 'suunto', 'strava', 'bluetooth_ble', 'ble_direct',
    'samsung_health', 'fitbit', 'google_health',
    'apple_health', 'health_connect', 'phone',
  ],
  womens_health: [
    'oura', 'whoop', 'garmin', 'fitbit',
    'samsung_health', 'apple_health', 'health_connect',
  ],
  health_scores: [
    'oura', 'whoop', 'garmin', 'ultrahuman',
    'samsung_health', 'fitbit', 'google_health',
    'apple_health', 'health_connect',
  ],
  hydration: [
    'samsung_health', 'google_health',
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
  const isPhoneProvider = provider === 'health_connect' || provider === 'apple_health' || provider === 'phone_pedometer' || provider === 'phone' || provider === 'google_fit' || provider === 'google_health';
  let value;

  if (CUMULATIVE_METRICS.has(metric) || metric === 'steps' || metric === 'calories' || metric === 'distance' || metric === 'active_energy_burned') {

    const sortedDaily = dailyTotals.sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    if (sortedDaily.length > 0) {
      value = Number(sortedDaily[0].value) || 0;
    } else if (latest) {
      value = Number(latest.value) || 0;
    } else {
      value = 0;
    }
  } else if (AVERAGE_METRICS.has(metric)) {
    const validSamples = samples.filter((s) => Number(s.value) > 0);
    const sortedValid = [...validSamples].sort((a, b) => Date.parse(b.recordedAt) - Date.parse(a.recordedAt));
    value = sortedValid.length > 0 ? sortedValid[0].value : (latest ? latest.value : 0);
  } else {
    value = latest?.value ?? 0;
  }

  return { provider, value, unit: latest?.unit || '', latestAt: latest?.recordedAt || new Date().toISOString() };
}

function choosePrimary(metric, aggregates, priority) {
  if (!Array.isArray(aggregates) || aggregates.length === 0) return null;

  const nonZero = aggregates.filter((a) => Number(a.value) > 0);
  const candidatePool = nonZero.length > 0 ? nonZero : aggregates;

  return [...candidatePool].sort((a, b) => {

    if (metric === 'steps' || metric === 'step_count' || metric === 'distance' || metric === 'calories' || metric === 'active_energy_burned') {
      const valDiff = (Number(b.value) || 0) - (Number(a.value) || 0);
      if (valDiff !== 0) return valDiff;
    }

    const rankDiff = providerRank(metric, a.provider, priority)
                   - providerRank(metric, b.provider, priority);
    if (rankDiff !== 0) return rankDiff;

    const valDiff = (Number(b.value) || 0) - (Number(a.value) || 0);
    if (valDiff !== 0) return valDiff;

    const timeDiff = (Date.parse(b.latestAt) || 0) - (Date.parse(a.latestAt) || 0);
    return timeDiff;
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
      } else if (curRank === prevRank) {

        const prevScore = (Number(prev.distanceM || prev.distance_m || 0) > 0 ? 1 : 0) +
                          (Number(prev.energyBurnedKcal || prev.energy_burned_kcal || 0) > 0 ? 1 : 0) +
                          (Number(prev.heartRateAvg || prev.heart_rate_avg || 0) > 0 ? 1 : 0);
        const curScore = (Number(current.distanceM || current.distance_m || 0) > 0 ? 1 : 0) +
                         (Number(current.energyBurnedKcal || current.energy_burned_kcal || 0) > 0 ? 1 : 0) +
                         (Number(current.heartRateAvg || current.heart_rate_avg || 0) > 0 ? 1 : 0);
        if (curScore > prevScore) {
          reconciled[reconciled.length - 1] = current;
        }
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
      } else if (curRank === prevRank) {

        const prevDuration = Number(prev.sleepTotalDurationMins || prev.sleep_total_duration_mins || 0);
        const curDuration = Number(current.sleepTotalDurationMins || current.sleep_total_duration_mins || 0);
        const curHasStages = Array.isArray(current.sleepStages || current.sleep_stages) && (current.sleepStages || current.sleep_stages).length > 0;
        const prevHasStages = Array.isArray(prev.sleepStages || prev.sleep_stages) && (prev.sleepStages || prev.sleep_stages).length > 0;
        if ((curHasStages && !prevHasStages) || (curDuration > prevDuration)) {
          reconciled[reconciled.length - 1] = current;
        }
      }
    } else {
      reconciled.push(current);
    }
  }

  return reconciled;
}

export function reconcileWomensHealth(records, priority = DEFAULT_PRIORITY) {
  if (!Array.isArray(records) || records.length <= 1) return records || [];
  const byDate = groupBy(records, (r) => {
    const d = r.recordedAt || r.recorded_at;
    return d ? new Date(d).toISOString().split('T')[0] : 'unknown';
  });
  const reconciled = [];
  for (const [, dayRecords] of byDate) {
    if (dayRecords.length === 1) {
      reconciled.push(dayRecords[0]);
      continue;
    }
    const chosen = [...dayRecords].sort((a, b) => {
      const aRank = providerRank('womens_health', a.provider, priority);
      const bRank = providerRank('womens_health', b.provider, priority);
      if (aRank !== bRank) return aRank - bRank;
      const aScore = (a.cycleLength ? 1 : 0) + (a.currentPhase ? 1 : 0) + (a.periodLength ? 1 : 0);
      const bScore = (b.cycleLength ? 1 : 0) + (b.currentPhase ? 1 : 0) + (b.periodLength ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      return new Date(b.recordedAt || b.recorded_at).getTime() - new Date(a.recordedAt || a.recorded_at).getTime();
    })[0];
    reconciled.push(chosen);
  }
  return reconciled;
}

export function reconcileHealthScores(scores, priority = DEFAULT_PRIORITY) {
  if (!Array.isArray(scores) || scores.length <= 1) return scores || [];
  const byTypeAndDate = groupBy(scores, (s) => {
    const d = s.calculatedAt || s.calculated_at;
    const dateStr = d ? new Date(d).toISOString().split('T')[0] : 'today';
    const type = s.scoreType || s.score_type || 'overall';
    return `${type}_${dateStr}`;
  });
  const reconciled = [];
  for (const [, dayScores] of byTypeAndDate) {
    if (dayScores.length === 1) {
      reconciled.push(dayScores[0]);
      continue;
    }
    const chosen = [...dayScores].sort((a, b) => {
      const aRank = providerRank('health_scores', a.provider, priority);
      const bRank = providerRank('health_scores', b.provider, priority);
      if (aRank !== bRank) return aRank - bRank;
      const aVal = Number(a.score) || 0;
      const bVal = Number(b.score) || 0;
      if (aVal !== bVal) return bVal - aVal;
      return new Date(b.calculatedAt || b.calculated_at).getTime() - new Date(a.calculatedAt || a.calculated_at).getTime();
    })[0];
    reconciled.push(chosen);
  }
  return reconciled;
}

export { DEFAULT_PRIORITY, CUMULATIVE_METRICS, AVERAGE_METRICS, providerRank };

