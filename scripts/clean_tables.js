import pg from 'pg';

async function main() {
  const client = new pg.Client({
    connectionString: 'postgres://wellness_app:wellness_app@127.0.0.1:5433/wellness_db',
  });
  await client.connect();

  const res = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  console.log('Tables found:');
  console.log(res.rows.map(r => r.table_name));

  // We truncate health samples, timeseries, wearable links, sync logs, etc.
  // Tables to truncate:
  const tablesToTruncate = [
    'timeseries',
    'sleep_sessions',
    'workouts',
    'health_scores',
    'sync_logs',
    'wearable_links',
    'phone_verification_sessions',
    'chat_feedback',
    'proactive_ping_health_events',
    'guideline_embeddings',
    'patient_memory_embeddings',
    'clinical_embeddings',
    'clinical_provenance',
    'clinical_records',
    'chat_sessions',
    'health_documents',
    'symptom_assessments'
  ];

  for (const table of tablesToTruncate) {
    const exists = res.rows.some(r => r.table_name === table);
    if (exists) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`✓ Truncated ${table}`);
      } catch (err) {
        console.error(`✗ Failed to truncate ${table}:`, err.message);
      }
    }
  }

  console.log('Truncation complete.');
  await client.end();
}

main().catch(console.error);
