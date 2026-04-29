import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@UseGuards(JwtAuthGuard)
@Controller('portfolio')
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get('me')
  me(@Req() req: { user: { userId: string } }) {
    return this.portfolioService.getPortfolio(req.user.userId);
  }

  @Get('pnl')
  pnl(@Req() req: { user: { userId: string } }) {
    return this.portfolioService.getPnlSummary(req.user.userId);
  }
}
