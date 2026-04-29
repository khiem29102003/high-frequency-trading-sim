import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { NextFunction, Request, Response } from 'express';
import { RequestContext } from '../context/request-context';

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const requestId = (req.header('x-request-id') ?? randomUUID()).toString();
    res.setHeader('x-request-id', requestId);
    RequestContext.run({ requestId }, next);
  }
}
