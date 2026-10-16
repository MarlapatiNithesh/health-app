import { createHash } from 'node:crypto';
import { getMetricDefinition, getDefaultAggregation, getCanonicalMetric } from '../domain/metrics.js';

export function generateSourceRecordId(provider, ...parts) {
  const content = [provider, ...parts.filter(Boolean)].join('|');
  return createHash('md5').update(content).digest('hex');
}

export function safeNumber(val, min = -Infinity, max = Infinity) {
  if (val == null || val === '') return null;
  const num = Number(val);
  if (!Number.isFinite(num) || isNaN(num)) return null;
  if (num < min || num > max) return null;
  return num;
}

export function safeDate(val) {
  if (!val) return null;
  const parsed = Date.parse(val);
  if (Number.isNaN(parsed)) return null;
  return new Date(parsed).toISOString();
}

export const VALID_HEALTH_SCORE_TYPES = new Set([
  'readiness',
  'recovery',
  'sleep',
  'activity',
  'stress',
  'strain',
  'body_battery',
  'overall',
]);

export function mapWorkout(raw, provider, memberId) {
  if (!raw || typeof raw !== 'object') return null;

  const rawStart = raw.started_at || raw.startedAt || raw.start_time || raw.startTime || raw.date || raw.timestamp;
  const startedAt = safeDate(rawStart);
  if (!startedAt) return null;

  const rawEnd = raw.ended_at || raw.endedAt || raw.end_time || raw.endTime;
  let endedAt = safeDate(rawEnd);
  if (endedAt && new Date(endedAt) < new Date(startedAt)) {
    endedAt = null;
  }

  const activityType = String(raw.activity_type || raw.activityType || raw.type || raw.activity || raw.sport || 'workout').toLowerCase();
  const sourceRecordId = String(
    raw.source_record_id ||
    raw.sourceRecordId ||
    raw.id ||
    raw.workout_id ||
    raw.externalId ||
    generateSourceRecordId(provider, startedAt, activityType)
  );

  const durationSecs = safeNumber(
    raw.duration_secs ?? raw.durationSecs ?? raw.duration_seconds ?? raw.duration_s ??
    (raw.duration_mins != null ? Number(raw.duration_mins) * 60 : null),
    0,
  );
  const movingTimeSecs = safeNumber(raw.moving_time_secs ?? raw.movingTimeSecs ?? raw.moving_time_seconds, 0);
  const distanceM = safeNumber(raw.distance_m ?? raw.distanceM ?? raw.distance_meters ?? raw.distance, 0);
  const stepsCount = safeNumber(raw.steps_count ?? raw.stepsCount ?? raw.steps, 0);
  const energyBurnedKcal = safeNumber(raw.energy_burned_kcal ?? raw.energyBurnedKcal ?? raw.calories_kcal ?? raw.calories, 0);

  return {
    memberId,
    provider,
    sourceRecordId,
    activityType,
    label: raw.label || raw.name || `${activityType} session`,
    startedAt,
    endedAt,
    durationSecs: durationSecs != null ? Math.round(durationSecs) : null,
    movingTimeSecs: movingTimeSecs != null ? Math.round(movingTimeSecs) : null,
    distanceM: distanceM != null ? Math.round(distanceM * 100) / 100 : null,
    stepsCount: stepsCount != null ? Math.round(stepsCount) : null,
    energyBurnedKcal: energyBurnedKcal != null ? Math.round(energyBurnedKcal * 100) / 100 : null,
    heartRateAvg: safeNumber(raw.heart_rate_avg ?? raw.heartRateAvg ?? raw.avg_heart_rate_bpm ?? raw.avg_hr, 20, 260),
    heartRateMax: safeNumber(raw.heart_rate_max ?? raw.heartRateMax ?? raw.max_heart_rate_bpm ?? raw.max_hr, 20, 260),
    heartRateMin: safeNumber(raw.heart_rate_min ?? raw.heartRateMin ?? raw.min_heart_rate_bpm ?? raw.min_hr, 20, 260),
    averageSpeed: safeNumber(raw.average_speed ?? raw.averageSpeed, 0),
    maxSpeed: safeNumber(raw.max_speed ?? raw.maxSpeed, 0),
    averageCadence: safeNumber(raw.average_cadence ?? raw.averageCadence, 0),
    averageWatts: safeNumber(raw.average_watts ?? raw.averageWatts, 0),
    maxWatts: safeNumber(raw.max_watts ?? raw.maxWatts, 0),
    totalElevationGain: safeNumber(raw.total_elevation_gain ?? raw.totalElevationGain ?? raw.elevation_gain_meters, 0),
    elevHigh: safeNumber(raw.elev_high ?? raw.elevHigh),
    elevLow: safeNumber(raw.elev_low ?? raw.elevLow),
    intensity: raw.intensity ? String(raw.intensity) : null,
    entrySource: raw.entry_source || raw.entrySource || 'device',
    hrZones: raw.hr_zones || raw.hrZones || raw.heart_rate_zones || {},
    powerZones: raw.power_zones || raw.powerZones || {},
    segments: Array.isArray(raw.segments) ? raw.segments : [],
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  };
}

