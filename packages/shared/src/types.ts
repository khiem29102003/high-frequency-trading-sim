export type AssetSymbol = string;
export type OrderId = string;
export type UserId = string;

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'LIMIT';
export type OrderStatus = 'OPEN' | 'PARTIALLY_FILLED' | 'FILLED' | 'CANCELLED';

export interface Money {
  currency: 'USD';
  amount: string; // decimal as string
}

export interface MarketTick {
  symbol: AssetSymbol;
  price: string; // decimal as string
  ts: string; // ISO
}

export interface Holding {
  symbol: AssetSymbol;
  availableQty: string;
  reservedQty: string;
  avgCost: string;
}

export interface AccountBalance {
  availableCash: string;
  reservedCash: string;
  currency: 'USD';
}

export interface OrderView {
  id: OrderId;
  userId: UserId;
  symbol: AssetSymbol;
  side: OrderSide;
  type: OrderType;
  limitPrice: string;
  qty: string;
  remainingQty: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FillView {
  id: string;
  symbol: AssetSymbol;
  price: string;
  qty: string;
  makerOrderId: OrderId;
  takerOrderId: OrderId;
  makerUserId: UserId;
  takerUserId: UserId;
  executedAt: string;
}

export interface PortfolioSnapshotView {
  equity: string;
  cash: string;
  holdings: Holding[];
  ts: string;
}

export interface PnlSummary {
  userId: UserId;
  realizedPnl: string;
  unrealizedPnl: string;
  totalPnl: string;
  ts: string;
}

export interface OrderBookLevel {
  price: string;
  volume: string;
  cumulative: string;
}

export interface OrderBookSnapshot {
  symbol: AssetSymbol;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: string | null;
  ts: string;
}
