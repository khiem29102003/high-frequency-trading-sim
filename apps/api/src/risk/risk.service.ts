import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { D } from '../trading/decimal.util';
import { RiskRejectedException } from '../common/exceptions/financial.exceptions';
import { OrderSide } from '@prisma/client';
import { AppLogger } from '../common/logging/app-logger.service';

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async preTradeCheck(input: {
    userId: string;
    symbol: string;
    side: OrderSide;
    qty: string;
    limitPrice: string;
  }) {
    const maxOrderSize = D(process.env.RISK_MAX_ORDER_SIZE ?? '1000');
    const maxUserExposure = D(process.env.RISK_MAX_USER_EXPOSURE ?? '1000000');
    const qty = D(input.qty);
    const limitPrice = D(input.limitPrice);
    const orderNotional = qty.mul(limitPrice);

    if (qty.gt(maxOrderSize)) {
      this.reject('order_size_limit', input);
    }

    const userOrders = await this.prisma.order.findMany({
      where: { userId: input.userId, status: { in: ['OPEN', 'PARTIALLY_FILLED'] } },
      select: { remainingQty: true, limitPrice: true },
    });
    const openNotional = userOrders.reduce(
      (acc, o) => acc.plus(D(o.remainingQty.toString()).mul(o.limitPrice.toString())),
      D(0),
    );
    if (openNotional.plus(orderNotional).gt(maxUserExposure)) {
      this.reject('user_exposure_limit', input);
    }

    const selfCross = await this.prisma.order.findFirst({
      where: {
        userId: input.userId,
        symbol: input.symbol,
        status: { in: ['OPEN', 'PARTIALLY_FILLED'] },
        side: input.side === 'BUY' ? 'SELL' : 'BUY',
        ...(input.side === 'BUY'
          ? { limitPrice: { lte: limitPrice.toFixed(8) } }
          : { limitPrice: { gte: limitPrice.toFixed(8) } }),
      },
      select: { id: true },
    });
    if (selfCross) {
      this.reject('self_trade_prevention', { ...input, crossingOrderId: selfCross.id });
    }
  }

  private reject(reason: string, payload: Record<string, unknown>): never {
    this.logger.warn('risk.rejected', { reason, ...payload });
    throw new RiskRejectedException(`Risk rejected: ${reason}`);
  }
}
