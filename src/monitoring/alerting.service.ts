import { Injectable, OnModuleInit, OnModuleDestroy, Inject, forwardRef } from '@nestjs/common';
import { EventEmitter } from 'events';
import { AlertRule, FiredAlert } from './dto/monitoring.dto';
import { MetricsService } from './metrics.service';
import { HealthService } from './health.service';
import { PerformanceService } from './performance.service';

@Injectable()
export class AlertingService implements OnModuleInit, OnModuleDestroy {
  private rules: Map<string, AlertRule> = new Map();
  private firedAlertsHistory: FiredAlert[] = [];
  private readonly maxAlertHistory = 500;
  private evaluationTimer: NodeJS.Timeout | null = null;
  public readonly opsAlertEmitter = new EventEmitter();

  constructor(
    private readonly metricsService: MetricsService,
    private readonly healthService: HealthService,
    private readonly performanceService: PerformanceService,
  ) {
    this.initializeDefaultRules();
  }

  onModuleInit() {
    // Evaluate rules every 10 seconds
    this.evaluationTimer = setInterval(() => {
      this.evaluateRules().catch(() => {});
    }, 10000);
  }

  onModuleDestroy() {
    if (this.evaluationTimer) {
      clearInterval(this.evaluationTimer);
      this.evaluationTimer = null;
    }
  }

