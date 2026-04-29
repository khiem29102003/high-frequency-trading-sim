import { OrderBookService } from './orderbook.service';

describe('OrderBookService', () => {
  it('builds top bids and asks with cumulative volume', async () => {
    const service = new OrderBookService({
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([
          { price: '101.00000000', volume: '1.00000000' },
          { price: '100.00000000', volume: '2.00000000' },
        ])
        .mockResolvedValueOnce([
          { price: '102.00000000', volume: '1.50000000' },
          { price: '103.00000000', volume: '0.50000000' },
        ]),
    } as any);
    const depth = await service.getDepth('AAPL');
    expect(depth.bids[1]?.cumulative).toBe('3.00000000');
    expect(depth.asks[1]?.cumulative).toBe('2.00000000');
  });

  it('calculates spread from best levels', async () => {
    const service = new OrderBookService({
      $queryRawUnsafe: jest
        .fn()
        .mockResolvedValueOnce([{ price: '100.00000000', volume: '1.00000000' }])
        .mockResolvedValueOnce([{ price: '100.25000000', volume: '1.00000000' }]),
    } as any);
    const depth = await service.getDepth('AAPL');
    expect(depth.spread).toBe('0.25000000');
  });

  it('returns null spread when one side missing', async () => {
    const service = new OrderBookService({
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([{ price: '100.25000000', volume: '1.00000000' }]),
    } as any);
    const depth = await service.getDepth('AAPL');
    expect(depth.spread).toBeNull();
  });

  it('keeps symbol in snapshot payload', async () => {
    const service = new OrderBookService({
      $queryRawUnsafe: jest.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]),
    } as any);
    const depth = await service.getDepth('BTC-USD');
    expect(depth.symbol).toBe('BTC-USD');
  });
});
