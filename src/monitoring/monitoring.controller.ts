import {
  Controller,
  Get,
  Post,
  Query,
  Body,
  Header,
  Res,
  HttpStatus,
} from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { HealthService } from './health.service';
import { TracingService } from './tracing.service';
import { PerformanceService } from './performance.service';
import { AlertingService } from './alerting.service';
import { LogAggregationService } from './log-aggregation.service';
import { LogQueryFilter } from './dto/monitoring.dto';

@Controller()
export class MonitoringController {
  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
    private readonly tracingService: TracingService,
    private readonly performanceService: PerformanceService,
    private readonly alertingService: AlertingService,
    private readonly logAggregationService: LogAggregationService,
  ) {}

  @Get('metrics')
  @Header('Content-Type', 'text/plain; version=0.0.4; charset=utf-8')
  getMetrics() {
    return this.metricsService.getPrometheusMetricsText();
  }

  @Get('health')
  async getHealth() {
    return this.healthService.getFullHealth();
  }

  @Get('health/liveness')
  async getLiveness() {
    return this.healthService.getLiveness();
  }

  @Get('health/readiness')
  async getReadiness() {
    return this.healthService.getReadiness();
  }

  @Get('monitoring/performance')
  getPerformanceSummary() {
    return this.performanceService.getSummary();
  }

  @Get('monitoring/alerts')
  getAlerts() {
    return {
      rules: this.alertingService.getRules(),
      firedHistory: this.alertingService.getFiredAlerts(),
    };
  }

  @Post('monitoring/alerts/test')
  triggerTestAlert(@Body('message') message?: string) {
    const alert = this.alertingService.triggerTestAlert(message);
    return {
      status: 'success',
      message: 'Test ops alert triggered successfully',
      alert,
    };
  }

  @Get('monitoring/traces')
  getTraces(
    @Query('limit') limit?: string,
    @Query('traceId') traceId?: string,
    @Query('format') format?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    if (format === 'otlp' || format === 'opentelemetry') {
      return this.tracingService.getOpenTelemetryFormattedTraces(parsedLimit);
    }
    return {
      spans: this.tracingService.getRecentTraces(parsedLimit, traceId),
    };
  }

  @Get('monitoring/logs')
  getLogs(
    @Query('level') level?: any,
    @Query('context') context?: string,
    @Query('traceId') traceId?: string,
    @Query('search') search?: string,
    @Query('limit') limit?: string,
    @Query('format') format?: string,
  ) {
    const filter: LogQueryFilter = {
      level,
      context,
      traceId,
      search,
      limit: limit ? parseInt(limit, 10) : 100,
    };

    if (format === 'loki') {
      return this.logAggregationService.getLokiFormattedLogs(filter.limit);
    }

    return this.logAggregationService.queryLogs(filter);
  }

  @Get('monitoring/dashboard')
  getDashboardConfig() {
    return {
      title: 'AstraPort API Monitoring & Observability Dashboard',
      description: 'Production observability dashboard for tracking health, performance, APM, tracing, and business metrics.',
      panels: [
        { id: 1, title: 'Health Status', type: 'stat', target: 'health_status' },
        { id: 2, title: 'Request Rate (RPS)', type: 'timeseries', metric: 'http_requests_total' },
        { id: 3, title: 'Latency Percentiles (p50, p95, p99)', type: 'timeseries', metric: 'http_request_duration_seconds' },
        { id: 4, title: 'Error Rate', type: 'gauge', metric: 'http_errors_total' },
        { id: 5, title: 'CPU & Memory Usage', type: 'timeseries', metrics: ['process_cpu_usage_ratio', 'process_memory_rss_bytes'] },
        { id: 6, title: 'Rebalancing & Risk Business Metrics', type: 'stat', metrics: ['astraport_rebalancing_executions_total', 'astraport_risk_evaluations_total'] },
      ],
      grafanaJsonPath: '/grafana-dashboard.json',
    };
  }
}
