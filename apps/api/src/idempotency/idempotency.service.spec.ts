import { DuplicateOrderException } from '../common/exceptions/financial.exceptions';
import { IdempotencyService } from './idempotency.service';

describe('IdempotencyService', () => {
  const now = Date.now();

  it('returns cached result when duplicate completed request arrives', async () => {
    const service = new IdempotencyService({
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: 'h1',
          status: 'COMPLETED',
          responseBody: { ok: true },
          expiresAt: new Date(now + 10000),
        }),
      },
    } as any);
    jest.spyOn<any, any>(service as any, 'hash').mockReturnValue('h1');
    const result = await service.run(
      { userId: 'u1', action: 'PLACE_ORDER', key: 'k1', requestBody: { a: 1 } },
      async () => ({ ok: false }),
    );
    expect(result.replayed).toBe(true);
    expect(result.result).toEqual({ ok: true });
  });

  it('rejects same idempotency key with different payload hash', async () => {
    const service = new IdempotencyService({
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: 'old',
          status: 'COMPLETED',
          responseBody: { ok: true },
          expiresAt: new Date(now + 10000),
        }),
      },
    } as any);
    jest.spyOn<any, any>(service as any, 'hash').mockReturnValue('new');
    await expect(
      service.run({ userId: 'u1', action: 'PLACE_ORDER', key: 'k1', requestBody: { a: 2 } }, async () => ({})),
    ).rejects.toBeInstanceOf(DuplicateOrderException);
  });

  it('rejects when same key request is in progress', async () => {
    const service = new IdempotencyService({
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue({
          requestHash: 'h1',
          status: 'IN_PROGRESS',
          expiresAt: new Date(now + 10000),
        }),
      },
    } as any);
    jest.spyOn<any, any>(service as any, 'hash').mockReturnValue('h1');
    await expect(
      service.run({ userId: 'u1', action: 'PLACE_ORDER', key: 'k1', requestBody: { a: 1 } }, async () => ({})),
    ).rejects.toBeInstanceOf(DuplicateOrderException);
  });

  it('persists successful execution as COMPLETED', async () => {
    const upsert = jest.fn();
    const update = jest.fn();
    const service = new IdempotencyService({
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert,
        update,
      },
    } as any);
    const res = await service.run(
      { userId: 'u1', action: 'PLACE_ORDER', key: 'k2', requestBody: { a: 1 } },
      async () => ({ orderId: 'o1' }),
    );
    expect(res.replayed).toBe(false);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ status: 'COMPLETED' }) }));
  });

  it('marks FAILED when handler throws', async () => {
    const update = jest.fn();
    const service = new IdempotencyService({
      idempotencyKey: {
        findUnique: jest.fn().mockResolvedValue(null),
        upsert: jest.fn(),
        update,
      },
    } as any);
    await expect(
      service.run({ userId: 'u1', action: 'PLACE_ORDER', key: 'k2', requestBody: { a: 1 } }, async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ data: { status: 'FAILED' } }));
  });
});
