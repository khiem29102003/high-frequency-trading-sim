import { Controller, Get } from '@nestjs/common';
import { MarketService } from './market.service';

@Controller('market')
export class MarketController {
  constructor(private readonly marketService: MarketService) {}

  @Get('assets')
  assets() {
    return this.marketService.getAssets();
  }

  @Get('ticks/latest')
  latest() {
    return this.marketService.getLatestTicks();
  }
}
