import { CallHandler, ExecutionContext } from '@nestjs/common';
import { Subject } from 'rxjs';
import { MetricsInterceptor } from '../interceptors/metrics.interceptor';
import { MetricsService } from '../metrics.service';
import { TracingService } from '../tracing.service';
import { PerformanceService } from '../performance.service';
import { StructuredLogger } from '../logger.service';

const GAUGE = 'http_requests_in_flight';
const labels = { method: 'GET', path: '/jobs' };

function httpContext(): ExecutionContext {
  const request = { method: 'GET', url: '/jobs', route: { path: '/jobs' }, headers: {} };
  const response = { statusCode: 200, setHeader: jest.fn() };
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }),
  } as unknown as ExecutionContext;
}

describe('MetricsInterceptor in-flight gauge', () => {
  let metrics: MetricsService;
  let interceptor: MetricsInterceptor;

  beforeEach(() => {
    metrics = new MetricsService();
    metrics.onModuleInit();
    interceptor = new MetricsInterceptor(
      metrics,
      new TracingService(),
      new PerformanceService(),
      { log: jest.fn(), error: jest.fn() } as unknown as StructuredLogger,
    );
  });

  function start() {
    const source = new Subject<unknown>();
    const handler: CallHandler = { handle: () => source };
    const sub = interceptor.intercept(httpContext(), handler).subscribe({ error: () => undefined });
    return { source, sub };
  }

  it('counts concurrent requests and drops one at a time as they finish', () => {
    const requests = Array.from({ length: 5 }, () => start());
    expect(metrics.getMetricValue(GAUGE, labels)).toBe(5);

    const seen: number[] = [];
    for (const { source } of requests) {
      source.next('ok');
      source.complete();
      seen.push(metrics.getMetricValue(GAUGE, labels));
    }

    expect(seen).toEqual([4, 3, 2, 1, 0]);
  });

  it('decrements when a request fails', () => {
    const a = start();
    start();
    expect(metrics.getMetricValue(GAUGE, labels)).toBe(2);

    a.source.error(new Error('boom'));

    expect(metrics.getMetricValue(GAUGE, labels)).toBe(1);
  });

  it('decrements when the client aborts', () => {
    const { sub } = start();
    expect(metrics.getMetricValue(GAUGE, labels)).toBe(1);

    sub.unsubscribe();

    expect(metrics.getMetricValue(GAUGE, labels)).toBe(0);
  });

  it('never goes below zero', () => {
    metrics.decrementGauge(GAUGE, labels);
    metrics.incrementGauge(GAUGE, labels);
    metrics.decrementGauge(GAUGE, labels, 5);

    expect(metrics.getMetricValue(GAUGE, labels)).toBe(0);
  });
});
