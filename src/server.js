import { createApp } from './app.js';
import { loadConfig } from './config/env.js';
import { logger } from './logger.js';
import { createDatabasePool } from './database/pool.js';
import { exec } from 'node:child_process';

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function start() {
  const config = loadConfig();
  let pool = null;

  if (config.databaseUrl) {
    try {
      const candidatePool = createDatabasePool(config.databaseUrl);
      await candidatePool.query('SELECT 1');
      pool = candidatePool;
      logger.info('Connected to PostgreSQL database');
    } catch (err) {
      logger.error('Failed to connect to PostgreSQL database', { error: err.message });
      throw err;
    }
  } else {
    throw new Error('DATABASE_URL is required to start the server');
  }

  const { app } = createApp({
    ...config,
    pool,
  });

  const server = app.listen(config.port, '0.0.0.0', () => {
    logger.info('Wellness App API started', {
      port: config.port,
      url: `http://localhost:${config.port}`,
    });

    const maintainAdbReverse = () => {
      exec(`adb reverse tcp:${config.port} tcp:${config.port}`, () => {});
      exec('adb reverse tcp:8081 tcp:8081', () => {});
    };
    maintainAdbReverse();
    const adbTimer = setInterval(maintainAdbReverse, 4000);
    if (adbTimer.unref) adbTimer.unref();
  });

  function shutdown() {
    logger.info('Shutdown signal received — draining connections…');

    const forceExit = setTimeout(() => {
      logger.error('Graceful shutdown timed out — forcing exit');
      process.exit(1);
    }, SHUTDOWN_TIMEOUT_MS);

    forceExit.unref();

    server.close(async () => {
      try {
        await pool?.end?.();
        logger.info('Shutdown complete');
        process.exit(0);
      } catch (error) {
        logger.error('Error during shutdown', { err: error.message });
        process.exit(1);
      }
    });
  }

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception captured in server runtime', { err: err?.message, stack: err?.stack });
  });

  process.on('unhandledRejection', (reason) => {
    logger.warn('Unhandled rejection captured in server runtime', { reason: reason?.message || String(reason) });
  });
}

start().catch((err) => {
  logger.error('Fatal startup error', { err: err.message });
  process.exit(1);
});
