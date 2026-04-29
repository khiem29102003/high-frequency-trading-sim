import { Controller, Get, Param } from '@nestjs/common';
import { OrderBookService } from './orderbook.service';

@Controller('orderbook')
export class OrderbookController {
  constructor(private readonly orderBookService: OrderBookService) {}

  @Get(':symbol')
  depth(@Param('symbol') symbol: string) {
    return this.orderBookService.getDepth(symbol);
  }
}
