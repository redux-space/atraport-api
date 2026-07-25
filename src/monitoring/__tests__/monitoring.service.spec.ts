import { Test, TestingModule } from '@nestjs/testing';
import { MetricsService } from '../metrics.service';
import { HealthService } from '../health.service';
import { TracingService } from '../tracing.service';
import { PerformanceService } from '../performance.service';
import { AlertingService } from '../alerting.service';
import { LogAggregationService } from '../log-aggregation.service';
import { StructuredLogger } from '../logger.service';

describe('Monitoring Infrastructure Test Suite', () => {
  let metricsService: MetricsService;
  let healthService: HealthService;
  let tracingService: TracingService;
  let performanceService: PerformanceService;
  let alertingService: AlertingService;
  let logAggregationService: LogAggregationService;
  let structuredLogger: StructuredLogger;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MetricsService,
        HealthService,
        TracingService,
        PerformanceService,
        AlertingService,
        LogAggregationService,
        StructuredLogger,
      ],
    }).compile();

    metricsService = module.get<MetricsService>(MetricsService);
    healthService = module.get<HealthService>(HealthService);
    tracingService = module.get<TracingService>(TracingService);
    performanceService = module.get<PerformanceService>(PerformanceService);
    alertingService = module.get<AlertingService>(AlertingService);
    logAggregationService = module.get<LogAggregationService>(LogAggregationService);
    structuredLogger = module.get<StructuredLogger>(StructuredLogger);
  });

  afterEach(() => {
    metricsService.onModuleDestroy();
    alertingService.onModuleDestroy();
  });

  describe('MetricsService', () => {
    it('should generate valid Prometheus metrics output', () => {
      metricsService.incrementCounter('http_requests_total', { method: 'GET', path: '/health', status: '200' });
      metricsService.setGauge('astraport_rebalancing_schedule_count', 5);

      const prometheusText = metricsService.getPrometheusMetricsText();
      expect(prometheusText).toContain('# HELP http_requests_total');
      expect(prometheusText).toContain('# TYPE http_requests_total counter');
      expect(prometheusText).toContain('http_requests_total{method="GET",path="/health",status="200"} 1');
      expect(prometheusText).toContain('astraport_rebalancing_schedule_count 5');
    });

    it('should increment counters and update gauges correctly', () => {
      metricsService.incrementCounter('astraport_portfolio_analyses_total', { type: 'full' }, 2);
      expect(metricsService.getMetricValue('astraport_portfolio_analyses_total', { type: 'full' })).toBe(2);

      metricsService.setGauge('astraport_risk_score_last', 78);
      expect(metricsService.getMetricValue('astraport_risk_score_last')).toBe(78);
    });
  });

  describe('HealthService', () => {
    it('should return liveness status UP', async () => {
      const liveness = await healthService.getLiveness();
      expect(liveness.status).toBe('up');
      expect(liveness.timestamp).toBeDefined();
    });

    it('should return readiness status and component details', async () => {
      const readiness = await healthService.getReadiness();
      expect(readiness.status).toBe('up');
      expect(readiness.components.memory.status).toBe('up');
      expect(readiness.components.disk.status).toBe('up');
    });

    it('should return full health status summary', async () => {
      const health = await healthService.getFullHealth();
      expect(health.status).toBe('ok');
      expect(health.version).toBe('0.1.0');
      expect(health.components.database).toBeDefined();
      expect(health.components.cpu).toBeDefined();
    });
  });

  describe('TracingService', () => {
    it('should generate trace and span IDs', () => {
      const traceId = tracingService.generateTraceId();
      const spanId = tracingService.generateSpanId();
      expect(traceId.length).toBe(32);
      expect(spanId.length).toBe(16);
    });

    it('should parse and format W3C traceparent headers', () => {
      const traceId = '4bf92f3577b34da6a3ce929d0e0e4736';
      const spanId = '00f067aa0ba902b7';
      const header = tracingService.formatTraceparent(traceId, spanId);
      expect(header).toBe(`00-${traceId}-${spanId}-01`);

      const parsed = tracingService.parseTraceparent(header);
      expect(parsed.traceId).toBe(traceId);
      expect(parsed.parentSpanId).toBe(spanId);
    });

    it('should track spans and export in OpenTelemetry format', () => {
      const span = tracingService.startSpan('GET /api/rebalancing', { kind: 'SERVER' });
      tracingService.setSpanAttribute(span, 'user.id', 'usr_123');
      tracingService.addSpanEvent(span, 'cache_hit', { key: 'reb_schedule' });
      tracingService.finishSpan(span, 'OK', { 'http.status_code': 200 });

      const recent = tracingService.getRecentTraces(10);
      expect(recent.length).toBeGreaterThan(0);
      expect(recent[0].name).toBe('GET /api/rebalancing');

      const otlp = tracingService.getOpenTelemetryFormattedTraces(10);
      expect(otlp.resourceSpans.length).toBe(1);
      expect(otlp.resourceSpans[0].scopeSpans[0].spans[0].traceId).toBe(span.traceId);
    });
  });

  describe('PerformanceService', () => {
    it('should calculate APM latency percentiles and RPS correctly', () => {
      // Record sample latencies
      [10, 20, 30, 40, 50, 100, 200, 500, 1000].forEach((lat) => {
        performanceService.recordRequest(lat, 200);
      });
      performanceService.recordRequest(1500, 500); // 1 error

      const summary = performanceService.getSummary();
      expect(summary.totalRequests).toBe(10);
      expect(summary.errorCount).toBe(1);
      expect(summary.errorRatePercentage).toBe(10);
      expect(summary.latencyMs.min).toBe(10);
      expect(summary.latencyMs.max).toBe(1500);
      expect(summary.latencyMs.p50).toBeGreaterThan(0);
      expect(summary.latencyMs.p95).toBeGreaterThan(0);
    });
  });

  describe('AlertingService', () => {
    it('should trigger test ops alert and emit real-time event', (done) => {
      alertingService.opsAlertEmitter.once('ops_alert', (firedAlert) => {
        expect(firedAlert.ruleName).toBe('TestOpsAlert');
        expect(firedAlert.severity).toBe('warning');
        done();
      });

      const alert = alertingService.triggerTestAlert('Test verification');
      expect(alert.ruleId).toBe('test-ops-alert');
    });

    it('should return configured alert rules list', () => {
      const rules = alertingService.getRules();
      expect(rules.length).toBeGreaterThanOrEqual(5);
      const ruleNames = rules.map((r) => r.name);
      expect(ruleNames).toContain('HighErrorRate');
      expect(ruleNames).toContain('DatabaseDisconnected');
    });
  });

  describe('LogAggregationService & StructuredLogger', () => {
    it('should aggregate JSON logs and allow filtering by level and search term', () => {
      structuredLogger.log('System initialized successfully', 'Bootstrap', { traceId: 'trace-111' });
      structuredLogger.error('Failed to connect to Soroban contract', 'ContractService', { traceId: 'trace-222' });

      const allLogs = logAggregationService.queryLogs({ limit: 10 });
      expect(allLogs.total).toBeGreaterThanOrEqual(2);

      const errorLogs = logAggregationService.queryLogs({ level: 'error' });
      expect(errorLogs.logs.length).toBe(1);
      expect(errorLogs.logs[0].message).toContain('Soroban contract');

      const traceLogs = logAggregationService.queryLogs({ traceId: 'trace-111' });
      expect(traceLogs.logs.length).toBe(1);

      const lokiLogs = logAggregationService.getLokiFormattedLogs(10);
      expect(lokiLogs.streams.length).toBeGreaterThan(0);
      expect(lokiLogs.streams[0].stream.app).toBe('astraport-api');
    });
  });
});
