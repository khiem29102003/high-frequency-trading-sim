import { Injectable } from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { DuplicateOrderException } from '../common/exceptions/financial.exceptions';

@Injectable()
export class IdempotencyService {
  constructor(private readonly prisma: PrismaService) {}

  async run<T>(
    input: {
      userId: string;
      action: string;
      key: string;
      requestBody: unknown;
    },
    handler: () => Promise<T>,
  ): Promise<{ replayed: boolean; result: T }> {
    const requestHash = this.hash(input.requestBody);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    const existing = await this.prisma.idempotencyKey.findUnique({
      where: {
        userId_idempotencyKey_action: {
          userId: input.userId,
          idempotencyKey: input.key,
          action: input.action,
        },
      },
    });

    if (existing && existing.expiresAt > new Date()) {
      if (existing.requestHash !== requestHash) {
        throw new DuplicateOrderException('Idempotency key reused with different payload');
      }
      if (existing.status === 'COMPLETED' && existing.responseBody) {
        return { replayed: true, result: existing.responseBody as T };
      }
      if (existing.status === 'IN_PROGRESS') {
        throw new DuplicateOrderException('Request with this idempotency key is still in progress');
      }
    }

    await this.prisma.idempotencyKey.upsert({
      where: {
        userId_idempotencyKey_action: {
          userId: input.userId,
          idempotencyKey: input.key,
          action: input.action,
        },
      },
      update: {
        status: 'IN_PROGRESS',
        requestHash,
        responseBody: Prisma.JsonNull,
        responseStatus: null,
        expiresAt,
      },
      create: {
        userId: input.userId,
        action: input.action,
        idempotencyKey: input.key,
        status: 'IN_PROGRESS',
        requestHash,
        expiresAt,
      },
    });

    try {
      const result = await handler();
      await this.prisma.idempotencyKey.update({
        where: {
          userId_idempotencyKey_action: {
            userId: input.userId,
            idempotencyKey: input.key,
            action: input.action,
          },
        },
        data: {
          status: 'COMPLETED',
          responseStatus: 200,
          responseBody: result as object,
        },
      });
      return { replayed: false, result };
    } catch (error) {
      await this.prisma.idempotencyKey.update({
        where: {
          userId_idempotencyKey_action: {
            userId: input.userId,
            idempotencyKey: input.key,
            action: input.action,
          },
        },
        data: { status: 'FAILED' },
      });
      throw error;
    }
  }

  private hash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value ?? {})).digest('hex');
  }
}
