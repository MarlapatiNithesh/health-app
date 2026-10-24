export function loadConfig(environment = process.env) {
  const port = Number(environment.PORT ?? 3000);
  const healthBatchLimit = Number(environment.HEALTH_BATCH_LIMIT ?? 200);

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535');
  }
  if (!Number.isInteger(healthBatchLimit) || healthBatchLimit < 1 || healthBatchLimit > 500) {
    throw new Error('HEALTH_BATCH_LIMIT must be an integer between 1 and 500');
  }

  const isProduction = environment.NODE_ENV === 'production';
  if (isProduction) {
    if (!environment.DATABASE_URL) {
      throw new Error('DATABASE_URL is required in production');
    }
    if (!environment.JWT_SECRET || environment.JWT_SECRET.length < 32) {
      throw new Error('JWT_SECRET must be at least 32 characters in production');
    }
    if (!environment.WEBHOOK_SECRET) {
      throw new Error('WEBHOOK_SECRET is required in production');
    }
    if (!environment.OPEN_WEARABLES_API_KEY) {
      throw new Error('OPEN_WEARABLES_API_KEY is required in production');
    }
    if (!environment.REDIRECT_ALLOWLIST && !environment.ALLOWED_REDIRECT_URLS) {
      throw new Error('REDIRECT_ALLOWLIST is required in production');
    }
  }

  return {
    port,
    databaseUrl: environment.DATABASE_URL,
    jwtSecret: environment.JWT_SECRET,
    healthBatchLimit,
    webhookSecret: environment.WEBHOOK_SECRET,
    openWearablesBaseUrl: environment.OPEN_WEARABLES_BASE_URL,
    openWearablesApiKey: environment.OPEN_WEARABLES_API_KEY,
    redirectAllowlist: environment.REDIRECT_ALLOWLIST || environment.ALLOWED_REDIRECT_URLS || '',
    twilioAccountSid: environment.TWILIO_ACCOUNT_SID || null,
    twilioAuthToken: environment.TWILIO_AUTH_TOKEN || null,
    twilioVerifyServiceSid: environment.TWILIO_VERIFY_SERVICE_SID || null,
  };
}
