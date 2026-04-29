import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { OrderStatus, OrderType, Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';
import { D } from './decimal.util';
import { PlaceOrderDto } from './dto/place-order.dto';
import { HistoryQueryDto } from './dto/history-query.dto';
import {
  InsufficientFundsException,
  InvalidOrderStateException,
} from '../common/exceptions/financial.exceptions';
import { RiskService } from '../risk/risk.service';
import { IdempotencyService } from '../idempotency/idempotency.service';
import { AppLogger } from '../common/logging/app-logger.service';
import { RequestContext } from '../common/context/request-context';

@Injectable()
export class TradingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queues: QueueService,
    private readonly riskService: RiskService,
    private readonly idempotencyService: IdempotencyService,
    private readonly logger: AppLogger,
  ) {}

  async placeOrder(userId: string, dto: PlaceOrderDto, idempotencyKey?: string) {
    RequestContext.setUserId(userId);
    const limitPrice = D(dto.limitPrice);
    const qty = D(dto.qty);
    if (limitPrice.lte(0) || qty.lte(0)) {
      throw new BadRequestException('limitPrice and qty must be > 0');
    }

    await this.riskService.preTradeCheck({
      userId,
      symbol: dto.symbol,
      side: dto.side,
      qty: dto.qty,
      limitPrice: dto.limitPrice,
    });

    const place = async () => this.prisma.$transaction(async (tx) => {
      const asset = await tx.asset.findUnique({ where: { symbol: dto.symbol } });
      if (!asset || !asset.isActive) {
        throw new NotFoundException('Asset not available');
      }

      await tx.$executeRawUnsafe(
        'SELECT user_id FROM accounts WHERE user_id = $1 FOR UPDATE',
        userId,
      );

      let reservedCash = new Prisma.Decimal(0);
      let reservedQty = new Prisma.Decimal(0);

      if (dto.side === 'BUY') {
        const requiredCash = limitPrice.mul(qty);
        const account = await tx.account.findUnique({ where: { userId } });
        if (!account) throw new NotFoundException('Account not found');
        if (D(account.availableCash.toString()).lt(requiredCash)) {
          throw new InsufficientFundsException('Insufficient available cash');
        }
        await tx.account.update({
          where: { userId },
          data: {
            availableCash: D(account.availableCash.toString()).minus(requiredCash).toFixed(8),
            reservedCash: D(account.reservedCash.toString()).plus(requiredCash).toFixed(8),
          },
        });
        reservedCash = new Prisma.Decimal(requiredCash.toFixed(8));
      } else {
        await tx.$executeRawUnsafe(
          'SELECT user_id, symbol FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE',
          userId,
          dto.symbol,
        );
        const holding = await tx.holding.findUnique({
          where: { userId_symbol: { userId, symbol: dto.symbol } },
        });
        if (!holding || D(holding.availableQty.toString()).lt(qty)) {
          throw new InsufficientFundsException('Insufficient available quantity');
        }
        await tx.holding.update({
          where: { userId_symbol: { userId, symbol: dto.symbol } },
          data: {
            availableQty: D(holding.availableQty.toString()).minus(qty).toFixed(8),
            reservedQty: D(holding.reservedQty.toString()).plus(qty).toFixed(8),
          },
        });
        reservedQty = new Prisma.Decimal(qty.toFixed(8));
      }

      const created = await tx.order.create({
        data: {
          userId,
          symbol: dto.symbol,
          side: dto.side,
          type: OrderType.LIMIT,
          limitPrice: limitPrice.toFixed(8),
          qty: qty.toFixed(8),
          remainingQty: qty.toFixed(8),
          status: OrderStatus.OPEN,
          reservedCash,
          reservedQty,
        },
      });

      await tx.outboxEvent.create({
        data: {
          topic: 'OrderCreated',
          payload: { orderId: created.id, userId, symbol: dto.symbol, side: dto.side, qty: qty.toFixed(8), limitPrice: limitPrice.toFixed(8) },
        },
      });
      await tx.outboxEvent.create({
        data: { topic: 'OrderBookUpdated', payload: { symbol: dto.symbol } },
      });

      return created;
    });

    const order = idempotencyKey
      ? (
          await this.idempotencyService.run(
            {
              userId,
              action: 'PLACE_ORDER',
              key: idempotencyKey,
              requestBody: dto,
            },
            place,
          )
        ).result
      : await place();

    await this.queues.matchingQueue.add(
      'match-symbol',
      { symbol: dto.symbol },
      { jobId: `${dto.symbol}-${Date.now()}`, removeOnComplete: 1000, removeOnFail: 1000 },
    );
    await this.queues.outboxQueue.add('drain-outbox', {}, { removeOnComplete: 500, removeOnFail: 500 });
    this.logger.info('order.created', {
      orderId: order.id,
      symbol: order.symbol,
      side: order.side,
      qty: order.qty.toString(),
      limitPrice: order.limitPrice.toString(),
    });
    return order;
  }

  async cancelOrder(userId: string, orderId: string, idempotencyKey?: string) {
    RequestContext.setUserId(userId);
    const cancel = async () => this.prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({ where: { id: orderId } });
      if (!order || order.userId !== userId) throw new NotFoundException('Order not found');
      if (order.status !== 'OPEN' && order.status !== 'PARTIALLY_FILLED') {
        throw new InvalidOrderStateException('Order is not cancellable');
      }

      await tx.$executeRawUnsafe(
        'SELECT id FROM orders WHERE id = $1 FOR UPDATE',
        order.id,
      );
      await tx.$executeRawUnsafe(
        'SELECT user_id FROM accounts WHERE user_id = $1 FOR UPDATE',
        userId,
      );

      if (order.side === 'BUY') {
        const account = await tx.account.findUnique({ where: { userId } });
        if (!account) throw new NotFoundException('Account not found');
        await tx.account.update({
          where: { userId },
          data: {
            availableCash: D(account.availableCash.toString()).plus(order.reservedCash.toString()).toFixed(8),
            reservedCash: D(account.reservedCash.toString()).minus(order.reservedCash.toString()).toFixed(8),
          },
        });
      } else {
        await tx.$executeRawUnsafe(
          'SELECT user_id, symbol FROM holdings WHERE user_id = $1 AND symbol = $2 FOR UPDATE',
          userId,
          order.symbol,
        );
        const holding = await tx.holding.findUnique({
          where: { userId_symbol: { userId, symbol: order.symbol } },
        });
        if (holding) {
          await tx.holding.update({
            where: { userId_symbol: { userId, symbol: order.symbol } },
            data: {
              availableQty: D(holding.availableQty.toString()).plus(order.reservedQty.toString()).toFixed(8),
              reservedQty: D(holding.reservedQty.toString()).minus(order.reservedQty.toString()).toFixed(8),
            },
          });
        }
      }

      const updated = await tx.order.update({
        where: { id: order.id },
        data: { status: OrderStatus.CANCELLED, remainingQty: '0', reservedCash: '0', reservedQty: '0' },
      });

      await tx.outboxEvent.create({
        data: {
          topic: 'OrderCancelled',
          payload: { orderId: updated.id, userId },
        },
      });
      await tx.outboxEvent.create({
        data: { topic: 'OrderBookUpdated', payload: { symbol: order.symbol } },
      });
      return updated;
    });
    const result = idempotencyKey
      ? (
          await this.idempotencyService.run(
            {
              userId,
              action: 'CANCEL_ORDER',
              key: idempotencyKey,
              requestBody: { orderId },
            },
            cancel,
          )
        ).result
      : await cancel();

    await this.queues.outboxQueue.add('drain-outbox', {}, { removeOnComplete: 500, removeOnFail: 500 });
    this.logger.info('order.updated', { orderId: result.id, status: result.status, action: 'cancel' });
    return result;
  }

  async history(userId: string, query: HistoryQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const where: Prisma.OrderWhereInput = { userId };
    if (query.side) where.side = query.side;

    const [orders, total] = await this.prisma.$transaction([
      this.prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      data: orders,
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }
}
