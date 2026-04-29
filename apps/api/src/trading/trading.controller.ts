import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { TradingService } from './trading.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlaceOrderDto } from './dto/place-order.dto';
import { HistoryQueryDto } from './dto/history-query.dto';

@UseGuards(JwtAuthGuard)
@Controller('trading')
export class TradingController {
  constructor(private readonly tradingService: TradingService) {}

  @Post('orders')
  @Throttle({ default: { limit: 100, ttl: 60000 } })
  placeOrder(
    @Req() req: { user: { userId: string } },
    @Body() dto: PlaceOrderDto,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tradingService.placeOrder(req.user.userId, dto, idempotencyKey);
  }

  @Delete('orders/:orderId')
  @Throttle({ default: { limit: 80, ttl: 60000 } })
  cancelOrder(
    @Req() req: { user: { userId: string } },
    @Param('orderId') orderId: string,
    @Headers('x-idempotency-key') idempotencyKey?: string,
  ) {
    return this.tradingService.cancelOrder(req.user.userId, orderId, idempotencyKey);
  }

  @Get('orders/history')
  history(@Req() req: { user: { userId: string } }, @Query() query: HistoryQueryDto) {
    return this.tradingService.history(req.user.userId, query);
  }
}
