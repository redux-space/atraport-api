import { Injectable, LoggerService, Scope } from '@nestjs/common';
import * as winston from 'winston';
import 'winston-daily-rotate-file';
import { redactSensitiveData } from '../utils/redact.util';

export type LogLevel = 'error' | 'warn' | 'info' | 'http' | 'debug' | 'verbose';

export interface LogMeta {
  /** Correlation ID from the current request */
  correlationId?: string;
  /** Name of the service/module emitting the log */
  service?: string;
  /** HTTP method, path, status for request logs */
  http?: {
    method?: string;
    url?: string;
    statusCode?: number;
    durationMs?: number;
    userAgent?: string;
    ip?: string;
  };
  /** Error details */
  error?: {
    name?: string;
    message?: string;
    stack?: string;
    code?: string;
  };
  /** Performance metrics */
  performance?: {
    durationMs: number;
    operation: string;
  };
  /** Arbitrary extra fields */
  [key: string]: unknown;
}

const LOG_DIR = process.env.LOG_DIR ?? 'logs';
const LOG_LEVEL: LogLevel = (process.env.LOG_LEVEL as LogLevel) ?? 'info';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

/** Winston format that redacts sensitive fields from the metadata object */
const redactFormat = winston.format((info) => {
  if (info.meta) {
    info.meta = redactSensitiveData(info.meta);
  }
  return info;
});

/** Pretty format for local development */
const devFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message, correlationId, service, ...rest }) => {
    const cid = correlationId ? ` [${correlationId}]` : '';
    const svc = service ? ` (${service})` : '';
    const extra = Object.keys(rest).length
      ? '\n  ' + JSON.stringify(redactSensitiveData(rest), null, 2).replace(/\n/g, '\n  ')
      : '';
    return `${timestamp} ${level}${svc}${cid}: ${message}${extra}`;
  }),
);

/** Compact JSON format for production / file transport */
const prodFormat = winston.format.combine(
  redactFormat(),
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json(),
);

function buildTransports(): winston.transport[] {
  const transports: winston.transport[] = [];

  // ─── Console ────────────────────────────────────────────────────────────────
  transports.push(
    new winston.transports.Console({
      format: NODE_ENV === 'production' ? prodFormat : devFormat,
      handleExceptions: true,
    }),
  );

  // ─── Rotating file — all logs ────────────────────────────────────────────────
  transports.push(
    new (winston.transports as any).DailyRotateFile({
      filename: `${LOG_DIR}/application-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '14d',
      format: prodFormat,
    }),
  );

  // ─── Rotating file — errors only ────────────────────────────────────────────
  transports.push(
    new (winston.transports as any).DailyRotateFile({
      filename: `${LOG_DIR}/error-%DATE%.log`,
      datePattern: 'YYYY-MM-DD',
      level: 'error',
      zippedArchive: true,
      maxSize: '20m',
      maxFiles: '30d',
      format: prodFormat,
    }),
  );

  return transports;
}

/**
 * Centralised structured logging service.
 *
 * Wraps Winston with:
 *  - JSON output (production) / coloured text (development)
 *  - Daily-rotating file transports
 *  - Automatic sensitive-data redaction
 *  - NestJS `LoggerService` interface so it can be injected as the built-in logger
 */
@Injectable({ scope: Scope.DEFAULT })
export class AppLoggerService implements LoggerService {
  private readonly logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: LOG_LEVEL,
      defaultMeta: { appName: 'astraport-api' },
      transports: buildTransports(),
      exitOnError: false,
    });
  }

  // ── NestJS LoggerService interface ──────────────────────────────────────────

  log(message: string, context?: string): void {
    this.info(message, { service: context });
  }

  error(message: string, trace?: string, context?: string): void;
  error(message: string, meta?: LogMeta): void;
  error(message: string, traceOrMeta?: string | LogMeta, context?: string): void {
    const meta: LogMeta =
      typeof traceOrMeta === 'string'
        ? { error: { stack: traceOrMeta }, service: context }
        : (traceOrMeta ?? {});
    this.logger.error(message, meta);
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { service: context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { service: context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { service: context });
  }

  // ── Extended helpers ─────────────────────────────────────────────────────────

  info(message: string, meta?: LogMeta): void {
    this.logger.info(message, meta);
  }

  http(message: string, meta?: LogMeta): void {
    this.logger.http(message, meta);
  }

  /**
   * Log an error object, including stack trace and any attached context.
   */
  logError(error: Error, meta?: LogMeta): void {
    this.logger.error(error.message, {
      ...meta,
      error: {
        name: error.name,
        message: error.message,
        stack: error.stack,
        code: (error as any).code,
      },
    });
  }

  /**
   * Log a performance timing measurement.
   */
  logPerformance(operation: string, durationMs: number, meta?: LogMeta): void {
    this.logger.info(`[PERF] ${operation} completed in ${durationMs}ms`, {
      ...meta,
      performance: { operation, durationMs },
    });
  }
}