export function mapSleepSession(raw, provider, memberId) {
  if (!raw || typeof raw !== 'object') return null;

  const rawStart = raw.started_at || raw.startedAt || raw.start_time || raw.startTime;
  const rawEnd = raw.ended_at || raw.endedAt || raw.end_time || raw.endTime;
  const startedAt = safeDate(rawStart);
  const endedAt = safeDate(rawEnd);
  if (!startedAt || !endedAt) return null;

  const startMs = Date.parse(startedAt);
  const endMs = Date.parse(endedAt);
  if (endMs <= startMs) return null;

  const sourceRecordId = String(
    raw.source_record_id ||
    raw.sourceRecordId ||
    raw.id ||
    raw.sleep_id ||
    raw.externalId ||
    generateSourceRecordId(provider, startedAt, endedAt)
  );

  const durationSec = raw.sleep_total_duration_mins != null
    ? Number(raw.sleep_total_duration_mins) * 60
    : (raw.duration_seconds ?? raw.duration_s ?? Math.round((endMs - startMs) / 1000));
  const totalMins = Math.max(0, Math.round(Number(durationSec) / 60));

  const stages = raw.stages || {};
  const timeInBedMins = safeNumber(
    raw.sleep_time_in_bed_minutes ?? raw.sleepTimeInBedMinutes ??
    (raw.time_in_bed_seconds ? Number(raw.time_in_bed_seconds) / 60 : null),
    0,
    1440,
  );

  const remMins = safeNumber(raw.sleep_rem_minutes ?? raw.sleepRemMinutes ?? stages.rem_minutes, 0, 1440);
  const deepMins = safeNumber(raw.sleep_deep_minutes ?? raw.sleepDeepMinutes ?? stages.deep_minutes, 0, 1440);
  const lightMins = safeNumber(raw.sleep_light_minutes ?? raw.sleepLightMinutes ?? stages.light_minutes, 0, 1440);
  const awakeMins = safeNumber(raw.sleep_awake_minutes ?? raw.sleepAwakeMinutes ?? stages.awake_minutes, 0, 1440);
  const score = safeNumber(raw.sleep_efficiency_score ?? raw.sleepEfficiencyScore ?? raw.efficiency_percent ?? raw.score, 0, 100);

  return {
    memberId,
    provider,
    sourceRecordId,
    startedAt,
    endedAt,
    sleepTotalDurationMins: totalMins,
    sleepTimeInBedMinutes: timeInBedMins != null ? Math.round(timeInBedMins) : null,
    sleepRemMinutes: remMins != null ? Math.round(remMins) : null,
    sleepDeepMinutes: deepMins != null ? Math.round(deepMins) : null,
    sleepLightMinutes: lightMins != null ? Math.round(lightMins) : null,
    sleepAwakeMinutes: awakeMins != null ? Math.round(awakeMins) : null,
    sleepEfficiencyScore: score != null ? Math.round(score * 100) / 100 : null,
    isNap: Boolean(raw.is_nap || raw.isNap),
    sleepStages: Array.isArray(raw.sleep_stages) ? raw.sleep_stages : (Array.isArray(raw.sleep_stage_intervals) ? raw.sleep_stage_intervals : []),
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  };
}

