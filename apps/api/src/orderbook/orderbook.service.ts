import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { D } from '../trading/decimal.util';

@Injectable()
export class OrderBookService {
  constructor(private readonly prisma: PrismaService) {}

  async getDepth(symbol: string) {
    const [bids, asks] = await Promise.all([
      this.prisma.$queryRawUnsafe<Array<{ price: string; volume: string }>>(
        `SELECT limit_price::text as price, SUM(remaining_qty)::text as volume
         FROM orders
         WHERE symbol = $1 AND side = 'BUY' AND status IN ('OPEN','PARTIALLY_FILLED')
         GROUP BY limit_price
         ORDER BY limit_price DESC
         LIMIT 10`,
        symbol,
      ),
      this.prisma.$queryRawUnsafe<Array<{ price: string; volume: string }>>(
        `SELECT limit_price::text as price, SUM(remaining_qty)::text as volume
         FROM orders
         WHERE symbol = $1 AND side = 'SELL' AND status IN ('OPEN','PARTIALLY_FILLED')
         GROUP BY limit_price
         ORDER BY limit_price ASC
         LIMIT 10`,
        symbol,
      ),
    ]);

    const withCum = (levels: Array<{ price: string; volume: string }>) => {
      let cumulative = D(0);
      return levels.map((level) => {
        cumulative = cumulative.plus(level.volume);
        return { ...level, cumulative: cumulative.toFixed(8) };
      });
    };

    const bestBid = bids[0] ? D(bids[0].price) : null;
    const bestAsk = asks[0] ? D(asks[0].price) : null;
    const spread = bestBid && bestAsk ? bestAsk.minus(bestBid).toFixed(8) : null;

    return {
      symbol,
      bids: withCum(bids),
      asks: withCum(asks),
      spread,
      ts: new Date().toISOString(),
    };
  }
}
