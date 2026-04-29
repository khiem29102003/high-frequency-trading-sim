import { PortfolioService } from './portfolio.service';

describe('PortfolioService', () => {
  function mkService(overrides: Partial<any> = {}) {
    const prisma = {
      account: { findUnique: jest.fn().mockResolvedValue({ availableCash: '1000.00000000', reservedCash: '0' }) },
      holding: { findMany: jest.fn().mockResolvedValue([]) },
      marketTick: { findFirst: jest.fn() },
      portfolioSnapshot: { create: jest.fn() },
      ...overrides,
    };
    return new PortfolioService(prisma as any, { info: jest.fn() } as any);
  }

  it('computes pnl summary with no holdings', async () => {
    const service = mkService();
    const pnl = await service.getPnlSummary('u1');
    expect(pnl.realizedPnl).toBe('0.00000000');
    expect(pnl.unrealizedPnl).toBe('0.00000000');
  });

  it('computes unrealized pnl from latest tick minus avg cost', async () => {
    const service = mkService({
      holding: {
        findMany: jest.fn().mockResolvedValue([
          { symbol: 'AAPL', availableQty: '2', reservedQty: '0', avgCost: '100', realizedPnl: '5' },
        ]),
      },
      marketTick: { findFirst: jest.fn().mockResolvedValue({ price: '110' }) },
    });
    const pnl = await service.getPnlSummary('u1');
    expect(pnl.unrealizedPnl).toBe('20.00000000');
    expect(pnl.realizedPnl).toBe('5.00000000');
  });

  it('creates snapshot during portfolio query', async () => {
    const create = jest.fn();
    const service = mkService({ portfolioSnapshot: { create } });
    await service.getPortfolio('u1');
    expect(create).toHaveBeenCalled();
  });

  it('returns holdings list in portfolio payload', async () => {
    const service = mkService({
      holding: {
        findMany: jest.fn().mockResolvedValue([
          { symbol: 'AAPL', availableQty: '1', reservedQty: '0', avgCost: '100', realizedPnl: '0' },
        ]),
      },
      marketTick: { findFirst: jest.fn().mockResolvedValue({ price: '100' }) },
    });
    const portfolio = await service.getPortfolio('u1');
    expect(portfolio.holdings).toHaveLength(1);
  });

  it('aggregates total pnl as realized + unrealized', async () => {
    const service = mkService({
      holding: {
        findMany: jest.fn().mockResolvedValue([
          { symbol: 'AAPL', availableQty: '2', reservedQty: '0', avgCost: '100', realizedPnl: '7' },
        ]),
      },
      marketTick: { findFirst: jest.fn().mockResolvedValue({ price: '110' }) },
    });
    const pnl = await service.getPnlSummary('u1');
    expect(pnl.totalPnl).toBe('27.00000000');
  });
});