export function mapWomensHealth(raw, provider, memberId) {
  if (!raw || typeof raw !== 'object') return null;

  const rawDate = raw.recorded_at || raw.recordedAt || raw.date || raw.timestamp || raw.start_date || new Date().toISOString();
  const recordedAt = safeDate(rawDate);
  if (!recordedAt) return null;

  const sourceRecordId = String(
    raw.source_record_id ||
    raw.sourceRecordId ||
    raw.id ||
    raw.cycle_id ||
    generateSourceRecordId(provider, recordedAt, raw.day_in_cycle || raw.dayInCycle || 'cycle')
  );

  return {
    memberId,
    provider,
    sourceRecordId,
    currentPhase: raw.current_phase || raw.currentPhase || raw.phase || null,
    currentPhaseType: raw.current_phase_type || raw.currentPhaseType || raw.phase_type || null,
    cycleLength: safeNumber(raw.cycle_length ?? raw.cycleLength ?? raw.cycle_length_days, 1),
    dayInCycle: safeNumber(raw.day_in_cycle ?? raw.dayInCycle, 1),
    periodLength: safeNumber(raw.period_length ?? raw.periodLength ?? raw.period_length_days, 1),
    daysUntilNextPhase: safeNumber(raw.days_until_next_phase ?? raw.daysUntilNextPhase),
    lengthOfCurrentPhase: safeNumber(raw.length_of_current_phase ?? raw.lengthOfCurrentPhase),
    predictedCycleLength: safeNumber(raw.predicted_cycle_length ?? raw.predictedCycleLength),
    isPredictedCycle: Boolean(raw.is_predicted_cycle || raw.isPredictedCycle || raw.is_predicted),
    hasSpecifiedCycleLength: Boolean(raw.has_specified_cycle_length || raw.hasSpecifiedCycleLength),
    hasSpecifiedPeriodLength: Boolean(raw.has_specified_period_length || raw.hasSpecifiedPeriodLength),
    fertileWindowStart: raw.fertile_window_start || raw.fertileWindowStart || null,
    lengthOfFertileWindow: safeNumber(raw.length_of_fertile_window ?? raw.lengthOfFertileWindow),
    lastUpdatedAt: safeDate(raw.last_updated_at || raw.lastUpdatedAt),
    pregnancySnapshot: raw.pregnancy_snapshot || raw.pregnancySnapshot || raw.pregnancy || {},
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
    recordedAt,
  };
}

export function mapHealthScore(raw, provider, memberId, defaultScoreType = 'overall') {
  if (!raw || typeof raw !== 'object') return null;

  const rawScoreType = (raw.score_type || raw.scoreType || defaultScoreType || '').toLowerCase();
  if (!VALID_HEALTH_SCORE_TYPES.has(rawScoreType)) {
    return null;
  }

  const rawScore = raw.score ?? raw.value ?? raw.readiness_score ?? raw.recovery_score ?? raw.sleep_score ?? raw.activity_score;
  const score = safeNumber(rawScore, 0, 100);
  if (score == null) return null;

  const rawDate = raw.calculated_at || raw.calculatedAt || raw.date || raw.timestamp || raw.day;
  const calculatedAt = safeDate(rawDate);
  if (!calculatedAt) return null;

  return {
    memberId,
    provider,
    sourceRecordId: raw.id ? String(raw.id) : (raw.source_record_id || raw.sourceRecordId ? String(raw.source_record_id || raw.sourceRecordId) : null),
    scoreType: rawScoreType,
    score: Math.round(score * 100) / 100,
    qualifier: raw.qualifier ? String(raw.qualifier) : null,
    components: raw.components || raw.contributors || {},
    trend: ['up', 'stable', 'down'].includes(raw.trend) ? raw.trend : null,
    calculatedAt,
  };
}

