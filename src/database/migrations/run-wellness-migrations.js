import { readdir, readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32 } from 'node:zlib';
import pg from 'pg';

const { Pool } = pg;

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = resolve(__dirname, '..', '..', '..');
const DDL_DIR = join(PROJECT_ROOT, 'db', 'ddl');
const DML_DIR = join(PROJECT_ROOT, 'db', 'dml');

function computeFlywayChecksum(content) {
  const normalized = content.replace(/\r\n/g, '\n');
  return crc32(Buffer.from(normalized, 'utf8')) | 0;
}

async function ensureFlywayHistoryTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS flyway_schema_history (
      installed_rank INT NOT NULL,
      version VARCHAR(50),
      description VARCHAR(200) NOT NULL,
      type VARCHAR(20) NOT NULL DEFAULT 'SQL',
      script VARCHAR(1000) NOT NULL,
      checksum INT,
      installed_by VARCHAR(100) NOT NULL,
      installed_on TIMESTAMP NOT NULL DEFAULT now(),
      execution_time INT NOT NULL,
      success BOOLEAN NOT NULL,
      CONSTRAINT flyway_schema_history_pk PRIMARY KEY (installed_rank)
    );
    CREATE INDEX IF NOT EXISTS flyway_schema_history_s_idx 
      ON flyway_schema_history (success);
  `);
}

function parseScriptMetadata(filename) {
  const base = filename.replace(/\.sql$/i, '');
  const match = base.match(/^([Vv]?\d+)[_-]+(.*)$/);
  if (match) {
    return {
      version: match[1].replace(/^[Vv]/, ''),
      description: match[2].replace(/[_-]+/g, ' ').trim(),
    };
  }
  return {
    version: null,
    description: base.replace(/[_-]+/g, ' ').trim(),
  };
}

async function collectScripts(dir, label) {
  try {
    const allFiles = await readdir(dir);
    return allFiles
      .filter((file) => file.endsWith('.sql'))
      .map((filename) => {
        const metadata = parseScriptMetadata(filename);
        return {
          filename,
          filePath: join(dir, filename),
          label,
          version: metadata.version,
          description: metadata.description,
        };
      });
  } catch {
    return [];
  }
}

async function runSequentialMigrations(client) {
  const ddlScripts = await collectScripts(DDL_DIR, 'DDL');
  const dmlScripts = await collectScripts(DML_DIR, 'DML');

  const allScripts = [...ddlScripts, ...dmlScripts].sort((a, b) => {
    const verA = parseInt(a.version || '999999', 10);
    const verB = parseInt(b.version || '999999', 10);
    if (verA !== verB) return verA - verB;
    return a.filename.localeCompare(b.filename);
  });

  if (allScripts.length === 0) {
    console.log('No migration scripts found.');
    return;
  }

  console.log(`\nEvaluating ${allScripts.length} sequential migration file(s)…`);

  for (const script of allScripts) {
    const rawSql = await readFile(script.filePath, 'utf8');
    const sql = rawSql.replace(/^\uFEFF/, '');
    const checksum = computeFlywayChecksum(sql);

    const historyRes = await client.query(
      `SELECT installed_rank, version, script, checksum, success 
       FROM flyway_schema_history 
       WHERE script = $1 
       ORDER BY installed_rank DESC 
       LIMIT 1`,
      [script.filename],
    );

    const existing = historyRes.rows[0];

    if (existing && existing.success) {
      if (existing.checksum === checksum) {
        console.log(`  ✓ [${script.label} ${script.version}] ${script.filename} - Up to date, skipped`);
        continue;
      } else if (process.env.FLYWAY_REPAIR === 'true' || process.env.AUTO_REPAIR_MIGRATIONS === 'true') {
        console.log(`  ⚠️ [${script.label} ${script.version}] Checksum updated for ${script.filename}; reapplying in repair mode…`);
      } else {
        throw new Error(
          `Flyway Checksum Mismatch for ${script.filename} (Version ${script.version})!\n` +
          `  -> Applied to database : ${existing.checksum}\n` +
          `  -> Resolved locally    : ${checksum}\n` +
          `Applied migrations are immutable. Create a new sequential migration script or run repair (FLYWAY_REPAIR=true).`
        );
      }
    } else {
      console.log(`  → [${script.label} ${script.version}] Applying: ${script.filename}…`);
    }

    const startTime = Date.now();
    try {
      let executableSql = sql;
      const hasVectorRes = await client.query("SELECT 1 FROM pg_available_extensions WHERE name = 'vector'");
      if (hasVectorRes.rowCount === 0) {
        executableSql = executableSql
          .replace(/CREATE EXTENSION IF NOT EXISTS vector;/g, '')
          .replace(/vector\(768\)/g, 'float8[]')
          .replace(/CREATE INDEX IF NOT EXISTS idx_ce_embedding ON clinical_embeddings\s+USING ivfflat[^;]+;/gs, '')
          .replace(/CREATE INDEX IF NOT EXISTS idx_guideline_embedding ON guideline_embeddings\s+USING ivfflat[^;]+;/gs, '');
      }

      await client.query('BEGIN');
      await client.query(executableSql);
      await client.query('COMMIT');
      const executionTime = Date.now() - startTime;

      if (existing) {
        await client.query(
          `UPDATE flyway_schema_history 
           SET checksum = $1, execution_time = $2, installed_on = now(), success = true
           WHERE installed_rank = $3`,
          [checksum, executionTime, existing.installed_rank],
        );
        console.log(`  ✓ [${script.label}] ${script.filename} updated in ${executionTime}ms`);
      } else {
        const rankRes = await client.query('SELECT COALESCE(MAX(installed_rank), 0) + 1 AS next_rank FROM flyway_schema_history');
        const nextRank = rankRes.rows[0].next_rank;

        await client.query(
          `INSERT INTO flyway_schema_history 
             (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
           VALUES ($1, $2, $3, 'SQL', $4, $5, 'migration-runner', $6, true)`,
          [nextRank, script.version, script.description, script.filename, checksum, executionTime],
        );
        console.log(`  ✓ [${script.label}] ${script.filename} applied in ${executionTime}ms (Rank: ${nextRank})`);
      }
    } catch (error) {
      await client.query('ROLLBACK');

      if (!existing) {
        const rankRes = await client.query('SELECT COALESCE(MAX(installed_rank), 0) + 1 AS next_rank FROM flyway_schema_history');
        const nextRank = rankRes.rows[0].next_rank;
        await client.query(
          `INSERT INTO flyway_schema_history 
             (installed_rank, version, description, type, script, checksum, installed_by, execution_time, success)
           VALUES ($1, $2, $3, 'SQL', $4, $5, 'migration-runner', $6, false)`,
          [nextRank, script.version, script.description, script.filename, checksum, Date.now() - startTime],
        );
      }
      throw new Error(`Execution of "${script.filename}" failed: ${error.message}`);
    }
  }
}

async function runDatabaseSetup() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('ERROR: DATABASE_URL environment variable is not set.');
    process.exit(1);
  }

  const pool = new Pool({ connectionString: databaseUrl });

  let client;
  try {
    client = await pool.connect();
    await ensureFlywayHistoryTable(client);
    await runSequentialMigrations(client);
    console.log('\nAll migrations executed successfully in sequence.');
  } finally {
    client?.release();
    await pool.end();
  }
}

runDatabaseSetup().catch((error) => {
  console.error('Database setup failed:', error.message);
  process.exit(1);
});
