import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AppLoggerService } from '../services/app-logger.service';
import { ErrorTrackingService } from '../services/error-tracking.service';
import { BaseAppError } from '../errors/base.error';
import { getCorrelationId } from '../middleware/correlation-id.middleware';

interface ErrorResponse {
  statusCode: number;
  error: string;
  message: string | string[];
  correlationId: string;
  timestamp: string;
  path: string;
  /** Only present for known business errors */
  code?: string;
}

/**
 * Global exception filter that catches ALL exceptions (HTTP, custom app errors,
 * and completely unexpected errors) and returns a uniform JSON error envelope.
 *
 * Also:
 *  - logs every error with full context
 *  - reports non-operational errors to Sentry
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  constructor(
    private readonly logger: AppLoggerService,
    private readonly errorTracking: ErrorTrackingService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const req = ctx.getRequest<Request>();
    const res = ctx.getResponse<Response>();

    const correlationId = getCorrelationId(req);
    const path = req.url ?? '';

    // ── Derive status + body ──────────────────────────────────────────────────

    let statusCode: number;
    let message: string | string[];
    let code: string | undefined;
    let errorName: string;

    if (exception instanceof BaseAppError) {
      statusCode = exception.statusCode;
      message = exception.message;
      code = exception.code;
      errorName = exception.name;
    } else if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (
        typeof exceptionResponse === 'object' &&
        exceptionResponse !== null &&
        'message' in exceptionResponse
      ) {
        message = (exceptionResponse as any).message;
      } else {
        message = exception.message;
      }
      errorName = exception.name;
    } else {
      // Completely unexpected — 500
      statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'An unexpected error occurred';
      errorName = exception instanceof Error ? exception.name : 'UnknownError';
    }

    const isOperational =
      exception instanceof BaseAppError ? exception.isOperational : false;

    // ── Logging ───────────────────────────────────────────────────────────────

    if (statusCode >= 500) {
      this.logger.logError(
        exception instanceof Error ? exception : new Error(String(exception)),
        {
          correlationId,
          http: { method: req.method, url: req.url, statusCode },
        },
      );
    } else if (statusCode >= 400) {
      this.logger.warn(
        `Client error: ${errorName} – ${message}`,
        'GlobalExceptionFilter',
      );
    }

    // ── Error tracking ────────────────────────────────────────────────────────

    if (!isOperational && exception instanceof Error) {
      this.errorTracking.captureException(exception, {
        correlationId,
        extra: {
          method: req.method,
          url: req.url,
          statusCode,
        },
      });
    }

    // ── Response ──────────────────────────────────────────────────────────────

    const body: ErrorResponse = {
      statusCode,
      error: errorName,
      message,
      correlationId,
      timestamp: new Date().toISOString(),
      path,
      ...(code ? { code } : {}),
    };

    res.status(statusCode).json(body);
  }
}
