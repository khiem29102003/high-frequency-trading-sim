import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { D } from '../trading/decimal.util';

@Injectable()
export class LeaderboardService {
  constructor(private readonly prisma: PrismaService) {}

  async refresh() {
    const users = await this.prisma.user.findMany({ select: { id: true } });
    const rows: Array<{ userId: string; equity: string; profit: string }> = [];

    for (const user of users) {
      const latest = await this.prisma.portfolioSnapshot.findFirst({
        where: { userId: user.id },
        orderBy: { ts: 'desc' },
      });
      const equity = D(latest?.equity.toString() ?? '0');
      rows.push({ userId: user.id, equity: equity.toFixed(8), profit: equity.minus('100000').toFixed(8) });
    }

    rows.sort((a, b) => D(b.profit).comparedTo(a.profit));
    await this.prisma.$transaction(async (tx) => {
      await tx.leaderboardCache.deleteMany({});
      for (let i = 0; i < rows.length; i += 1) {
        const row = rows[i];
        if (!row) continue;
        await tx.leaderboardCache.create({
          data: {
            userId: row.userId,
            equity: row.equity,
            profit: row.profit,
            rank: i + 1,
            asOf: new Date(),
          },
        });
      }
    });
  }

  list() {
    return this.prisma.leaderboardCache.findMany({
      orderBy: { rank: 'asc' },
      take: 50,
    });
  }
}
