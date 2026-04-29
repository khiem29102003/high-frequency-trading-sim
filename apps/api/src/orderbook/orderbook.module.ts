import { Module } from '@nestjs/common';
import { OrderBookService } from './orderbook.service';
import { OrderbookController } from './orderbook.controller';

@Module({
  providers: [OrderBookService],
  controllers: [OrderbookController],
  exports: [OrderBookService],
})
export class OrderbookModule {}
