import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import * as os from 'os';

export interface MetricValue {
  labels: Record<string, string>;
  value: number;
}

export interface Metric {
  name: string;
  help: string;
  type: 'counter' | 'gauge' | 'histogram';
  values: MetricValue[];
  buckets?: number[]; // For histograms
}

@Injectable()
export class MetricsService implements OnModuleInit, OnModuleDestroy {
  private metrics: Map<string, Metric> = new Map();
  private systemMetricsTimer: NodeJS.Timeout | null = null;
  private readonly defaultHistogramBuckets = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10];

  constructor() {
    this.initializeDefaultMetrics();
  }

  onModuleInit() {
    // Start collecting system metrics every 15 seconds
    this.collectSystemMetrics();
    this.systemMetricsTimer = setInterval(() => {
      this.collectSystemMetrics();
    }, 15000);
  }

  onModuleDestroy() {
    if (this.systemMetricsTimer) {
      clearInterval(this.systemMetricsTimer);
      this.systemMetricsTimer = null;
    }
  }

  private initializeDefaultMetrics() {
    // Standard HTTP Metrics
    this.registerMetric({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests processed',
      type: 'counter',
      values: [],
    });

    this.registerMetric({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      type: 'histogram',
      buckets: this.defaultHistogramBuckets,
      values: [],
    });

    this.registerMetric({
      name: 'http_requests_in_flight',
      help: 'Current number of HTTP requests being processed',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'http_errors_total',
      help: 'Total number of HTTP requests resulting in 4xx or 5xx errors',
      type: 'counter',
      values: [],
    });

    // System Resource Metrics
    this.registerMetric({
      name: 'process_cpu_usage_ratio',
      help: 'Current process CPU usage ratio (0.0 to 1.0 per core)',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'process_memory_rss_bytes',
      help: 'Process resident set size memory in bytes',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'process_memory_heap_used_bytes',
      help: 'Process heap memory used in bytes',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'process_memory_heap_total_bytes',
      help: 'Process total heap memory allocated in bytes',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'process_uptime_seconds',
      help: 'Node.js process uptime in seconds',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'system_memory_total_bytes',
      help: 'Total system memory in bytes',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'system_memory_free_bytes',
      help: 'Free system memory in bytes',
      type: 'gauge',
      values: [],
    });

    // Custom Business Metrics
    this.registerMetric({
      name: 'astraport_portfolio_analyses_total',
      help: 'Total portfolio analysis requests processed',
      type: 'counter',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_rebalancing_executions_total',
      help: 'Total portfolio rebalancing execution attempts by status',
      type: 'counter',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_rebalancing_schedule_count',
      help: 'Current count of active rebalancing schedules',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_risk_evaluations_total',
      help: 'Total risk evaluations performed',
      type: 'counter',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_risk_score_last',
      help: 'Most recently calculated risk score',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_contract_invocations_total',
      help: 'Total Soroban smart contract invocations',
      type: 'counter',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_active_subscriptions',
      help: 'Total active user/event subscriptions',
      type: 'gauge',
      values: [],
    });

    this.registerMetric({
      name: 'astraport_ai_triggers_active',
      help: 'Total active AI triggers registered',
      type: 'gauge',
      values: [],
    });
  }

  public registerMetric(metric: Metric) {
    if (!this.metrics.has(metric.name)) {
      this.metrics.set(metric.name, { ...metric, values: metric.values || [] });
    }
  }

  public incrementCounter(name: string, labels: Record<string, string> = {}, amount = 1) {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const existing = this.findMetricValue(metric, labels);
    if (existing) {
      existing.value += amount;
    } else {
      metric.values.push({ labels: { ...labels }, value: amount });
    }
  }

  public setGauge(name: string, value: number, labels: Record<string, string> = {}) {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const existing = this.findMetricValue(metric, labels);
    if (existing) {
      existing.value = value;
    } else {
      metric.values.push({ labels: { ...labels }, value });
    }
  }

  public recordObserveHistogram(name: string, valueInSeconds: number, labels: Record<string, string> = {}) {
    const metric = this.metrics.get(name);
    if (!metric) return;

    const existing = this.findMetricValue(metric, labels);
    if (existing) {
      existing.value += valueInSeconds; // Aggregate sum
    } else {
      metric.values.push({ labels: { ...labels }, value: valueInSeconds });
    }

    // Also record total count for Prometheus histogram (_count & _sum)
    const countMetricName = `${name}_count`;
    if (this.metrics.has(countMetricName)) {
      this.incrementCounter(countMetricName, labels, 1);
    }
  }

  private findMetricValue(metric: Metric, labels: Record<string, string>): MetricValue | undefined {
    return metric.values.find((v) => this.areLabelsEqual(v.labels, labels));
  }

  private areLabelsEqual(l1: Record<string, string>, l2: Record<string, string>): boolean {
    const k1 = Object.keys(l1);
    const k2 = Object.keys(l2);
    if (k1.length !== k2.length) return false;
    return k1.every((key) => l1[key] === l2[key]);
  }

  public collectSystemMetrics() {
    const memUsage = process.memoryUsage();
    this.setGauge('process_memory_rss_bytes', memUsage.rss);
    this.setGauge('process_memory_heap_used_bytes', memUsage.heapUsed);
    this.setGauge('process_memory_heap_total_bytes', memUsage.heapTotal);
    this.setGauge('process_uptime_seconds', Math.floor(process.uptime()));

    this.setGauge('system_memory_total_bytes', os.totalmem());
    this.setGauge('system_memory_free_bytes', os.freemem());

    const cpus = os.cpus();
    if (cpus && cpus.length > 0) {
      let totalIdle = 0;
      let totalTick = 0;
      cpus.forEach((cpu) => {
        for (const type in cpu.times) {
          totalTick += cpu.times[type as keyof typeof cpu.times];
        }
        totalIdle += cpu.times.idle;
      });
      const cpuUsage = 1 - totalIdle / (totalTick || 1);
      this.setGauge('process_cpu_usage_ratio', parseFloat(cpuUsage.toFixed(4)));
    }
  }

  public getPrometheusMetricsText(): string {
    this.collectSystemMetrics();
    const lines: string[] = [];

    for (const [name, metric] of this.metrics.entries()) {
      lines.push(`# HELP ${name} ${metric.help}`);
      lines.push(`# TYPE ${name} ${metric.type}`);

      if (metric.values.length === 0) {
        lines.push(`${name} 0`);
      } else {
        for (const val of metric.values) {
          const labelPairs = Object.entries(val.labels)
            .map(([k, v]) => `${k}="${this.escapeLabelValue(v)}"`)
            .join(',');
          const labelStr = labelPairs ? `{${labelPairs}}` : '';
          lines.push(`${name}${labelStr} ${val.value}`);
        }
      }
      lines.push('');
    }

    return lines.join('\n');
  }

  private escapeLabelValue(val: string): string {
    return val.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
  }

  public getMetricValue(name: string, labels: Record<string, string> = {}): number {
    const metric = this.metrics.get(name);
    if (!metric) return 0;
    const val = this.findMetricValue(metric, labels);
    return val ? val.value : 0;
  }
}
