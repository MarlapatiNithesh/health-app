export async function ensurePatientAndConsent(client, patientId) {
  await client.query(
    `UPDATE members
        SET health_consent_at = COALESCE(health_consent_at, now()),
            health_consent_version = COALESCE(health_consent_version, '1.0'),
            updated_at = now()
      WHERE id = $1`,
    [patientId]
  ).catch(() => {});
  await client.query(
    `INSERT INTO patients (id, preferred_language, units_system, privacy_level)
     VALUES ($1, 'en-IN', 'metric', 'standard')
     ON CONFLICT (id) DO NOTHING`,
    [patientId]
  ).catch(() => {});
}
