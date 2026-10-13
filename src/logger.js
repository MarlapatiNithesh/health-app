const IS_PRODUCTION = process.env.NODE_ENV === 'production';
const PHI_LOG_REDACTION = process.env.PHI_LOG_REDACTION !== 'false';

const PHI_FIELDS = new Set([
  'name', 'email', 'phone', 'patientName', 'patient_name', 'firstName', 'lastName',
  'dob', 'dateOfBirth', 'ssn', 'address', 'password', 'token', 'authorization'
]);

function sanitizeMeta(meta) {
  if (!meta || !PHI_LOG_REDACTION) return meta;
  if (typeof meta !== 'object') return meta;
  
  const sanitized = Array.isArray(meta) ? [] : {};
  for (const [key, value] of Object.entries(meta)) {
    if (PHI_FIELDS.has(key)) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMeta(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

function format(level, message, meta = {}) {
  const safeMeta = sanitizeMeta(meta);
  if (IS_PRODUCTION) {
    return JSON.stringify({ level, time: new Date().toISOString(), msg: message, ...safeMeta });
  }

  const timestamp = new Date().toISOString();
  const badge = level.toUpperCase().padEnd(5);
  const metaString = Object.keys(safeMeta).length ? ' ' + JSON.stringify(safeMeta) : '';
  return `${timestamp} [${badge}] ${message}${metaString}`;
}

export const logger = {
  info(message, meta) {
    console.log(format('info', message, meta));
  },

  warn(message, meta) {
    console.warn(format('warn', message, meta));
  },

  error(message, meta) {
    console.error(format('error', message, meta));
  },

  debug(message, meta) {
    if (!IS_PRODUCTION) {
      console.log(format('debug', message, meta));
    }
  },
};
