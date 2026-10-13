import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wellness_db',
});

async function testMemory() {
  console.log('Testing patient_memory relations and schema...\n');
  const patientsRes = await pool.query('SELECT * FROM patients LIMIT 5');
  console.log('Patients in DB:');
  console.table(patientsRes.rows);

  const sessionsRes = await pool.query('SELECT id, patient_id, status FROM chat_sessions LIMIT 5');
  console.log('Sessions in DB:');
  console.table(sessionsRes.rows);

  if (sessionsRes.rows.length > 0) {
    const s = sessionsRes.rows[0];
    const testVec = new Array(384).fill(0.01);
    const vecStr = `[${testVec.join(',')}]`;

    const hasVectorType = await pool.query("SELECT 1 FROM pg_type WHERE typname = 'vector'");
    console.log('pgvector installed?:', hasVectorType.rowCount > 0);

    try {
      if (hasVectorType.rowCount > 0) {
        const ins = await pool.query(
          `INSERT INTO patient_memory (patient_id, encounter_id, summary_text, embedding)
           VALUES ($1, $2, $3, $4::vector)
           RETURNING id, patient_id, encounter_id, summary_text, created_at`,
          [s.patient_id, s.id, 'Test clinical memory summary: Patient has controlled BP and normal vitals.', vecStr]
        );
        console.log('✅ Inserted memory row:', ins.rows[0]);
      } else {
        const ins = await pool.query(
          `INSERT INTO patient_memory (patient_id, encounter_id, summary_text, embedding)
           VALUES ($1, $2, $3, $4)
           RETURNING id, patient_id, encounter_id, summary_text, created_at`,
          [s.patient_id, s.id, 'Test clinical memory summary: Patient has controlled BP and normal vitals.', testVec]
        );
        console.log('✅ Inserted memory row:', ins.rows[0]);
      }

      const count = await pool.query('SELECT count(*) FROM patient_memory');
      console.log('Total rows in patient_memory now:', count.rows[0].count);

      // Test search
      const memoryRows = await pool.query(
        'SELECT id, summary_text, embedding FROM patient_memory WHERE patient_id = $1 ORDER BY created_at DESC LIMIT 5',
        [s.patient_id]
      );
      console.log('Retrieved Memory for patient:');
      console.table(memoryRows.rows.map(r => ({ id: r.id, summary: r.summary_text, vectorLength: r.embedding?.length })));
    } catch (err) {
      console.error('❌ Insert to patient_memory failed:', err);
    }
  }

  await pool.end();
}

testMemory().catch(console.error);
