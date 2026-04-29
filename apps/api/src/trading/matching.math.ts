import { D } from './decimal.util';

export function minDecimal(a: string, b: string) {
  const da = D(a);
  const db = D(b);
  return da.lte(db) ? da : db;
}

export function computeTradeCash(price: string, qty: string) {
  return D(price).mul(qty);
}
