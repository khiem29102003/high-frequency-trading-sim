import { Module } from '@nestjs/common';
import { OutboxService } from './outbox.service';
import { RealtimeModule } from '../realtime/realtime.module';
import { OrderbookModule } from '../orderbook/orderbook.module';
import { PortfolioModule } from '../portfolio/portfolio.module';

@Module({
  imports: [RealtimeModule, OrderbookModule, PortfolioModule],
  providers: [OutboxService],
  exports: [OutboxService],
})
export class OutboxModule {}
