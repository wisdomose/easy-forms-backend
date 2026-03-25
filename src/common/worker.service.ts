import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { DatabaseService } from './database.service';

@Injectable()
export class WorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    await this.ensureRecurringJobs();
    const pollMs = this.config.get<number>('WORKER_POLL_MS', 250);
    this.timer = setInterval(() => {
      void this.processPendingJobs();
    }, pollMs);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async enqueue(type: string, payload: Record<string, unknown>, runAt = new Date()) {
    await this.db.query(
      `INSERT INTO job_queue (id, job_type, payload_json, status, run_at)
       VALUES ($1, $2, $3::jsonb, 'pending', $4)`,
      [randomUUID(), type, JSON.stringify(payload), runAt.toISOString()],
    );
  }

  async processPendingJobs() {
    const jobs = await this.db.query<any>(
      `SELECT * FROM job_queue
       WHERE status IN ('pending', 'retry') AND run_at <= NOW()
       ORDER BY run_at ASC
       LIMIT 10`,
    );

    for (const job of jobs.rows) {
      try {
        await this.db.query('UPDATE job_queue SET status = $2, locked_at = NOW() WHERE id = $1', [job.id, 'processing']);
        await this.handleJob(job);
        await this.db.query('UPDATE job_queue SET status = $2, completed_at = NOW() WHERE id = $1', [job.id, 'completed']);
      } catch (error) {
        const attemptCount = Number(job.attempt_count ?? 0) + 1;
        const delayMinutes = Math.min(30, attemptCount * 5);
        await this.db.query(
          `UPDATE job_queue
           SET status = $2, attempt_count = $3, last_error = $4, run_at = NOW() + ($5 || ' minutes')::interval
           WHERE id = $1`,
          [job.id, attemptCount >= 5 ? 'failed' : 'retry', attemptCount, error instanceof Error ? error.message : 'Unknown error', String(delayMinutes)],
        );
      }
    }
  }

  private async ensureRecurringJobs() {
    const retentionJob = await this.db.query('SELECT id FROM job_queue WHERE job_type = $1 AND status IN ($2, $3, $4)', ['retention.sweep', 'pending', 'retry', 'processing']);
    if (!retentionJob.rowCount) {
      await this.enqueue('retention.sweep', {}, new Date());
    }
  }

  private async handleJob(job: any) {
    switch (job.job_type) {
      case 'webhook.delivery':
        await this.handleWebhookDelivery(job.payload_json);
        return;
      case 'analytics.aggregate':
        await this.handleAnalyticsAggregate(job.payload_json);
        return;
      case 'retention.sweep':
        await this.handleRetentionSweep();
        await this.enqueue('retention.sweep', {}, new Date(Date.now() + 24 * 60 * 60 * 1000));
        return;
      default:
        this.logger.warn(`Unknown job type ${job.job_type}`);
    }
  }

  private async handleWebhookDelivery(payload: any) {
    const delivery = await this.db.query<any>(
      `SELECT wd.id, wd.attempt_count, wd.webhook_id, wd.submission_id, wd.event_name, w.url, w.signing_secret, s.values_json
       FROM webhook_deliveries wd
       JOIN webhooks w ON w.id = wd.webhook_id
       JOIN submissions s ON s.id = wd.submission_id
       WHERE wd.id = $1`,
      [payload.delivery_id],
    );
    if (!delivery.rowCount) return;
    const item = delivery.rows[0];
    const body = JSON.stringify({ submission_id: item.submission_id, values: item.values_json });
    const signature = await import('crypto').then(({ createHmac }) => createHmac('sha256', item.signing_secret).update(body).digest('hex'));
    try {
      const response = await fetch(item.url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-formengine-signature': signature,
          'x-formengine-event': item.event_name,
          'x-formengine-delivery': item.id,
        },
        body,
        signal: AbortSignal.timeout(this.config.get<number>('WEBHOOK_TIMEOUT_MS', 4000)),
      });
      const responseBody = await response.text();
      await this.db.query(
        `UPDATE webhook_deliveries
         SET status = $2, attempt_count = attempt_count + 1, response_status = $3, response_body = $4, last_attempt_at = NOW(), next_attempt_at = NULL
         WHERE id = $1`,
        [item.id, response.ok ? 'delivered' : 'failed', response.status, responseBody],
      );
      if (!response.ok) {
        throw new Error(`Webhook responded with ${response.status}`);
      }
    } catch (error) {
      await this.db.query(
        `UPDATE webhook_deliveries
         SET status = 'failed', attempt_count = attempt_count + 1, response_body = $2, last_attempt_at = NOW(), next_attempt_at = NOW() + INTERVAL '5 minutes'
         WHERE id = $1`,
        [item.id, error instanceof Error ? error.message : 'Unknown error'],
      );
      throw error;
    }
  }

  private async handleAnalyticsAggregate(payload: any) {
    const column = payload.event_name === 'view'
      ? 'views_count'
      : payload.event_name === 'start'
        ? 'starts_count'
        : 'completes_count';

    await this.db.query(
      `INSERT INTO analytics_daily (id, form_id, event_date, ${column})
       VALUES ($1, $2, $3, 1)
       ON CONFLICT (form_id, event_date)
       DO UPDATE SET ${column} = analytics_daily.${column} + 1`,
      [randomUUID(), payload.form_id, payload.event_date],
    );
  }

  private async handleRetentionSweep() {
    const policies = await this.db.query<any>(
      `SELECT f.id AS form_id, COALESCE(fp.ttl_days, wp.ttl_days) AS ttl_days
       FROM forms f
       LEFT JOIN retention_policies fp ON fp.form_id = f.id
       LEFT JOIN retention_policies wp ON wp.workspace_id = f.workspace_id AND wp.form_id IS NULL
       WHERE COALESCE(fp.ttl_days, wp.ttl_days) IS NOT NULL`,
    );

    for (const policy of policies.rows) {
      await this.db.query(
        `DELETE FROM submissions
         WHERE form_id = $1 AND created_at < NOW() - ($2 || ' days')::interval`,
        [policy.form_id, String(policy.ttl_days)],
      );
    }
  }
}
