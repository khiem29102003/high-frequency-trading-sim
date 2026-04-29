import {
  OnGatewayConnection,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import type { Server, Socket } from 'socket.io';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/ws',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection {
  @WebSocketServer()
  server!: Server;

  afterInit() {
    // server initialized
  }

  handleConnection(client: Socket) {
    client.join('market:*');
  }

  @SubscribeMessage('market.subscribe')
  subscribeMarket(client: Socket, payload: { symbols: string[] }) {
    for (const symbol of payload.symbols ?? []) {
      client.join(`market:${symbol}`);
    }
  }

  @SubscribeMessage('orderbook.subscribe')
  subscribeOrderbook(client: Socket, payload: { symbol: string }) {
    if (payload?.symbol) {
      client.join(`orderbook:${payload.symbol}`);
    }
  }

  @SubscribeMessage('portfolio.subscribe')
  subscribePortfolio(client: Socket, payload: { userId: string }) {
    if (payload?.userId) {
      client.join(`portfolio:${payload.userId}`);
    }
  }

  emitMarket(symbol: string, tick: unknown) {
    this.server.to(`market:${symbol}`).emit('market.tick', tick);
    this.server.to('market:*').emit('market.tick', tick);
  }

  emitOrderUpdate(userId: string, payload: unknown) {
    this.server.to(`portfolio:${userId}`).emit('order.updated', payload);
  }

  emitPortfolio(userId: string, payload: unknown) {
    this.server.to(`portfolio:${userId}`).emit('portfolio.snapshot', payload);
  }

  emitTrade(payload: unknown) {
    this.server.emit('trade.executed', payload);
  }

  emitOrderbook(symbol: string, payload: unknown) {
    this.server.to(`orderbook:${symbol}`).emit('orderbook.snapshot', payload);
    this.server.emit('orderbook.update', payload);
  }

  emitPnl(userId: string, payload: unknown) {
    this.server.to(`portfolio:${userId}`).emit('pnl.updated', payload);
  }

  emitRisk(userId: string, payload: unknown) {
    this.server.to(`portfolio:${userId}`).emit('risk.rejected', payload);
  }
}
