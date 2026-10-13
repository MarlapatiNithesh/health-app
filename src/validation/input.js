import { ApplicationError } from '../errors/application-error.js';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PHONE_PROVIDERS = new Set([
  'apple_health',
  'apple',
  'health_connect',
  'samsung_health',
  'samsung',
  'google_health',
  'bluetooth_ble',
  'ble_live',
  'live_ble',
  'ble'
]);

const ALL_PROVIDERS = new Set([
  'manual',
  'manual_entry',
  'apple_health',
  'health_connect',
  'garmin',
  'samsung_health',
  'google_health',
  'withings',
  'oura',
  'suunto',
  'polar',
  'sensorbio',
  'whoop',
  'strava',
  'ultrahuman',
  'fitbit',
  'bluetooth_ble',
  'ble_live',
  'live_ble',
  'ble',
]);


const HEALTH_METRICS = new Map([
  ['steps',                    { units: ['count'],             minimum: 0,   maximum: 1_000_000 }],
  ['heart_rate',               { units: ['count/min', 'bpm'],  minimum: 20,  maximum: 300 }],
  ['resting_heart_rate',       { units: ['count/min', 'bpm'],  minimum: 20,  maximum: 200 }],
  ['hrv',                      { units: ['ms'],                minimum: 1,   maximum: 1_000 }],
  ['spo2',                     { units: ['%', 'percent'],      minimum: 50,  maximum: 100 }],
  ['weight',                   { units: ['kg'],                minimum: 1,   maximum: 500 }],
  ['height',                   { units: ['cm'],                minimum: 30,  maximum: 300 }],
  ['sleep',                    { units: ['minutes', 'min'],    minimum: 0,   maximum: 1_440 }],
  ['workout',                  { units: ['minutes', 'min'],    minimum: 0,   maximum: 1_440 }],
  ['respiratory_rate',         { units: ['count/min', 'br/min'], minimum: 1, maximum: 120 }],
  ['temperature',              { units: ['°C', 'degC'],        minimum: -10, maximum: 50 }],
  ['blood_glucose',            { units: ['mg/dL', 'mmol/L'],   minimum: 20,  maximum: 1_000 }],
  ['glucose',                  { units: ['mg/dL', 'mmol/L'],   minimum: 20,  maximum: 1_000 }],
  ['blood_pressure_systolic',  { units: ['mmHg'],              minimum: 40,  maximum: 300 }],
  ['blood_pressure_diastolic', { units: ['mmHg'],              minimum: 30,  maximum: 200 }],
  ['vo2_max',                  { units: ['mL/kg/min'],         minimum: 10,  maximum: 100 }],
  ['calories',                 { units: ['kcal', 'calories'],  minimum: 0,   maximum: 50_000 }],
  ['distance',                 { units: ['m', 'km'],           minimum: 0,   maximum: 500_000 }],
  ['hydration',                { units: ['mL', 'L', 'ml', 'l'], minimum: 0,   maximum: 50_000 }],
]);


const CONSENT_TYPES = new Set([
  'tos',
  'privacy_policy',
  'health_data',
  'data_access',
  'document_upload',
  'wearable_sync',
  'ai_processing',
]);
const GENDERS = new Set(['male', 'female', 'other', 'prefer_not_to_say']);

const FUTURE_TOLERANCE_MS = 5 * 60_000;

function validationError(message, details) {
  throw new ApplicationError(message, 422, 'validation_error', details);
}

export function requireText(value, field, { maxLength = 500 } = {}) {
  if (typeof value !== 'string' || value.trim() === '') {
    validationError(`${field} is required`, [{ field, message: 'Required.' }]);
  }
  const text = value.trim();
  if (text.length > maxLength) {
    validationError(`${field} is too long`, [{ field, message: `Must be at most ${maxLength} characters.` }]);
  }
  return text;
}

export function validateConsent(consent = {}) {
  const type = requireText(consent.type, 'consent type', { maxLength: 50 });
  const version = requireText(consent.version, 'consent version', { maxLength: 50 });

  if (!CONSENT_TYPES.has(type) || typeof consent.granted !== 'boolean') {
    validationError('consent is invalid', [{ field: 'type', message: 'Unsupported consent type or missing granted value.' }]);
  }

  return { type, version, granted: consent.granted };
}

