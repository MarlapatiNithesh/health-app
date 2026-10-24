export const PROVIDER_CAPABILITIES = {
  garmin: { name: 'Garmin', type: 'oauth', connectionType: 'oauth', tier: 1 },
  oura: { name: 'Oura', type: 'oauth', connectionType: 'oauth', tier: 1 },
  whoop: { name: 'WHOOP', type: 'oauth', connectionType: 'oauth', tier: 1 },
  fitbit: { name: 'Fitbit', type: 'oauth', connectionType: 'oauth', tier: 2 },
  polar: { name: 'Polar', type: 'oauth', connectionType: 'oauth', tier: 2 },
  suunto: { name: 'Suunto', type: 'oauth', connectionType: 'oauth', tier: 2 },
  coros: { name: 'COROS', type: 'oauth', connectionType: 'oauth', tier: 2 },
  ringconn: { name: 'RingConn', type: 'oauth', connectionType: 'oauth', tier: 2 },
  withings: { name: 'Withings', type: 'oauth', connectionType: 'oauth', tier: 2 },
  ultrahuman: { name: 'Ultrahuman', type: 'oauth', connectionType: 'oauth', tier: 2 },

  apple_watch: {
    name: 'Apple Watch',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'apple_health',
    tier: 2,
    instructions: 'Connect via Apple Health on your iPhone settings.',
  },
  samsung_health: {
    name: 'Samsung Health',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'health_connect',
    tier: 2,
    instructions: 'Connect via Health Connect on your Android phone settings.',
  },
  apple_health: {
    name: 'Apple Health',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'apple_health',
    tier: 3,
  },
  health_connect: {
    name: 'Health Connect',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'health_connect',
    tier: 3,
  },

  inbody: {
    name: 'InBody',
    type: 'manual',
    connectionType: 'manual',
    tier: 2,
    instructions: 'Add measurements or connect manually via manual device entry.',
  },
  glucobase_cgm: {
    name: 'GlucoBase CGM',
    type: 'manual',
    connectionType: 'manual',
    tier: 2,
    instructions: 'Add glucose readings or connect manually via manual device entry.',
  },
  manual: {
    name: 'Manual Entry',
    type: 'manual',
    connectionType: 'manual',
    tier: 4,
    instructions: 'Add measurements or readings manually.',
  },
};

export function getProviderConfig(provider) {
  if (!provider) return null;
  const key = String(provider).toLowerCase();
  return PROVIDER_CAPABILITIES[key] || null;
}

export function isOauthProvider(provider) {
  const cfg = getProviderConfig(provider);
  return cfg?.type === 'oauth';
}

export function isManualProvider(provider) {
  const cfg = getProviderConfig(provider);
  return cfg?.type === 'manual';
}

export function isPhoneSdkProvider(provider) {
  const cfg = getProviderConfig(provider);
  return cfg?.type === 'phone_sdk';
}

export function listSupportedProviders() {
  return Object.entries(PROVIDER_CAPABILITIES).map(([key, val]) => ({
    provider: key,
    name: val.name,
    connectionType: val.connectionType,
    type: val.type,
    via: val.via || null,
    tier: val.tier,
    instructions: val.instructions || null,
  }));
}
