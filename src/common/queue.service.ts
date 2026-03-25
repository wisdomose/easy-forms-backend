import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';

type QueueName = 'webhook-delivery' | 'analytics-aggregation' | 'retention-sweep';

@Injectable()
export class QueueService implements OnModuleInit, OnModuleDestroy {
  private connection?: IORedis;
  private queues = new Map<QueueName, Queue>();

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    if (!this.isEnabled()) {
      return;
    }

    this.connection = new IORedis(this.config.get<string>('REDIS_URL', 'redis://localhost:6379'), {
      lazyConnect: true,
      maxRetriesPerRequest: null,
    });

    await this.connection.connect();

    for (const name of ['webhook-delivery', 'analytics-aggregation', 'retention-sweep'] as const) {
      this.queues.set(
        name,
        new Queue(name, {
          connection: this.connection,
          defaultJobOptions: {
            removeOnComplete: 500,
            removeOnFail: 2000,
          },
        }),
      );
    }
  }

  async onModuleDestroy() {
    for (const queue of this.queues.values()) {
      await queue.close();
    }
    this.queues.clear();
    await this.connection?.quit();
  }

  isEnabled() {
    return this.config.get<boolean>('QUEUE_ENABLED', false);
  }

  async enqueue(name: QueueName, payload: Record<string, unknown>, delayMs = 0) {
    const queue = this.queues.get(name);
    if (!queue) {
      return null;
    }

    return queue.add(name, payload, { delay: delayMs });
  }
}
