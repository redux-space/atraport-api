export interface ComponentHealth {
  status: 'up' | 'degraded' | 'down';
  details?: Record<string, any>;
  error?: string;
}

export interface HealthCheckResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptimeSeconds: number;
  version: string;
  components: {
    database: ComponentHealth;
    memory: ComponentHealth;
    disk: ComponentHealth;
    cpu: ComponentHealth;
    [key: string]: ComponentHealth;
  };
}

export interface TraceSpan {
  traceId: string;
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind: 'SERVER' | 'CLIENT' | 'INTERNAL';
  startTimeMs: number;
  endTimeMs?: number;
  durationMs?: number;
  statusCode: 'OK' | 'ERROR' | 'UNSET';
  attributes: Record<string, any>;
  events: Array<{ name: string; timestampMs: number; attributes?: Record<string, any> }>;
}

export interface AlertRule {
  id: string;
  name: string;
  expression: string;
  severity: 'critical' | 'warning' | 'info';
  threshold: number;
  windowMinutes: number;
  enabled: boolean;
  state: 'ok' | 'pending' | 'firing';
  lastEvaluatedAt?: string;
  lastFiredAt?: string;
}

export interface FiredAlert {
  id: string;
  ruleId: string;
  ruleName: string;
  severity: 'critical' | 'warning' | 'info';
  message: string;
  firedAt: string;
  resolvedAt?: string;
  value: number;
  threshold: number;
  details?: Record<string, any>;
}

export interface LogEntry {
  timestamp: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  context?: string;
  traceId?: string;
  spanId?: string;
  route?: string;
  statusCode?: number;
  durationMs?: number;
  stack?: string;
  [key: string]: any;
}

export interface LogQueryFilter {
  level?: 'info' | 'warn' | 'error' | 'debug';
  context?: string;
  traceId?: string;
  search?: string;
  limit?: number;
  startTime?: string;
  endTime?: string;
}

export interface ApmPerformanceSummary {
  rps: number;
  totalRequests: number;
  errorCount: number;
  errorRatePercentage: number;
  latencyMs: {
    p50: number;
    p90: number;
    p95: number;
    p99: number;
    avg: number;
    min: number;
    max: number;
  };
  activeRequests: number;
}
