import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Worker } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaService } from '../database/prisma.service';
import { MATCHING_QUEUE } from '../queue/queue.constants';
import { D } from './decimal.util';
import { minDecimal } from './matching.math';
import { AppLogger } from '../common/logging/app-logger.service';

@Injectable()
export class MatchingWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MatchingWorker.name);
  private readonly redis = new IORedis({
    host: process.env.REDIS_HOST ?? 'localhost',
    port: Number(process.env.REDIS_PORT ?? 6379),
    maxRetriesPerRequest: null,
  });
  private worker?: Worker;

  constructor(
    private readonly prisma: PrismaService,
    private readonly appLogger: AppLogger,
  ) {}

  onModuleInit() {
    this.worker = new Worker(
      MATCHING_QUEUE,
      async (job) => {
        const symbol = String(job.data.symbol);
        await this.matchSymbol(symbol);
      },
      { connection: this.redis, concurrency: 4 },
    );
  }

  async onModuleDestroy() {
    await this.worker?.close();
    await this.redis.quit();
  }

  private async matchSymbol(symbol: string) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SELECT pg_advisory_xact_lock(hashtext($1))', symbol);

      while (true) {
        const buyOrders = await tx.$queryRawUnsafe<
          Array<{ id: string; user_id: string; limit_price: string; remaining_qty: string; reserved_cash: string }>
        >(
          `SELECT id, user_id, limit_price::text, remaining_qty::text, reserved_cash::text
           FROM orders
           WHERE symbol = $1 AND side = 'BUY' AND status IN ('OPEN','PARTIALLY_FILLED')
           ORDER BY limit_price DESC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          symbol,
        );
        const sellOrders = await tx.$queryRawUnsafe<
          Array<{ id: string; user_id: string; limit_price: string; remaining_qty: string; reserved_qty: string }>
        >(
          `SELECT id, user_id, limit_price::text, remaining_qty::text, reserved_qty::text
           FROM orders
           WHERE symbol = $1 AND side = 'SELL' AND status IN ('OPEN','PARTIALLY_FILLED')
           ORDER BY limit_price ASC, created_at ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          symbol,
        );

        const buy = buyOrders[0];
        const sell = sellOrders[0];
        if (!buy || !sell) break;
        if (D(buy.limit_price).lt(sell.limit_price)) break;
        if (buy.user_id === sell.user_id) {
          await tx.$executeRawUnsafe(
            `UPDATE orders
             SET status = 'CANCELLED'::"OrderStatus", updated_at = NOW()
             WHERE id = $1`,
            buy.id,
          );
          await tx.outboxEvent.create({
            data: {
              topic: 'RiskRejected',
              payload: { reason: 'self_trade_prevention', orderId: buy.id, userId: buy.user_id, symbol },
            },
          });
          continue;
        }

        const execPrice = D(sell.limit_price);
        const execQty = minDecimal(buy.remaining_qty, sell.remaining_qty);
        const tradeCash = execPrice.mul(execQty);

        const nextBuyRemaining = D(buy.remaining_qty).minus(execQty);
        const nextSellRemaining = D(sell.remaining_qty).minus(execQty);

        await tx.$executeRawUnsafe(
          `UPDATE orders
           SET remaining_qty = $2::numeric,
               status = CASE WHEN $2::numeric = 0 THEN 'FILLED'::"OrderStatus" ELSE 'PARTIALLY_FILLED'::"OrderStatus" END,
               reserved_cash = GREATEST(reserved_cash - $3::numeric, 0),
               updated_at = NOW()
           WHERE id = $1`,
          buy.id,
          nextBuyRemaining.toFixed(8),
          tradeCash.toFixed(8),
        );

        await tx.$executeRawUnsafe(
          `UPDATE orders
           SET remaining_qty = $2::numeric,
               status = CASE WHEN $2::numeric = 0 THEN 'FILLED'::"OrderStatus" ELSE 'PARTIALLY_FILLED'::"OrderStatus" END,
               reserved_qty = GREATEST(reserved_qty - $3::numeric, 0),
               updated_at = NOW()
           WHERE id = $1`,
          sell.id,
          nextSellRemaining.toFixed(8),
          execQty.toFixed(8),
        );

        await tx.$executeRawUnsafe(
          `UPDATE accounts
           SET reserved_cash = GREATEST(reserved_cash - $2::numeric, 0),
               available_cash = CASE
                 WHEN $3::numeric = 0 THEN available_cash + GREATEST((SELECT reserved_cash FROM orders WHERE id = $4), 0)
                 ELSE available_cash
               END,
               updated_at = NOW()
           WHERE user_id = $1`,
          buy.user_id,
          tradeCash.toFixed(8),
          nextBuyRemaining.toFixed(8),
          buy.id,
        );
        if (nextBuyRemaining.eq(0)) {
          await tx.$executeRawUnsafe(
            'UPDATE orders SET reserved_cash = 0, updated_at = NOW() WHERE id = $1',
            buy.id,
          );
        }

        await tx.$executeRawUnsafe(
          `UPDATE accounts
           SET available_cash = available_cash + $2::numeric,
               updated_at = NOW()
           WHERE user_id = $1`,
          sell.user_id,
          tradeCash.toFixed(8),
        );

        await tx.$executeRawUnsafe(
          `UPDATE holdings
             SET available_qty = available_qty + $3::numeric,
                 avg_cost = CASE
                   WHEN (available_qty + reserved_qty + $3::numeric) = 0 THEN 0
                   ELSE ((avg_cost * (available_qty + reserved_qty)) + ($2::numeric * $3::numeric)) / (available_qty + reserved_qty + $3::numeric)
                 END,
                 updated_at = NOW()
           WHERE user_id = $1 AND symbol = $4`,
          buy.user_id,
          execPrice.toFixed(8),
          execQty.toFixed(8),
          symbol,
        );

        await tx.$executeRawUnsafe(
          `UPDATE holdings
           SET reserved_qty = GREATEST(reserved_qty - $3::numeric, 0),
               realized_pnl = realized_pnl + (($2::numeric - avg_cost) * $3::numeric),
               updated_at = NOW()
           WHERE user_id = $1 AND symbol = $4`,
          sell.user_id,
          execPrice.toFixed(8),
          execQty.toFixed(8),
          symbol,
        );

        await tx.$executeRawUnsafe(
          `INSERT INTO holdings (user_id, symbol, available_qty, reserved_qty, avg_cost, updated_at)
           SELECT $1, $2, $3::numeric, 0, $4::numeric, NOW()
           WHERE NOT EXISTS (SELECT 1 FROM holdings WHERE user_id = $1 AND symbol = $2)`,
          buy.user_id,
          symbol,
          execQty.toFixed(8),
          execPrice.toFixed(8),
        );

        await tx.$executeRawUnsafe(
          `INSERT INTO order_fills (id, symbol, price, qty, maker_order_id, taker_order_id, maker_user_id, taker_user_id, executed_at)
           VALUES (gen_random_uuid(), $1, $2::numeric, $3::numeric, $4, $5, $6, $7, NOW())`,
          symbol,
          execPrice.toFixed(8),
          execQty.toFixed(8),
          sell.id,
          buy.id,
          sell.user_id,
          buy.user_id,
        );

        await tx.outboxEvent.createMany({
          data: [
            { topic: 'TradeExecuted', payload: { symbol, buyOrderId: buy.id, sellOrderId: sell.id, price: execPrice.toFixed(8), qty: execQty.toFixed(8) } },
            { topic: 'OrderBookUpdated', payload: { symbol } },
            { topic: 'OrderUpdated', payload: { orderId: buy.id } },
            { topic: 'OrderUpdated', payload: { orderId: sell.id } },
            { topic: 'PortfolioChanged', payload: { userId: buy.user_id } },
            { topic: 'PortfolioChanged', payload: { userId: sell.user_id } },
          ],
        });
        this.appLogger.info('trade.executed', {
          symbol,
          buyOrderId: buy.id,
          sellOrderId: sell.id,
          qty: execQty.toFixed(8),
          price: execPrice.toFixed(8),
        });
      }
    });
    this.logger.debug(`Matched symbol ${symbol}`);
  }
}
