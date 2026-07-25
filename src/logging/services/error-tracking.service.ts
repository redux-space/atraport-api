import { Injectable, OnModuleInit } from '@nestjs/common';
import * as Sentry from '@sentry/node';
import { BaseAppError } from '../errors/base.error';
import { AppLoggerService } from './app-logger.service';

/**
 * Thin wrapper around the Sentry SDK.
 *
 * Initialised lazily: if `SENTRY_DSN` is not set the service is a no-op so
 * local development works without any Sentry account.
 */
@Injectable()
export class ErrorTrackingService implements OnModuleInit {
  private enabled = false;

  constructor(private readonly logger: AppLoggerService) {}

  onModuleInit(): void {
    const dsn = process.env.SENTRY_DSN;
    if (!dsn) {
      this.logger.warn(
        'SENTRY_DSN is not set – error tracking disabled',
        'ErrorTrackingService',
      );
      return;
    }

    Sentry.init({
      dsn,
      environment: process.env.NODE_ENV ?? 'development',
      release: process.env.APP_VERSION,
      // Capture 10 % of transactions for performance monitoring
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE ?? '0.1'),
      // Never forward PII
      sendDefaultPii: false,
    });

    this.enabled = true;
    this.logger.info('Sentry error tracking initialised', {
      service: 'ErrorTrackingService',
    });
  }

  /**
   * Capture an exception and attach contextual metadata.
   * Non-operational (programming) errors are always reported.
   * Operational errors are only reported if `force` is true.
   */
  captureException(
    error: Error,
    meta?: {
      correlationId?: string;
      userId?: string;
      extra?: Record<string, unknown>;
      force?: boolean;
    },
  ): string | undefined {
    const isOperational = error instanceof BaseAppError ? error.isOperational : false;

    if (!this.enabled) {
      return undefined;
    }

    if (isOperational && !meta?.force) {
      // Operational errors are expected; don't flood Sentry
      return undefined;
    }

    return Sentry.withScope((scope) => {
      if (meta?.correlationId) {
        scope.setTag('correlationId', meta.correlationId);
      }
      if (meta?.userId) {
        scope.setUser({ id: meta.userId });
      }
      if (meta?.extra) {
        scope.setExtras(meta.extra);
      }
      if (error instanceof BaseAppError) {
        scope.setTag('errorCode', error.code);
      }
      return Sentry.captureException(error);
    });
  }

  /**
   * Capture a plain message (e.g. for critical business alerts).
   */
  captureMessage(
    message: string,
    level: Sentry.SeverityLevel = 'info',
    extra?: Record<string, unknown>,
  ): string | undefined {
    if (!this.enabled) return undefined;
    return Sentry.withScope((scope) => {
      if (extra) scope.setExtras(extra);
      return Sentry.captureMessage(message, level);
    });
  }

  /**
   * Flush pending events to Sentry. Call this before process exit.
   */
  async flush(timeoutMs = 2000): Promise<void> {
    if (this.enabled) {
      await Sentry.flush(timeoutMs);
    }
  }
}
