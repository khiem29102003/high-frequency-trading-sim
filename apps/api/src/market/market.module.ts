import { Module } from '@nestjs/common';
import { MarketService } from './market.service';
import { MarketController } from './market.controller';
import { MarketWorker } from './market.worker';

@Module({
  providers: [MarketService, MarketWorker],
  controllers: [MarketController],
  exports: [MarketService],
})
export class MarketModule {}