export function validateProfileUpdate(input = {}) {
  const errors = [];
  const profile = {};

  const combinedName = input.fullName || [input.firstName, input.lastName].filter(Boolean).join(' ') || undefined;
  if (combinedName !== undefined) {
    if (typeof combinedName !== 'string' || combinedName.trim() === '') {
      errors.push({ field: 'fullName', message: 'fullName must be a non-empty string.' });
    } else if (combinedName.trim().length > 200) {
      errors.push({ field: 'fullName', message: 'fullName must be at most 200 characters.' });
    } else {
      profile.fullName = combinedName.trim();
    }
  }

  if (input.dob !== undefined) {
    const dobTimestamp = Date.parse(input.dob);
    if (Number.isNaN(dobTimestamp) || new Date(dobTimestamp) > new Date()) {
      errors.push({ field: 'dob', message: 'dob must be a valid date in the past (YYYY-MM-DD).' });
    } else {
      profile.dob = new Date(dobTimestamp).toISOString().split('T')[0];
    }
  }

  const rawGender = input.gender || input.biologicalSex;
  if (rawGender !== undefined) {
    if (!GENDERS.has(rawGender)) {
      errors.push({ field: 'gender', message: `gender must be one of: ${[...GENDERS].join(', ')}` });
    } else {
      profile.gender = rawGender;
    }
  }

  if (input.heightCm !== undefined) {
    const h = Number(input.heightCm);
    if (Number.isNaN(h) || h < 30 || h > 300) {
      errors.push({ field: 'heightCm', message: 'heightCm must be between 30 and 300 cm.' });
    } else {
      profile.heightCm = Math.round(h * 100) / 100;
    }
  }

  if (input.weightKg !== undefined) {
    const w = Number(input.weightKg);
    if (Number.isNaN(w) || w < 1 || w > 500) {
      errors.push({ field: 'weightKg', message: 'weightKg must be between 1 and 500 kg.' });
    } else {
      profile.weightKg = Math.round(w * 100) / 100;
    }
  }

  if (input.timezone !== undefined) {
    if (typeof input.timezone !== 'string' || input.timezone.trim() === '') {
      errors.push({ field: 'timezone', message: 'timezone must be a non-empty string.' });
    } else {
      const tz = input.timezone.trim();
      let valid = false;
      try {
        if (typeof Intl !== 'undefined' && typeof Intl.supportedValuesOf === 'function') {
          valid = Intl.supportedValuesOf('timeZone').includes(tz);
        } else {
          Intl.DateTimeFormat(undefined, { timeZone: tz });
          valid = true;
        }
      } catch {
        valid = false;
      }
      if (!valid) {
        errors.push({ field: 'timezone', message: 'timezone must be a valid IANA time zone identifier (e.g. Asia/Kolkata, America/New_York).' });
      } else {
        profile.timezone = tz;
      }
    }
  }

  if (errors.length) {
    validationError('Profile validation failed', errors);
  }

  return profile;
}

export function validatePhoneConnection(connection = {}) {
  const provider = requireText(connection.provider, 'provider', { maxLength: 50 }).toLowerCase();

  if (!PHONE_PROVIDERS.has(provider)) {
    validationError('provider must be apple_health, health_connect, or phone_pedometer',
      [{ field: 'provider', message: 'Only local phone health sources are supported.' }]);
  }
  if (!Array.isArray(connection.permissions)) {
    validationError('permissions must be an array',
      [{ field: 'permissions', message: 'Provide the categories granted by the user.' }]);
  }

  const permissions = [...new Set(
    connection.permissions.map((p) => requireText(p, 'permissions[]', { maxLength: 50 })),
  )];
  const invalidPermissions = permissions.filter((p) => !HEALTH_METRICS.has(p));

  if (invalidPermissions.length) {
    validationError('permissions contain unsupported metrics',
      invalidPermissions.map((p) => ({ field: 'permissions', message: `${p} is not supported.` })));
  }

  const deviceId = connection.deviceId === undefined
    ? null
    : requireText(connection.deviceId, 'deviceId', { maxLength: 255 });

  const hardwareId = connection.hardwareId === undefined
    ? null
    : requireText(connection.hardwareId, 'hardwareId', { maxLength: 255 });

  const platform = connection.platform === 'ios' ? 'ios' : 'android';
  const status = connection.status === 'error' ? 'error'
    : connection.status === 'disconnected' ? 'disconnected'
    : 'connected';

  const error = connection.error
    ? requireText(connection.error, 'error', { maxLength: 500 })
    : null;

  return { provider, permissions, deviceId, hardwareId, platform, status, error };
}

