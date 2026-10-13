import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/wellness_db',
});

async function inspectTables() {
  console.log('📊 Inspecting all tables and row counts in PostgreSQL...\n');

  const tablesRes = await pool.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name;
  `);

  const results = [];
  for (const row of tablesRes.rows) {
    const tableName = row.table_name;
    try {
      const countRes = await pool.query(`SELECT count(*) FROM "${tableName}"`);
      results.push({
        table: tableName,
        rows: parseInt(countRes.rows[0].count, 10),
      });
    } catch (err) {
      results.push({
        table: tableName,
        rows: -1,
        error: err.message,
      });
    }
  }

  console.table(results);

  console.log('\n🔍 Inspecting columns of empty tables:');
  const emptyTables = results.filter(r => r.rows === 0).map(r => r.table);
  for (const t of emptyTables) {
    const colRes = await pool.query(`
      SELECT column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position;
    `, [t]);
    console.log(`\nTable [${t}]:`);
    console.table(colRes.rows);
  }
  await pool.end();
}

inspectTables().catch(err => {
  console.error(err);
  process.exit(1);
});
