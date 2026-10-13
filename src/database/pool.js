import pg from 'pg';

const { Pool } = pg;

export function createDatabasePool(databaseUrl) {
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for PostgreSQL connection pool');
  }

  const pool = new Pool({ connectionString: databaseUrl });

  pool.on('error', (error) => {
    console.error('[postgres-pool] Idle client error:', error.message);
  });

  return pool;
}

export async function withTransaction(poolOrClient, work) {
  if (typeof poolOrClient.query === 'function' && !poolOrClient.connect) {
    return work(poolOrClient);
  }

  const client = await poolOrClient.connect();
  try {
    await client.query('BEGIN');
    const result = await work(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
