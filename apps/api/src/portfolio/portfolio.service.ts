import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { D } from '../trading/decimal.util';
import { AppLogger } from '../common/logging/app-logger.service';

@Injectable()
export class PortfolioService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly logger: AppLogger,
  ) {}

  async getPortfolio(userId: string) {
    const account = await this.prisma.account.findUnique({ where: { userId } });
    const holdings = await this.prisma.holding.findMany({ where: { userId } });

    let equity = D(account?.availableCash.toString() ?? '0').plus(account?.reservedCash.toString() ?? '0');
    let unrealizedPnl = D(0);
    let realizedPnl = D(0);
    const withPrices: Array<Record<string, unknown>> = [];
    for (const h of holdings) {
      const tick = await this.prisma.marketTick.findFirst({
        where: { symbol: h.symbol },
        orderBy: { ts: 'desc' },
      });
      const price = D(tick?.price.toString() ?? '0');
      const totalQty = D(h.availableQty.toString()).plus(h.reservedQty.toString());
      const marketValue = totalQty.mul(price);
      equity = equity.plus(marketValue);
      const unrealized = price.minus(h.avgCost.toString()).mul(totalQty);
      unrealizedPnl = unrealizedPnl.plus(unrealized);
      realizedPnl = realizedPnl.plus(h.realizedPnl.toString());
      withPrices.push({
        symbol: h.symbol,
        availableQty: h.availableQty,
        reservedQty: h.reservedQty,
        avgCost: h.avgCost,
        realizedPnl: h.realizedPnl,
        price: price.toFixed(8),
        marketValue: marketValue.toFixed(8),
        unrealizedPnl: unrealized.toFixed(8),
      });
    }

    await this.prisma.portfolioSnapshot.create({
      data: {
        userId,
        ts: new Date(),
        equity: equity.toFixed(8),
        cash: D(account?.availableCash.toString() ?? '0').toFixed(8),
      },
    });
    this.logger.info('portfolio.updated', {
      userId,
      equity: equity.toFixed(8),
      unrealizedPnl: unrealizedPnl.toFixed(8),
      realizedPnl: realizedPnl.toFixed(8),
    });

    return {
      balance: account,
      holdings: withPrices,
      pnl: {
        realizedPnl: realizedPnl.toFixed(8),
        unrealizedPnl: unrealizedPnl.toFixed(8),
        totalPnl: realizedPnl.plus(unrealizedPnl).toFixed(8),
      },
      equity: equity.toFixed(8),
      ts: new Date().toISOString(),
    };
  }

  async getPnlSummary(userId: string) {
    const holdings = await this.prisma.holding.findMany({ where: { userId } });
    let realizedPnl = D(0);
    let unrealizedPnl = D(0);

    for (const h of holdings) {
      const latest = await this.prisma.marketTick.findFirst({
        where: { symbol: h.symbol },
        orderBy: { ts: 'desc' },
      });
      const price = D(latest?.price.toString() ?? '0');
      const qty = D(h.availableQty.toString()).plus(h.reservedQty.toString());
      unrealizedPnl = unrealizedPnl.plus(price.minus(h.avgCost.toString()).mul(qty));
      realizedPnl = realizedPnl.plus(h.realizedPnl.toString());
    }

    return {
      userId,
      realizedPnl: realizedPnl.toFixed(8),
      unrealizedPnl: unrealizedPnl.toFixed(8),
      totalPnl: realizedPnl.plus(unrealizedPnl).toFixed(8),
      ts: new Date().toISOString(),
    };
  }
}
