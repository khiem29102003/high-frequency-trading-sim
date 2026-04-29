import type {
  FillView,
  MarketTick,
  OrderBookSnapshot,
  OrderView,
  PnlSummary,
  PortfolioSnapshotView,
} from './types';

export type WsTopic =
  | 'market.tick'
  | 'order.updated'
  | 'order.created'
  | 'orderbook.snapshot'
  | 'orderbook.update'
  | 'trade.executed'
  | 'portfolio.snapshot'
  | 'pnl.updated'
  | 'risk.rejected';

export interface WsServerToClientEvents {
  'market.tick': (tick: MarketTick) => void;
  'order.created': (order: OrderView) => void;
  'order.updated': (order: OrderView) => void;
  'orderbook.snapshot': (snapshot: OrderBookSnapshot) => void;
  'orderbook.update': (snapshot: OrderBookSnapshot) => void;
  'trade.executed': (fill: FillView) => void;
  'portfolio.snapshot': (snapshot: PortfolioSnapshotView) => void;
  'pnl.updated': (summary: PnlSummary) => void;
  'risk.rejected': (payload: { reason: string; symbol?: string; orderId?: string }) => void;
}

export interface WsClientToServerEvents {
  'market.subscribe': (payload: { symbols: string[] }) => void;
  'portfolio.subscribe': (payload: { userId: string }) => void;
  'orderbook.subscribe': (payload: { symbol: string }) => void;
}