  private initializeDefaultRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'high-error-rate',
        name: 'HighErrorRate',
        expression: 'http_errors_total / http_requests_total * 100 > 5%',
        severity: 'critical',
        threshold: 5.0,
        windowMinutes: 5,
        enabled: true,
        state: 'ok',
      },
      {
        id: 'high-latency-p95',
        name: 'HighLatencyP95',
        expression: 'http_request_duration_p95 > 1000ms',
        severity: 'warning',
        threshold: 1000,
        windowMinutes: 5,
        enabled: true,
        state: 'ok',
      },
      {
        id: 'high-memory-usage',
        name: 'HighMemoryUsage',
        expression: 'process_memory_heap_used_bytes / process_memory_heap_total_bytes > 85%',
        severity: 'warning',
        threshold: 85,
        windowMinutes: 3,
        enabled: true,
        state: 'ok',
      },
      {
        id: 'database-disconnected',
        name: 'DatabaseDisconnected',
        expression: 'health_database_status == 0',
        severity: 'critical',
        threshold: 0,
        windowMinutes: 1,
        enabled: true,
        state: 'ok',
      },
      {
        id: 'rebalancing-failure-spike',
        name: 'RebalancingFailureSpike',
        expression: 'astraport_rebalancing_executions_total{status="failed"} > 3',
        severity: 'critical',
        threshold: 3,
        windowMinutes: 10,
        enabled: true,
        state: 'ok',
      },
    ];

    for (const rule of defaultRules) {
      this.rules.set(rule.id, rule);
    }
  }

  public async evaluateRules() {
    const apmSummary = this.performanceService.getSummary();
    const fullHealth = await this.healthService.getFullHealth();
    const now = new Date().toISOString();

    // 1. High Error Rate
    const errorRateRule = this.rules.get('high-error-rate');
    if (errorRateRule && errorRateRule.enabled) {
      errorRateRule.lastEvaluatedAt = now;
      if (apmSummary.totalRequests >= 10 && apmSummary.errorRatePercentage > errorRateRule.threshold) {
        this.fireAlert(errorRateRule, apmSummary.errorRatePercentage, `HTTP error rate is ${apmSummary.errorRatePercentage}% exceeding threshold ${errorRateRule.threshold}%`);
      } else if (errorRateRule.state === 'firing' && apmSummary.errorRatePercentage <= errorRateRule.threshold) {
        this.resolveAlert(errorRateRule);
      }
    }

    // 2. High Latency P95
    const latencyRule = this.rules.get('high-latency-p95');
    if (latencyRule && latencyRule.enabled) {
      latencyRule.lastEvaluatedAt = now;
      if (apmSummary.latencyMs.p95 > latencyRule.threshold) {
        this.fireAlert(latencyRule, apmSummary.latencyMs.p95, `HTTP p95 latency is ${apmSummary.latencyMs.p95}ms exceeding threshold ${latencyRule.threshold}ms`);
      } else if (latencyRule.state === 'firing' && apmSummary.latencyMs.p95 <= latencyRule.threshold) {
        this.resolveAlert(latencyRule);
      }
    }

    // 3. High Memory Usage
    const memoryRule = this.rules.get('high-memory-usage');
    if (memoryRule && memoryRule.enabled) {
      memoryRule.lastEvaluatedAt = now;
      const memUsage = process.memoryUsage();
      const heapUsedPercent = Math.round((memUsage.heapUsed / (memUsage.heapTotal || 1)) * 100);
      if (heapUsedPercent > memoryRule.threshold) {
        this.fireAlert(memoryRule, heapUsedPercent, `Process heap usage is ${heapUsedPercent}% exceeding threshold ${memoryRule.threshold}%`);
      } else if (memoryRule.state === 'firing' && heapUsedPercent <= memoryRule.threshold) {
        this.resolveAlert(memoryRule);
      }
    }

    // 4. Database Disconnected
    const dbRule = this.rules.get('database-disconnected');
    if (dbRule && dbRule.enabled) {
      dbRule.lastEvaluatedAt = now;
      const dbStatus = fullHealth.components.database?.status;
      if (dbStatus === 'down') {
        this.fireAlert(dbRule, 0, `Database connection status is DOWN: ${fullHealth.components.database?.error || 'Connection error'}`);
      } else if (dbRule.state === 'firing' && dbStatus !== 'down') {
        this.resolveAlert(dbRule);
      }
    }

    // 5. Rebalancing Failure Spike
    const rebalanceRule = this.rules.get('rebalancing-failure-spike');
    if (rebalanceRule && rebalanceRule.enabled) {
      rebalanceRule.lastEvaluatedAt = now;
      const failedCount = this.metricsService.getMetricValue('astraport_rebalancing_executions_total', { status: 'failed' });
      if (failedCount >= rebalanceRule.threshold) {
        this.fireAlert(rebalanceRule, failedCount, `Rebalancing failed executions count reached ${failedCount} (threshold: ${rebalanceRule.threshold})`);
      } else if (rebalanceRule.state === 'firing' && failedCount < rebalanceRule.threshold) {
        this.resolveAlert(rebalanceRule);
      }
    }
  }

  private fireAlert(rule: AlertRule, currentVal: number, message: string) {
    rule.state = 'firing';
    rule.lastFiredAt = new Date().toISOString();

    const firedAlert: FiredAlert = {
      id: `alert-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      ruleId: rule.id,
      ruleName: rule.name,
      severity: rule.severity,
      message,
      firedAt: rule.lastFiredAt,
      value: currentVal,
      threshold: rule.threshold,
    };

    this.firedAlertsHistory.unshift(firedAlert);
    if (this.firedAlertsHistory.length > this.maxAlertHistory) {
      this.firedAlertsHistory.pop();
    }

    // Dispatch real-time alert to Ops Team listeners
    this.dispatchOpsNotification(firedAlert);
  }

  private resolveAlert(rule: AlertRule) {
    rule.state = 'ok';
    const active = this.firedAlertsHistory.find((a) => a.ruleId === rule.id && !a.resolvedAt);
    if (active) {
      active.resolvedAt = new Date().toISOString();
      this.dispatchOpsNotification({
        ...active,
        message: `RESOLVED: ${rule.name}`,
      });
    }
  }

  private dispatchOpsNotification(alert: FiredAlert) {
    // Emit real-time event for Webhook / Logger / Ops dashboard
    this.opsAlertEmitter.emit('ops_alert', alert);

    // Also log formatted ops alert notification
    const alertPrefix = alert.resolvedAt ? '[OPS ALERT RESOLVED]' : '[OPS ALERT FIRING]';
    console.warn(`${alertPrefix} [${alert.severity.toUpperCase()}] ${alert.ruleName}: ${alert.message}`);
  }

  public triggerTestAlert(customMessage?: string): FiredAlert {
    const testRule: AlertRule = {
      id: 'test-ops-alert',
      name: 'TestOpsAlert',
      expression: 'test == 1',
      severity: 'warning',
      threshold: 1,
      windowMinutes: 1,
      enabled: true,
      state: 'firing',
      lastFiredAt: new Date().toISOString(),
    };

    const firedAlert: FiredAlert = {
      id: `test-alert-${Date.now()}`,
      ruleId: testRule.id,
      ruleName: testRule.name,
      severity: testRule.severity,
      message: customMessage || 'Manual verification test alert triggered for Ops Team notification testing',
      firedAt: testRule.lastFiredAt,
      value: 1,
      threshold: 1,
    };

    this.firedAlertsHistory.unshift(firedAlert);
    this.dispatchOpsNotification(firedAlert);
    return firedAlert;
  }

  public getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  public getFiredAlerts(): FiredAlert[] {
    return this.firedAlertsHistory;
  }
}
