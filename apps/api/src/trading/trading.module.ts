import { Module } from '@nestjs/common';
import { TradingService } from './trading.service';
import { TradingController } from './trading.controller';
import { MatchingWorker } from './matching.worker';
import { RiskModule } from '../risk/risk.module';
import { IdempotencyModule } from '../idempotency/idempotency.module';
import { CommonModule } from '../common/common.module';

@Module({
  imports: [RiskModule, IdempotencyModule, CommonModule],
  providers: [TradingService, MatchingWorker],
  controllers: [TradingController],
  exports: [TradingService],
})
export class TradingModule {}
