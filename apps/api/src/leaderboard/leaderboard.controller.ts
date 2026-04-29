import { Controller, Get, Post } from '@nestjs/common';
import { LeaderboardService } from './leaderboard.service';

@Controller('leaderboard')
export class LeaderboardController {
  constructor(private readonly leaderboardService: LeaderboardService) {}

  @Post('refresh')
  refresh() {
    return this.leaderboardService.refresh();
  }

  @Get()
  list() {
    return this.leaderboardService.list();
  }
}
