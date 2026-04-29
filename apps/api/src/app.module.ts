import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { DatabaseModule } from './database/database.module';
import { TradingModule } from './trading/trading.module';
import { MarketModule } from './market/market.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { LeaderboardModule } from './leaderboard/leaderboard.module';
import { RealtimeModule } from './realtime/realtime.module';
import { OutboxModule } from './outbox/outbox.module';
import { QueueModule } from './queue/queue.module';
import { RiskModule } from './risk/risk.module';
import { IdempotencyModule } from './idempotency/idempotency.module';
import { CommonModule } from './common/common.module';
import { HealthModule } from './health/health.module';
import { RequestContextMiddleware } from './common/middleware/request-context.middleware';
import { OrderbookModule } from './orderbook/orderbook.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([
      {
        ttl: 60000,
        limit: Number(process.env.RATE_LIMIT_PER_MIN ?? 120),
      },
    ]),
    CommonModule,
    DatabaseModule,
    QueueModule,
    IdempotencyModule,
    RiskModule,
    AuthModule,
    TradingModule,
    MarketModule,
    OrderbookModule,
    PortfolioModule,
    LeaderboardModule,
    RealtimeModule,
    OutboxModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
