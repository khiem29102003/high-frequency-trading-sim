import { BadRequestException } from '@nestjs/common';
import { TradingService } from './trading.service';

describe('TradingService', () => {
  const deps = () =>
    [
      { matchingQueue: { add: jest.fn() }, outboxQueue: { add: jest.fn() } },
      { preTradeCheck: jest.fn().mockResolvedValue(undefined) },
      { run: jest.fn(async (_input: any, handler: any) => ({ replayed: false, result: await handler() })) },
      { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
    ] as const;

  it('rejects non-positive order values', async () => {
    const [queues, risk, idem, logger] = deps();
    const service = new TradingService(
      {} as any,
      queues as any,
      risk as any,
      idem as any,
      logger as any,
    );
    await expect(
      service.placeOrder('user-1', {
        symbol: 'AAPL',
        side: 'BUY',
        qty: '0',
        limitPrice: '100',
      } as any),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('avoids double spend under concurrent placement by transactional gate', async () => {
    const accountState = { availableCash: 1000, reservedCash: 0 };
    let lock = false;

    const prisma = {
      $transaction: async (cb: any) => cb({
        asset: { findUnique: async () => ({ symbol: 'AAPL', isActive: true }) },
        $executeRawUnsafe: async () => {
          if (lock) throw new Error('row locked');
          lock = true;
        },
        account: {
          findUnique: async () => accountState,
          update: async ({ data }: any) => {
            accountState.availableCash = Number(data.availableCash);
            accountState.reservedCash = Number(data.reservedCash);
            lock = false;
            return accountState;
          },
        },
        order: {
          create: async () => ({
            id: crypto.randomUUID(),
            symbol: 'AAPL',
            side: 'BUY',
            qty: { toString: () => '1.00000000' },
            limitPrice: { toString: () => '500.00000000' },
          }),
        },
        outboxEvent: { create: async () => ({}) },
      }),
    };

    const [queues, risk, idem, logger] = deps();
    const service = new TradingService(
      prisma as any,
      queues as any,
      risk as any,
      idem as any,
      logger as any,
    );

    await service.placeOrder('u1', { symbol: 'AAPL', side: 'BUY', limitPrice: '500', qty: '1' } as any);
    await expect(
      service.placeOrder('u1', { symbol: 'AAPL', side: 'BUY', limitPrice: '600', qty: '1' } as any),
    ).rejects.toBeDefined();
  });
});
