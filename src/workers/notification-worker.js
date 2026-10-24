import { Worker } from 'bullmq';
import { logger } from '../logger.js';

export class NotificationWorker {
  constructor({ pushService, notificationRepo, redisConnection, queueName = 'notification_push', concurrency = 10 }) {
    this.pushService      = pushService;
    this.notificationRepo = notificationRepo;
    this.redisConnection  = redisConnection;
    this.queueName        = queueName;
    this.concurrency      = concurrency;
    this.worker           = null;
  }

  start() {
    this.worker = new Worker(
      this.queueName,
      async (job) => {
        const { notificationId } = job.data;
        logger.info(`[NotifWorker] Processing job=${job.id} notifId=${notificationId}`);

        await this.pushService.sendById(notificationId);

        logger.info(`[NotifWorker] Completed job=${job.id} notifId=${notificationId}`);
      },
      {
        connection: this.redisConnection,
        concurrency: this.concurrency,
        limiter: { max: 100, duration: 1000 },
      },
    );

    this.worker.on('failed', (job, err) => {
      logger.error(`[NotifWorker] Job failed job=${job?.id}`, {
        err: err.message,
        notificationId: job?.data?.notificationId,
        attemptsMade: job?.attemptsMade,
      });

      if (job?.attemptsMade >= (job?.opts?.attempts ?? 3)) {
        this.notificationRepo
          .markFailed(job.data.notificationId, `Worker exhausted retries: ${err.message}`)
          .catch(() => {});
      }
    });

    this.worker.on('error', (err) => {
      logger.error('[NotifWorker] Worker error', { err: err.message });
    });

    logger.info(`[NotifWorker] Started. Queue="${this.queueName}" concurrency=${this.concurrency}`);
    return this;
  }

  async stop() {
    await this.worker?.close();
    logger.info('[NotifWorker] Stopped.');
  }
}

export class NotificationSchedulerWorker {
  constructor({ notificationRepo, pushService, intervalMs = 30_000 }) {
    this.repo     = notificationRepo;
    this.push     = pushService;
    this.interval = intervalMs;
    this._timer   = null;
  }

  start() {
    this._timer = setInterval(() => this.#tick(), this.interval);
    logger.info(`[NotifScheduler] Started. Polling every ${this.interval}ms`);
    this.#tick();
    return this;
  }

  stop() {
    clearInterval(this._timer);
    logger.info('[NotifScheduler] Stopped.');
  }

  async #tick() {
    try {
      const due = await this.repo.pollDue(50);
      if (!due.length) return;

      logger.info(`[NotifScheduler] ${due.length} notifications due for delivery`);

      await Promise.allSettled(due.map(async (notif) => {
        try {
          await this.repo.markEnqueued(notif.id);
          await this.push.enqueue(notif.id);
        } catch (err) {
          logger.error(`[NotifScheduler] Failed to enqueue notifId=${notif.id}`, { err: err.message });
        }
      }));
    } catch (err) {
      logger.error('[NotifScheduler] Tick error', { err: err.message });
    }
  }
}