export function validateHealthBatch(input, batchLimit) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    validationError('Request body must be an object.', [{ field: 'body', message: 'Expected a JSON object.' }]);
  }
  if (!Array.isArray(input.samples)) {
    validationError('samples must be an array', [{ field: 'samples', message: 'Expected an array.' }]);
  }
  if (input.samples.length > batchLimit) {
    validationError(`samples cannot contain more than ${batchLimit} records`,
      [{ field: 'samples', message: 'Send smaller batches.' }]);
  }

  const samples = input.samples.map((sample, index) => validateHealthSample(sample, index));
  return { samples };
}

export function validateHealthSample(sample = {}, index = 0) {
  const fieldPrefix = `samples[${index}]`;

  if (!sample || typeof sample !== 'object' || Array.isArray(sample)) {
    validationError('Each sample must be an object', [{ field: fieldPrefix, message: 'Expected an object.' }]);
  }

  let rawProvider = sample.provider !== undefined && sample.provider !== null
    ? String(sample.provider).trim().toLowerCase()
    : (sample.source ? String(sample.source).trim().toLowerCase() : 'manual');
  if (rawProvider === 'manual_entry') rawProvider = 'manual';
  const provider = requireText(rawProvider, `${fieldPrefix}.provider`, { maxLength: 50 });
  
  let rawMetric = sample.metric !== undefined && sample.metric !== null ? String(sample.metric).trim().toLowerCase() : '';
  const metric = requireText(rawMetric, `${fieldPrefix}.metric`, { maxLength: 50 });
  
  const idValue = sample.externalId || sample.id;
  const externalId = idValue
    ? requireText(String(idValue), `${fieldPrefix}.externalId`, { maxLength: 255 })
    : `${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    
  const recordedAtValue = sample.recordedAt || sample.end || sample.start;
  const recordedAt = recordedAtValue
    ? requireText(String(recordedAtValue), `${fieldPrefix}.recordedAt`, { maxLength: 64 })
    : new Date().toISOString();

  let rawUnit = sample.unit !== undefined && sample.unit !== null ? String(sample.unit).trim() : '';
  if (!rawUnit) {
    if (metric === 'steps') rawUnit = 'count';
    else if (metric === 'heart_rate') rawUnit = 'bpm';
    else if (metric === 'sleep') rawUnit = 'min';
    else if (metric === 'spo2') rawUnit = '%';
    else if (metric === 'calories') rawUnit = 'kcal';
    else if (metric === 'blood_glucose' || metric === 'glucose') rawUnit = 'mg/dL';
  }
  const unit = requireText(rawUnit, `${fieldPrefix}.unit`, { maxLength: 30 });

  const rule = HEALTH_METRICS.get(metric);
  if (!ALL_PROVIDERS.has(provider) || !rule) {
    validationError('provider or metric is invalid',
      [{ field: fieldPrefix, message: 'Only supported health providers and metrics may be uploaded.' }]);
  }

  if (typeof sample.value !== 'number' || !Number.isFinite(sample.value)
      || sample.value < rule.minimum || sample.value > rule.maximum) {
    validationError('sample value is outside the accepted range',
      [{ field: `${fieldPrefix}.value`, message: `Use a number from ${rule.minimum} to ${rule.maximum}.` }]);
  }
  if (!rule.units.includes(unit)) {
    validationError('sample unit is invalid',
      [{ field: `${fieldPrefix}.unit`, message: `Expected ${rule.units.join(' or ')}.` }]);
  }

  const timestamp = Date.parse(recordedAt);
  if (Number.isNaN(timestamp) || timestamp > Date.now() + FUTURE_TOLERANCE_MS) {
    validationError('recordedAt must be a valid non-future ISO date',
      [{ field: `${fieldPrefix}.recordedAt`, message: 'Use an ISO-8601 timestamp no more than five minutes in the future.' }]);
  }

  const deviceId = sample.deviceId
    ? requireText(sample.deviceId, `${fieldPrefix}.deviceId`, { maxLength: 255 })
    : null;

  return { provider, metric, externalId, recordedAt: new Date(timestamp).toISOString(), unit, value: sample.value, deviceId };
}

export function validateIdempotencyKey(value) {
  if (value === undefined) return null;
  if (typeof value !== 'string' || !UUID_PATTERN.test(value)) {
    validationError('Idempotency-Key must be a UUID',
      [{ field: 'Idempotency-Key', message: 'Use a UUID v4 or omit the header.' }]);
  }
  return value;
}

export { HEALTH_METRICS, PHONE_PROVIDERS, ALL_PROVIDERS, FUTURE_TOLERANCE_MS };
