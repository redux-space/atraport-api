import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

/** HTTP header used to carry the correlation ID */
export const CORRELATION_ID_HEADER = 'x-correlation-id';
/** Key used to attach the correlation ID to the request object */
export const CORRELATION_ID_KEY = 'correlationId';

/**
 * Reads the `x-correlation-id` header from the incoming request.
 * If absent, generates a new UUID v4 and sets it on both the request object
 * and the response header so the caller can trace the request.
 */
@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const existing =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined)?.trim() || '';

    const correlationId = existing || uuidv4();

    // Attach to the request so downstream handlers can read it
    (req as any)[CORRELATION_ID_KEY] = correlationId;

    // Echo back in the response so API consumers can correlate
    res.setHeader(CORRELATION_ID_HEADER, correlationId);

    next();
  }
}

/** Helper to safely read the correlation ID off the request object */
export function getCorrelationId(req: Request): string {
  return (req as any)[CORRELATION_ID_KEY] ?? '';
}
