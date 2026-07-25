import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { Request, Response } from 'express';
import { AppLoggerService } from '../services/app-logger.service';
import { getCorrelationId } from '../middleware/correlation-id.middleware';
import { redactSensitiveData, redactUrlParams } from '../utils/redact.util';

const LOG_BODY_MAX_BYTES = 2048; // truncate request/response bodies at this size

/**
 * Logs every incoming HTTP request (method, path, status, duration) and
 * also tracks per-endpoint performance timing via `logPerformance`.
 *
 * Sensitive fields in request bodies are automatically redacted.
 */
@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: AppLoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const req = context.switchToHttp().getRequest<Request>();
    const res = context.switchToHttp().getResponse<Response>();
    const startedAt = Date.now();

    const correlationId = getCorrelationId(req);
    const method = req.method;
    const url = redactUrlParams(req.originalUrl ?? req.url);
    const ip = (req.headers['x-forwarded-for'] as string) ?? req.socket?.remoteAddress ?? '';
    const userAgent = req.headers['user-agent'] ?? '';

    // Log the incoming request
    this.logger.http(`→ ${method} ${url}`, {
      correlationId,
      http: { method, url, ip, userAgent },
      requestBody: this.truncateBody(redactSensitiveData(req.body)),
    });

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startedAt;
        const statusCode = res.statusCode;

        this.logger.http(`← ${method} ${url} ${statusCode} (${durationMs}ms)`, {
          correlationId,
          http: { method, url, statusCode, durationMs, ip, userAgent },
        });

        this.logger.logPerformance(`${method} ${url}`, durationMs, {
          correlationId,
          http: { method, url, statusCode },
        });
      }),
      catchError((error: unknown) => {
        const durationMs = Date.now() - startedAt;
        const statusCode = res.statusCode || 500;

        this.logger.http(`← ${method} ${url} ${statusCode} (${durationMs}ms) [ERROR]`, {
          correlationId,
          http: { method, url, statusCode, durationMs, ip, userAgent },
          error:
            error instanceof Error
              ? { name: error.name, message: error.message }
              : { message: String(error) },
        });

        return throwError(() => error);
      }),
    );
  }

  private truncateBody(body: unknown): unknown {
    if (!body) return undefined;
    const str = JSON.stringify(body);
    if (str.length <= LOG_BODY_MAX_BYTES) return body;
    return `[truncated ${str.length} bytes]`;
  }
}
