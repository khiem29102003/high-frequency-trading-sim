import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { LEADERBOARD_QUEUE } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { LeaderboardService } from './leaderboard.service';

@Injectable()
export class LeaderboardWorker implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
  private worker?: Worker;

  constructor(
    private readonly queueService: QueueService,
    private readonly leaderboardService: LeaderboardService,
  ) {}

  async onModuleInit() {
    await this.queueService.leaderboardQueue.add(
      'refresh-leaderboard',
      {},
      { repeat: { every: 10000 }, removeOnComplete: 100, removeOnFail: 100 },
    );
    this.worker = new Worker(
      LEADERBOARD_QUEUE,
      async () => {
        await this.leaderboardService.refresh();
      },
      { connection: this.redis },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redis.quit();
  }
}
