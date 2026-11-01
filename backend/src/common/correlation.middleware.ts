import { randomUUID } from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';

export const CORRELATION_HEADER = 'x-request-id';

export function correlationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(CORRELATION_HEADER);
  const requestId = incoming && incoming.trim().length > 0 ? incoming.trim() : randomUUID();
  req.headers[CORRELATION_HEADER] = requestId;
  res.setHeader(CORRELATION_HEADER, requestId);
  next();
}
