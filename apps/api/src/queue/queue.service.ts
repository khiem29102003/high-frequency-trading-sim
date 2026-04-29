import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { Queue } from 'bullmq';
import IORedis from 'ioredis';
import { LEADERBOARD_QUEUE, MARKET_QUEUE, MATCHING_QUEUE, OUTBOX_QUEUE } from './queue.constants';

@Injectable()
export class QueueService implements OnModuleDestroy {
  private readonly redis = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });

  readonly matchingQueue = new Queue(MATCHING_QUEUE, { connection: this.redis });
  readonly marketQueue = new Queue(MARKET_QUEUE, { connection: this.redis });
  readonly outboxQueue = new Queue(OUTBOX_QUEUE, { connection: this.redis });
  readonly leaderboardQueue = new Queue(LEADERBOARD_QUEUE, { connection: this.redis });

  ping() {
    return this.redis.ping();
  }

  async stats() {
    const [matchingWaiting, marketWaiting, outboxWaiting] = await Promise.all([
      this.matchingQueue.getWaitingCount(),
      this.marketQueue.getWaitingCount(),
      this.outboxQueue.getWaitingCount(),
    ]);
    return {
      matchingWaiting,
      marketWaiting,
      outboxWaiting,
    };
  }

  onModuleDestroy() {
    return Promise.all([
      this.matchingQueue.close(),
      this.marketQueue.close(),
      this.outboxQueue.close(),
      this.leaderboardQueue.close(),
      this.redis.quit(),
    ]).then(() => undefined);
  }
}
