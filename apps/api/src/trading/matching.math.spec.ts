import { computeTradeCash, minDecimal } from './matching.math';

describe('matching math', () => {
  it('takes minimum quantity deterministically', () => {
    expect(minDecimal('2.50000000', '1.00000000').toFixed(8)).toBe('1.00000000');
  });

  it('computes trade cash with precision-safe decimals', () => {
    expect(computeTradeCash('123.45670000', '0.10000000').toFixed(8)).toBe('12.34567000');
  });

  it('preserves precision for small quantities', () => {
    expect(computeTradeCash('0.12345678', '0.00010000').toFixed(8)).toBe('0.00001235');
  });

  it('returns exact min when equal', () => {
    expect(minDecimal('1.25000000', '1.25000000').toFixed(8)).toBe('1.25000000');
  });

  it('handles very large notional multiplication', () => {
    expect(computeTradeCash('999999.99999999', '1000.00000000').toFixed(8)).toBe('999999999.99999000');
  });
});
