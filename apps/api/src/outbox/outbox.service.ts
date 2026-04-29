import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { OUTBOX_QUEUE } from '../queue/queue.constants';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { OrderBookService } from '../orderbook/orderbook.service';
import { PortfolioService } from '../portfolio/portfolio.service';

@Injectable()
export class OutboxService implements OnModuleInit, OnModuleDestroy {
  private readonly pub = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
  private readonly workerRedis = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly gateway: RealtimeGateway,
    private readonly orderBookService: OrderBookService,
    private readonly portfolioService: PortfolioService,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      OUTBOX_QUEUE,
      async () => this.drain(),
      { connection: this.workerRedis, concurrency: 2 },
    );
  }

  private async drain() {
    const events = await this.prisma.outboxEvent.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    for (const event of events) {
      await this.pub.publish(`hfts:${event.topic}`, JSON.stringify(event.payload));
      await this.forwardToWs(event.topic, event.payload as Record<string, unknown>);
      await this.prisma.outboxEvent.update({
        where: { id: event.id },
        data: { publishedAt: new Date() },
      });
    }
  }

  private async forwardToWs(topic: string, payload: Record<string, unknown>) {
    if (topic === 'MarketTickPublished') {
      this.gateway.emitMarket(String(payload.symbol), payload);
      return;
    }
    if (topic === 'OrderUpdated' || topic === 'OrderCreated' || topic === 'OrderCancelled') {
      if (payload.userId) this.gateway.emitOrderUpdate(String(payload.userId), payload);
      return;
    }
    if (topic === 'PortfolioChanged') {
      if (payload.userId) {
        const summary = await this.portfolioService.getPnlSummary(String(payload.userId));
        this.gateway.emitPortfolio(String(payload.userId), payload);
        this.gateway.emitPnl(String(payload.userId), summary);
      }
      return;
    }
    if (topic === 'TradeExecuted') this.gateway.emitTrade(payload);
    if (topic === 'OrderBookUpdated') {
      const symbol = String(payload.symbol);
      const depth = await this.orderBookService.getDepth(symbol);
      this.gateway.emitOrderbook(symbol, depth);
      return;
    }
    if (topic === 'RiskRejected' && payload.userId) {
      this.gateway.emitRisk(String(payload.userId), payload);
    }
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.pub.quit();
    await this.workerRedis.quit();
  }
}
