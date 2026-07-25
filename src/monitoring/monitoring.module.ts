import { Module, Global } from '@nestjs/common';
import { MonitoringController } from './monitoring.controller';
import { MetricsService } from './metrics.service';
import { HealthService } from './health.service';
import { TracingService } from './tracing.service';
import { PerformanceService } from './performance.service';
import { AlertingService } from './alerting.service';
import { LogAggregationService } from './log-aggregation.service';
import { StructuredLogger } from './logger.service';
import { MetricsInterceptor } from './interceptors/metrics.interceptor';

@Global()
@Module({
  controllers: [MonitoringController],
  providers: [
    MetricsService,
    HealthService,
    TracingService,
    PerformanceService,
    AlertingService,
    LogAggregationService,
    StructuredLogger,
    MetricsInterceptor,
  ],
  exports: [
    MetricsService,
    HealthService,
    TracingService,
    PerformanceService,
    AlertingService,
    LogAggregationService,
    StructuredLogger,
    MetricsInterceptor,
  ],
})
export class MonitoringModule {}
