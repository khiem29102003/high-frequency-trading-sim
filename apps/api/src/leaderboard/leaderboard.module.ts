import { Module } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';
import { LeaderboardController } from './leaderboard.controller';
import { LeaderboardWorker } from './leaderboard.worker';

@Module({
  providers: [LeaderboardService, LeaderboardWorker],
  controllers: [LeaderboardController],
})
export class LeaderboardModule {}
