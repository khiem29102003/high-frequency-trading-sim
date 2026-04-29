import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { QueueService } from '../queue/queue.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
  ) {}

  @Get()
  async health() {
    const db = await this.prisma.$queryRawUnsafe<Array<{ now: string }>>('SELECT NOW()::text as now');
    const redis = await this.queueService.ping();
    const queue = await this.queueService.stats();
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      checks: {
        db: Boolean(db[0]?.now),
        redis: redis === 'PONG',
        queue,
      },
    };
  }
}
