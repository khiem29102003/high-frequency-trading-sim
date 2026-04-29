import { RiskService } from './risk.service';
import { RiskRejectedException } from '../common/exceptions/financial.exceptions';

describe('RiskService', () => {
  const logger = { warn: jest.fn() };

  beforeEach(() => {
    process.env.RISK_MAX_ORDER_SIZE = '10';
    process.env.RISK_MAX_USER_EXPOSURE = '1000';
    jest.clearAllMocks();
  });

  it('rejects when order size exceeds symbol limit', async () => {
    const service = new RiskService(
      { order: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) } } as any,
      logger as any,
    );
    await expect(
      service.preTradeCheck({ userId: 'u1', symbol: 'AAPL', side: 'BUY', qty: '11', limitPrice: '1' }),
    ).rejects.toBeInstanceOf(RiskRejectedException);
  });

  it('rejects when exposure exceeds limit', async () => {
    const service = new RiskService(
      {
        order: {
          findMany: jest.fn().mockResolvedValue([{ remainingQty: '10', limitPrice: '100' }]),
          findFirst: jest.fn().mockResolvedValue(null),
        },
      } as any,
      logger as any,
    );
    await expect(
      service.preTradeCheck({ userId: 'u1', symbol: 'AAPL', side: 'BUY', qty: '1', limitPrice: '1' }),
    ).rejects.toBeInstanceOf(RiskRejectedException);
  });

  it('rejects self-trade crossing buy over own sell', async () => {
    const service = new RiskService(
      {
        order: {
          findMany: jest.fn().mockResolvedValue([]),
          findFirst: jest.fn().mockResolvedValue({ id: 'o1' }),
        },
      } as any,
      logger as any,
    );
    await expect(
      service.preTradeCheck({ userId: 'u1', symbol: 'AAPL', side: 'BUY', qty: '1', limitPrice: '100' }),
    ).rejects.toBeInstanceOf(RiskRejectedException);
  });

  it('passes valid buy order risk check', async () => {
    const service = new RiskService(
      { order: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) } } as any,
      logger as any,
    );
    await expect(
      service.preTradeCheck({ userId: 'u1', symbol: 'AAPL', side: 'BUY', qty: '1', limitPrice: '100' }),
    ).resolves.toBeUndefined();
  });

  it('passes valid sell order risk check', async () => {
    const service = new RiskService(
      { order: { findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) } } as any,
      logger as any,
    );
    await expect(
      service.preTradeCheck({ userId: 'u1', symbol: 'AAPL', side: 'SELL', qty: '1', limitPrice: '100' }),
    ).resolves.toBeUndefined();
  });
});
