import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { MARKET_QUEUE } from '../queue/queue.constants';
import { QueueService } from '../queue/queue.service';
import { D } from '../trading/decimal.util';

@Injectable()
export class MarketWorker implements OnModuleInit, OnModuleDestroy {
  private readonly redis = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
  ) {}

  async onModuleInit() {
    await this.queues.marketQueue.add('tick-loop', {}, { repeat: { every: 1500 }, removeOnComplete: 100, removeOnFail: 100 });
    this.worker = new Worker(
      MARKET_QUEUE,
      async () => {
        const assets = await this.prisma.asset.findMany({ where: { isActive: true } });
        for (const asset of assets) {
          const latest = await this.prisma.marketTick.findFirst({
            where: { symbol: asset.symbol },
            orderBy: { ts: 'desc' },
          });
          const previous = D(latest?.price.toString() ?? '100');
          const drift = D((Math.random() - 0.5).toString()).mul('0.6');
          const price = DecimalMax(previous.plus(drift), D('0.01')).toFixed(8);

          await this.prisma.marketTick.create({
            data: {
              symbol: asset.symbol,
              price,
              ts: new Date(),
            },
          });
          await this.prisma.outboxEvent.create({
            data: {
              topic: 'MarketTickPublished',
              payload: { symbol: asset.symbol, price, ts: new Date().toISOString() },
            },
          });
        }
        await this.queues.outboxQueue.add('drain-outbox', {}, { removeOnComplete: 200, removeOnFail: 200 });
      },
      { connection: this.redis },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redis.quit();
  }
}

function DecimalMax(a: ReturnType<typeof D>, b: ReturnType<typeof D>) {
  return a.gte(b) ? a : b;
}
