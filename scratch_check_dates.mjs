import pg from 'pg';
const pool = new pg.Pool({ connectionString: 'postgres://wellness_app:wellness_app@127.0.0.1:5433/wellness_db' });
const memberRes = await pool.query("SELECT id, phone, timezone FROM members WHERE id = '748c71a1-fe88-4464-ad88-17bc1bf3b715'");
console.log('Member:', memberRes.rows);

const stepsRes = await pool.query("SELECT local_date, metric_type, value, recorded_at, source_record_id FROM timeseries WHERE member_id = '748c71a1-fe88-4464-ad88-17bc1bf3b715' AND metric_type = 'steps' ORDER BY recorded_at DESC LIMIT 10");
console.log('Steps records:');
console.table(stepsRes.rows);

await pool.end();
