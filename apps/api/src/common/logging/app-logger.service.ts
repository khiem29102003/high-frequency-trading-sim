import { Injectable } from '@nestjs/common';
import pino from 'pino';
import { RequestContext } from '../context/request-context';

@Injectable()
export class AppLogger {
  private readonly logger = pino({
    level: process.env.LOG_LEVEL ?? 'info',
    base: undefined,
    timestamp: pino.stdTimeFunctions.isoTime,
  });

  info(event: string, payload: Record<string, unknown> = {}) {
    const ctx = RequestContext.get();
    this.logger.info({ event, requestId: ctx?.requestId, userId: ctx?.userId, ...payload });
  }

  warn(event: string, payload: Record<string, unknown> = {}) {
    const ctx = RequestContext.get();
    this.logger.warn({ event, requestId: ctx?.requestId, userId: ctx?.userId, ...payload });
  }

  error(event: string, payload: Record<string, unknown> = {}) {
    const ctx = RequestContext.get();
    this.logger.error({ event, requestId: ctx?.requestId, userId: ctx?.userId, ...payload });
  }
}
