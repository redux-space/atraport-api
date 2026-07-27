import { Injectable, LoggerService } from '@nestjs/common';
import { LogAggregationService } from './log-aggregation.service';
import { LogEntry } from './dto/monitoring.dto';

@Injectable()
export class StructuredLogger implements LoggerService {
  constructor(private readonly logAggregationService: LogAggregationService) {}

  log(message: any, context?: string, meta?: Record<string, any>) {
    this.writeLog('info', message, context, meta);
  }

  error(
    message: any,
    traceOrContext?: string,
    contextOrMeta?: string | Record<string, any>,
    meta?: Record<string, any>,
  ) {
    if (contextOrMeta && typeof contextOrMeta === 'object') {
      this.writeLog('error', message, traceOrContext, contextOrMeta);
      return;
    }
    const context =
      typeof contextOrMeta === 'string' ? contextOrMeta : undefined;
    this.writeLog('error', message, context, {
      ...meta,
      stack: traceOrContext,
    });
  }

  warn(message: any, context?: string, meta?: Record<string, any>) {
    this.writeLog('warn', message, context, meta);
  }

  debug(message: any, context?: string, meta?: Record<string, any>) {
    this.writeLog('debug', message, context, meta);
  }

  verbose(message: any, context?: string, meta?: Record<string, any>) {
    this.writeLog('debug', message, context, meta);
  }

  private writeLog(
    level: 'info' | 'warn' | 'error' | 'debug',
    message: any,
    context?: string,
    meta: Record<string, any> = {},
  ) {
    const formattedMessage = typeof message === 'object' ? JSON.stringify(message) : String(message);

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message: formattedMessage,
      context: context || 'Application',
      traceId: meta.traceId,
      spanId: meta.spanId,
      route: meta.route,
      statusCode: meta.statusCode,
      durationMs: meta.durationMs,
      stack: meta.stack,
      ...meta,
    };

    // Forward to LogAggregationService
    this.logAggregationService.addLog(entry);

    // Output JSON to stdout / stderr
    const jsonStr = JSON.stringify(entry);
    if (level === 'error') {
      console.error(jsonStr);
    } else if (level === 'warn') {
      console.warn(jsonStr);
    } else {
      console.log(jsonStr);
    }
  }
}
