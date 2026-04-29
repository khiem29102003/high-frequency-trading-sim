'use client';

import { useEffect, useMemo, useState } from 'react';
import { apiFetch } from '../lib/api';
import { getSocket } from '../lib/socket';

type Tick = { symbol: string; price: string; ts: string };
type Leader = { userId: string; profit: string; equity: string; rank: number };
type OrderBookLevel = { price: string; volume: string; cumulative: string };
type OrderBookSnapshot = {
  symbol: string;
  bids: OrderBookLevel[];
  asks: OrderBookLevel[];
  spread: string | null;
  ts: string;
};
type PnlSummary = { realizedPnl: string; unrealizedPnl: string; totalPnl: string };
type Toast = { id: string; tone: 'success' | 'error'; message: string };

export function DashboardClient() {
  const [token, setToken] = useState<string>('');
  const [ticks, setTicks] = useState<Record<string, Tick>>({});
  const [portfolio, setPortfolio] = useState<any>(null);
  const [leaders, setLeaders] = useState<Leader[]>([]);
  const [orderBook, setOrderBook] = useState<OrderBookSnapshot | null>(null);
  const [pnl, setPnl] = useState<PnlSummary | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [loading, setLoading] = useState(true);
  const [symbol, setSymbol] = useState('AAPL');
  const [side, setSide] = useState<'BUY' | 'SELL'>('BUY');
  const [qty, setQty] = useState('1');
  const [limitPrice, setLimitPrice] = useState('100');

  useEffect(() => {
    const t = localStorage.getItem('token') ?? '';
    setToken(t);
  }, []);

  useEffect(() => {
    if (!token) return;
    Promise.all([
      apiFetch<any>('/portfolio/me', token),
      apiFetch<PnlSummary>('/portfolio/pnl', token),
      apiFetch<Leader[]>('/leaderboard', token),
      apiFetch<OrderBookSnapshot>(`/orderbook/${symbol}`, token),
    ])
      .then(([portfolioResp, pnlResp, leadersResp, orderbookResp]) => {
        setPortfolio(portfolioResp);
        setPnl(pnlResp);
        setLeaders(leadersResp);
        setOrderBook(orderbookResp);
      })
      .finally(() => setLoading(false));
  }, [token, symbol]);

  useEffect(() => {
    const s = getSocket();
    s.emit('market.subscribe', { symbols: ['AAPL', 'MSFT', 'BTC-USD'] });
    s.emit('orderbook.subscribe', { symbol });
    const userId = parseJwtSub(token);
    if (userId) s.emit('portfolio.subscribe', { userId });
    s.on('market.tick', (tick: Tick) => {
      setTicks((prev) => ({ ...prev, [tick.symbol]: tick }));
    });
    s.on('orderbook.snapshot', (snapshot: OrderBookSnapshot) => {
      if (snapshot.symbol === symbol) setOrderBook(snapshot);
    });
    s.on('orderbook.update', (snapshot: OrderBookSnapshot) => {
      if (snapshot.symbol === symbol) setOrderBook(snapshot);
    });
    s.on('pnl.updated', (summary: PnlSummary) => setPnl(summary));
    s.on('trade.executed', () => pushToast('success', 'Trade executed'));
    s.on('risk.rejected', (payload: { reason: string }) => pushToast('error', `Risk rejected: ${payload.reason}`));
    return () => {
      s.off('market.tick');
      s.off('orderbook.snapshot');
      s.off('orderbook.update');
      s.off('pnl.updated');
      s.off('trade.executed');
      s.off('risk.rejected');
    };
  }, [symbol, token]);

  const marketRows = useMemo(() => Object.values(ticks), [ticks]);
  const bids = orderBook?.bids ?? [];
  const asks = orderBook?.asks ?? [];

  async function submitOrder() {
    if (!token) return;
    try {
      await apiFetch('/trading/orders', token, {
        method: 'POST',
        headers: { 'x-idempotency-key': crypto.randomUUID() },
        body: JSON.stringify({ symbol, side, qty, limitPrice }),
      });
      pushToast('success', 'Order submitted');
      const [updatedPortfolio, updatedPnl] = await Promise.all([
        apiFetch<any>('/portfolio/me', token),
        apiFetch<PnlSummary>('/portfolio/pnl', token),
      ]);
      setPortfolio(updatedPortfolio);
      setPnl(updatedPnl);
    } catch (error) {
      pushToast('error', String(error));
    }
  }

  function pushToast(tone: 'success' | 'error', message: string) {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, tone, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 2400);
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-5 p-6">
      <h1 className="text-2xl font-semibold tracking-tight">Trading Dashboard</h1>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <StatCard title="Realized PnL" value={pnl?.realizedPnl ?? '-'} positive={Number(pnl?.realizedPnl ?? 0) >= 0} />
        <StatCard title="Unrealized PnL" value={pnl?.unrealizedPnl ?? '-'} positive={Number(pnl?.unrealizedPnl ?? 0) >= 0} />
        <StatCard title="Total PnL" value={pnl?.totalPnl ?? '-'} positive={Number(pnl?.totalPnl ?? 0) >= 0} />
        <StatCard title="Portfolio Equity" value={portfolio?.equity ?? '-'} positive />
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">Market Tape</h2>
          {loading && <p className="text-xs text-slate-500">Loading market...</p>}
          {!loading && marketRows.length === 0 && <p className="text-xs text-slate-500">No ticks yet.</p>}
          {marketRows.map((row) => (
            <div key={row.symbol} className="flex justify-between text-sm">
              <span>{row.symbol}</span>
              <span>{row.price}</span>
            </div>
          ))}
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">Order Entry</h2>
          <div className="space-y-2 text-sm">
            <input className="w-full rounded bg-slate-900 p-2" value={symbol} onChange={(e) => setSymbol(e.currentTarget.value)} />
            <select className="w-full rounded bg-slate-900 p-2" value={side} onChange={(e) => setSide(e.currentTarget.value as 'BUY' | 'SELL')}>
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
            <input className="w-full rounded bg-slate-900 p-2" value={qty} onChange={(e) => setQty(e.currentTarget.value)} />
            <input className="w-full rounded bg-slate-900 p-2" value={limitPrice} onChange={(e) => setLimitPrice(e.currentTarget.value)} />
            <button className="w-full rounded bg-emerald-600 p-2 font-medium transition hover:bg-emerald-500" onClick={submitOrder}>
              Place Order
            </button>
          </div>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">Portfolio</h2>
          {loading && <p className="text-xs text-slate-500">Loading portfolio...</p>}
          {!loading && !(portfolio?.holdings?.length > 0) && <p className="text-xs text-slate-500">No holdings yet.</p>}
          <div className="text-sm">Equity: {portfolio?.equity ?? '-'}</div>
          <div className="mt-2 space-y-1 text-xs">
            {(portfolio?.holdings ?? []).map((h: any) => (
              <div key={h.symbol} className="flex justify-between">
                <span>{h.symbol}</span>
                <span>{h.availableQty}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">Order Book ({symbol})</h2>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <p className="mb-1 text-emerald-400">Bids</p>
              {bids.map((l, idx) => (
                <div key={`${l.price}-${idx}`} className="grid grid-cols-3 gap-1 py-0.5">
                  <span className="text-emerald-400">{l.price}</span>
                  <span>{l.volume}</span>
                  <span className="text-slate-400">{l.cumulative}</span>
                </div>
              ))}
            </div>
            <div>
              <p className="mb-1 text-rose-400">Asks</p>
              {asks.map((l, idx) => (
                <div key={`${l.price}-${idx}`} className="grid grid-cols-3 gap-1 py-0.5">
                  <span className="text-rose-400">{l.price}</span>
                  <span>{l.volume}</span>
                  <span className="text-slate-400">{l.cumulative}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-2 text-xs text-slate-400">Spread: {orderBook?.spread ?? '-'}</p>
        </div>

        <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
          <h2 className="mb-2 font-medium">Leaderboard</h2>
          {leaders.map((l) => (
            <div key={l.userId} className="flex justify-between text-sm">
              <span>
                #{l.rank} {l.userId.slice(0, 8)}
              </span>
              <span className={Number(l.profit) >= 0 ? 'text-emerald-400' : 'text-rose-400'}>P/L: {l.profit}</span>
            </div>
          ))}
        </div>
      </section>

      <div className="fixed bottom-4 right-4 space-y-2">
        {toasts.map((t) => (
          <div key={t.id} className={`rounded px-3 py-2 text-sm shadow-lg ${t.tone === 'success' ? 'bg-emerald-600' : 'bg-rose-600'}`}>
            {t.message}
          </div>
        ))}
      </div>
    </main>
  );
}

function StatCard({ title, value, positive }: { title: string; value: string; positive?: boolean }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/40 p-4">
      <p className="text-xs uppercase tracking-wide text-slate-400">{title}</p>
      <p className={`mt-1 text-lg font-semibold ${positive ? 'text-emerald-400' : 'text-rose-400'}`}>{value}</p>
    </div>
  );
}

function parseJwtSub(token: string): string {
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? ''));
    return String(payload.sub ?? '');
  } catch {
    return '';
  }
}
