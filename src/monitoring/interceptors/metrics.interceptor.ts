import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpException,
} from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { MetricsService } from '../metrics.service';
import { TracingService } from '../tracing.service';
import { PerformanceService } from '../performance.service';
import { StructuredLogger } from '../logger.service';

@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly tracingService: TracingService,
    private readonly performanceService: PerformanceService,
    private readonly logger: StructuredLogger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const httpContext = context.switchToHttp();
    const request = httpContext.getRequest();
    const response = httpContext.getResponse();

    const path = request.route?.path || request.url || '/';
    const method = request.method || 'GET';

    // 1. Handle Tracing
    const traceparentHeader = request.headers['traceparent'] || request.headers['x-trace-id'];
    const { traceId: incomingTraceId, parentSpanId } = this.tracingService.parseTraceparent(traceparentHeader);

    const span = this.tracingService.startSpan(`${method} ${path}`, {
      traceId: incomingTraceId,
      parentSpanId,
      kind: 'SERVER',
      attributes: {
        'http.method': method,
        'http.url': request.url,
        'http.target': path,
        'user_agent': request.headers['user-agent'] || 'unknown',
      },
    });

    // Inject trace headers into response
    if (response.setHeader) {
      response.setHeader('x-trace-id', span.traceId);
      response.setHeader('x-span-id', span.spanId);
      response.setHeader('traceparent', this.tracingService.formatTraceparent(span.traceId, span.spanId));
    }

    // Attach trace info to request object
    request.traceId = span.traceId;
    request.spanId = span.spanId;

    // 2. Metrics & Performance Counters
    this.metricsService.setGauge('http_requests_in_flight', 1, { method, path });
    this.performanceService.incrementActiveRequests();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const durationMs = Date.now() - startTime;
        const durationSeconds = durationMs / 1000;
        const statusCode = response.statusCode || 200;

        // Finish span
        this.tracingService.finishSpan(span, 'OK', { 'http.status_code': statusCode });

        // Update Metrics
        this.metricsService.incrementCounter('http_requests_total', { method, path, status: String(statusCode) });
        this.metricsService.recordObserveHistogram('http_request_duration_seconds', durationSeconds, { method, path });
        this.metricsService.setGauge('http_requests_in_flight', 0, { method, path });
        this.performanceService.decrementActiveRequests();

        if (statusCode >= 400) {
          this.metricsService.incrementCounter('http_errors_total', { method, path, status: String(statusCode) });
        }

        // Record APM
        this.performanceService.recordRequest(durationMs, statusCode);

        // Structured Logging
        this.logger.log(`HTTP ${method} ${path} ${statusCode} - ${durationMs}ms`, 'HTTP', {
          traceId: span.traceId,
          spanId: span.spanId,
          route: path,
          statusCode,
          durationMs,
        });
      }),
      catchError((error) => {
        const durationMs = Date.now() - startTime;
        const durationSeconds = durationMs / 1000;
        const statusCode = error instanceof HttpException ? error.getStatus() : 500;

        // Finish span with error
        this.tracingService.finishSpan(span, 'ERROR', {
          'http.status_code': statusCode,
          'error.name': error.name || 'Error',
          'error.message': error.message || 'Request failed',
        });

        // Update Metrics
        this.metricsService.incrementCounter('http_requests_total', { method, path, status: String(statusCode) });
        this.metricsService.incrementCounter('http_errors_total', { method, path, status: String(statusCode) });
        this.metricsService.recordObserveHistogram('http_request_duration_seconds', durationSeconds, { method, path });
        this.metricsService.setGauge('http_requests_in_flight', 0, { method, path });
        this.performanceService.decrementActiveRequests();

        // Record APM
        this.performanceService.recordRequest(durationMs, statusCode);

        // Structured Logging
        this.logger.error(`HTTP ${method} ${path} ${statusCode} failed: ${error.message}`, error.stack, 'HTTP', {
          traceId: span.traceId,
          spanId: span.spanId,
          route: path,
          statusCode,
          durationMs,
        });

        return throwError(() => error);
      }),
    );
  }
}
