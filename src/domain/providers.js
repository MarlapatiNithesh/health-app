export const PROVIDER_CAPABILITIES = {
  // Official OpenWearables providers (14 total):
  apple_health: {
    name: 'Apple Health',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'apple_health',
    tier: 1,
    instructions: 'Connect via Apple Health on your iOS device settings.',
  },
  health_connect: {
    name: 'Health Connect',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'health_connect',
    tier: 1,
    instructions: 'Connect via Health Connect on your Android phone settings.',
  },
  garmin: { name: 'Garmin', type: 'oauth', connectionType: 'oauth', tier: 1 },
  samsung_health: {
    name: 'Samsung Health',
    type: 'phone_sdk',
    connectionType: 'phone_sdk',
    via: 'health_connect',
    tier: 1,
    instructions: 'Connect via Samsung Health or Health Connect on your phone settings.',
  },
  google_health: {
    name: 'Google Health',
    type: 'oauth',
    connectionType: 'oauth',
    tier: 2,
    instructions: 'Connect your Google Health account through OpenWearables OAuth.',
  },
  withings: { name: 'Withings', type: 'oauth', connectionType: 'oauth', tier: 1 },
  oura: { name: 'Oura', type: 'oauth', connectionType: 'oauth', tier: 1 },
  suunto: { name: 'Suunto', type: 'oauth', connectionType: 'oauth', tier: 1 },
  polar: { name: 'Polar', type: 'oauth', connectionType: 'oauth', tier: 1 },
  sensorbio: { name: 'Sensor Bio', type: 'oauth', connectionType: 'oauth', tier: 1, instructions: 'Connect Sensor Bio biometric sensors.' },
  whoop: { name: 'WHOOP', type: 'oauth', connectionType: 'oauth', tier: 1 },
  strava: { name: 'Strava', type: 'oauth', connectionType: 'oauth', tier: 2, instructions: 'Connect your Strava account for workout and activity telemetry.' },
  ultrahuman: { name: 'Ultrahuman', type: 'oauth', connectionType: 'oauth', tier: 1 },
  fitbit: { name: 'Fitbit', type: 'oauth', connectionType: 'oauth', tier: 2 },

  // Universal Nearby Bluetooth BLE Method (for any nearby physical smartwatch: boAt, Fire-Boltt, Noise, Fitpass, etc.)
  bluetooth_ble: {
    name: 'Bluetooth Smartwatch',
    type: 'phone_sdk',
    connectionType: 'ble_direct',
    via: 'bluetooth_ble',
    tier: 1,
    instructions: 'Direct Bluetooth Low Energy pairing for GATT-compatible smartwatches and fitness trackers.',
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
  return Object.entries(PROVIDER_CAPABILITIES)
    .filter(([key]) => key !== 'manual' && key !== 'bluetooth_ble')
    .map(([key, val]) => ({
      provider: key,
      name: val.name,
      connectionType: val.connectionType,
      type: val.type,
      via: val.via || null,
      tier: val.tier,
      instructions: val.instructions || null,
    }));
}
