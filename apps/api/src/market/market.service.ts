import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

@Injectable()
export class MarketService {
  constructor(private readonly prisma: PrismaService) {}

  getAssets() {
    return this.prisma.asset.findMany({ where: { isActive: true }, orderBy: { symbol: 'asc' } });
  }

  getLatestTicks() {
    return this.prisma.marketTick.findMany({
      take: 100,
      orderBy: [{ ts: 'desc' }],
    });
  }
}