export function mapTimeseriesRow(raw, provider, memberId, { deviceKey = '', aggregation = null } = {}) {
  if (!raw || typeof raw !== 'object') return null;

  const resolvedProvider = provider || raw.provider || 'unknown';
  const rawMetric = (raw.metricType || raw.metric_type || raw.metric || raw.type || '').toLowerCase();
  const canonicalMetric = getCanonicalMetric(rawMetric);
  const def = getMetricDefinition(canonicalMetric);
  if (!def) return null;

  const rawValue = raw.value;
  if (rawValue == null || typeof rawValue !== 'number' || !Number.isFinite(rawValue) || isNaN(rawValue)) {
    return null;
  }

  const unit = (raw.unit || def.canonicalUnit || '').trim();
  const convertedValue = def.convert ? def.convert(rawValue, unit) : rawValue;
  const validatedValue = safeNumber(convertedValue, def.min, def.max);
  if (validatedValue == null) return null;

  const rawRecorded = raw.recordedAt || raw.recorded_at || raw.timestamp || raw.start_time || raw.startTime;
  const recordedAt = safeDate(rawRecorded);
  if (!recordedAt) return null;

  const rawEnded = raw.endedAt || raw.ended_at || raw.end_time || raw.endTime;
  let endedAt = safeDate(rawEnded);
  if (endedAt && new Date(endedAt) < new Date(recordedAt)) {
    endedAt = null;
  }

  const resolvedAggregation = raw.aggregation || aggregation || def.defaultAggregation || 'instant';
  const resolvedDeviceKey = String(raw.deviceKey ?? raw.device_key ?? deviceKey ?? '');
  const sourceRecordId = raw.sourceRecordId ?? raw.source_record_id ?? raw.externalId ?? raw.id ?? null;
  const quality = ['good', 'suspect', 'poor'].includes(raw.qualityFlag || raw.quality_flag)
    ? (raw.qualityFlag || raw.quality_flag)
    : 'good';
  const localDate = (raw.localDate || raw.local_date || raw.date || raw.day || (typeof sourceRecordId === 'string' ? sourceRecordId : '')).match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;

  return {
    memberId,
    member_id: memberId,
    provider: resolvedProvider,
    deviceKey: resolvedDeviceKey,
    device_key: resolvedDeviceKey,
    sourceRecordId: sourceRecordId ? String(sourceRecordId) : null,
    source_record_id: sourceRecordId ? String(sourceRecordId) : null,
    localDate,
    local_date: localDate,
    metricType: canonicalMetric,
    metric_type: canonicalMetric,
    aggregation: resolvedAggregation,
    recordedAt,
    recorded_at: recordedAt,
    endedAt,
    ended_at: endedAt,
    value: Math.round(validatedValue * 1000) / 1000,
    unit: def.canonicalUnit,
    qualityFlag: quality,
    quality_flag: quality,
    metadata: raw.metadata && typeof raw.metadata === 'object' ? raw.metadata : {},
  };
}

export function normalizeSample(rawSample, fallbackSeriesType = null, extPrefix = null, defaultRecordedAt = null) {
  if (!rawSample || typeof rawSample !== 'object') return null;

  const rawType = (rawSample.type || rawSample.metric || fallbackSeriesType || '').toLowerCase();
  let metric = rawType;
  let unit = rawSample.unit;
  let metadata = rawSample.metadata && typeof rawSample.metadata === 'object' ? { ...rawSample.metadata } : {};

  if (rawType === 'walking_heart_rate_average') {
    metric = 'walking_heart_rate_average';
    unit = unit || 'bpm';
  } else if (['heart_rate'].includes(rawType)) {
    metric = 'heart_rate';
    unit = unit || 'bpm';
  } else if (rawType === 'resting_heart_rate') {
    metric = 'resting_heart_rate';
    unit = unit || 'bpm';
  } else if (['heart_rate_variability_sdnn', 'sdnn'].includes(rawType)) {
    metric = 'hrv';
    unit = unit || 'ms';
    metadata.hrv_type = 'sdnn';
  } else if (['heart_rate_variability_rmssd', 'rmssd', 'hrv'].includes(rawType)) {
    metric = 'hrv';
    unit = unit || 'ms';
    metadata.hrv_type = 'rmssd';
  } else if (rawType === 'steps') {
    metric = 'steps';
    unit = unit || 'count';
  } else if (['basal_energy', 'basal_metabolic_rate'].includes(rawType)) {
    metric = 'basal_metabolic_rate';
    unit = unit || 'kcal';
  } else if (['active_energy', 'active_energy_burned'].includes(rawType)) {
    metric = 'active_energy_burned';
    unit = unit || 'kcal';
  } else if (['calories', 'energy'].includes(rawType)) {
    metric = 'calories';
    unit = unit || 'kcal';
  } else if (['oxygen_saturation', 'spo2'].includes(rawType)) {
    metric = 'spo2';
    unit = unit || '%';
  } else if (rawType === 'respiratory_rate') {
    metric = 'respiratory_rate';
    unit = unit || 'br/min';
  } else if (['body_temperature', 'skin_temperature', 'temperature'].includes(rawType)) {
    metric = 'temperature';
    unit = unit || '°C';
  } else if (rawType === 'blood_glucose') {
    metric = 'blood_glucose';
    unit = unit || 'mg/dL';
  } else if (rawType === 'weight') {
    metric = 'weight';
    unit = unit || 'kg';
  } else if (['distance', 'distance_meters'].includes(rawType)) {
    metric = 'distance';
    unit = unit || 'm';
  } else if (rawType === 'height') {
    metric = 'height';
    unit = unit || 'cm';
  }

  const rawRecorded = rawSample.recordedAt || rawSample.recorded_at || rawSample.timestamp || defaultRecordedAt;
  const recordedAt = safeDate(rawRecorded);
  if (!recordedAt) {
    return null;
  }

  if (typeof rawSample.value !== 'number' || !Number.isFinite(rawSample.value) || isNaN(rawSample.value)) {
    return null;
  }

  const externalId = rawSample.externalId || rawSample.source_record_id || rawSample.id ||
    (extPrefix ? `${extPrefix}-${metric}-${recordedAt}` : null);

  return {
    metric,
    value: rawSample.value,
    unit: unit || 'count',
    recordedAt,
    endedAt: safeDate(rawSample.endedAt || rawSample.ended_at),
    externalId,
    metadata,
  };
}

export function extractDirectFieldSamples(data, provider, extPrefix = '') {
  if (!data || typeof data !== 'object') return [];

  const timestamp = safeDate(data.date || data.calendar_date || data.timestamp || data.start_time || data.startTime);
  if (!timestamp) return [];

  const samples = [];
  const fields = [
    { field: 'steps', metric: 'steps', unit: 'count' },
    { field: 'heart_rate', metric: 'heart_rate', unit: 'bpm' },
    { field: 'resting_heart_rate', metric: 'resting_heart_rate', unit: 'bpm' },
    { field: 'hrv', metric: 'hrv', unit: 'ms' },
    { field: 'spo2', metric: 'spo2', unit: '%' },
    { field: 'respiratory_rate', metric: 'respiratory_rate', unit: 'br/min' },
    { field: 'temperature', metric: 'temperature', unit: '°C' },
    { field: 'calories', metric: 'calories', unit: 'kcal' },
    { field: 'active_calories', metric: 'active_energy_burned', unit: 'kcal' },
    { field: 'distance', metric: 'distance', unit: 'm' },
    { field: 'weight', metric: 'weight', unit: 'kg' },
    { field: 'blood_glucose', metric: 'blood_glucose', unit: 'mg/dL' },
  ];

  for (const { field, metric, unit } of fields) {
    const val = data[field];
    if (typeof val === 'number' && Number.isFinite(val) && !isNaN(val)) {
      samples.push({
        provider,
        metric,
        value: val,
        unit,
        recordedAt: timestamp,
        externalId: `${extPrefix || provider}-${metric}-${timestamp}`,
      });
    }
  }

  return samples;
}
