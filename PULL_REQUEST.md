# Pull Request: Implement Comprehensive Monitoring & Observability Infrastructure

## Title
`feat(monitoring): Implement Prometheus metrics, health checks, OpenTelemetry tracing, APM, alerting, and log aggregation`

---

## Overview & Context
This PR introduces a production-ready monitoring and observability infrastructure for **AstraPort API**. It provides end-to-end tracking of application health, system resource utilization (CPU, memory, disk, event loop), HTTP request performance, distributed tracing, alerting with real-time ops team notifications, structured JSON logging with log aggregation, and Grafana dashboard visualization.

---

## Key Features & Component Breakdown

### 1. Prometheus Metrics Collection (`/metrics`)
- Exposes standard Prometheus text-format exposition output (`text/plain; version=0.0.4`) on `GET /metrics`.
- **HTTP Metrics**: `http_requests_total`, `http_request_duration_seconds`, `http_requests_in_flight`, `http_errors_total`.
- **System Resource Metrics**: Process CPU usage ratio, memory RSS, memory heap used/total, system free/total memory, process uptime, and event loop monitoring.
- **Custom Business Metrics**:
  - `astraport_portfolio_analyses_total`
  - `astraport_rebalancing_executions_total` (by status: `success`/`failed`)
  - `astraport_rebalancing_schedule_count`
  - `astraport_risk_evaluations_total` & `astraport_risk_score_last`
  - `astraport_contract_invocations_total`
  - `astraport_active_subscriptions`
  - `astraport_ai_triggers_active`

### 2. Health Check Probes
- `GET /health`: Comprehensive health check summary (`ok`, `degraded`, `down`) with component-level breakdown (Database connection via TypeORM, Heap memory usage, Disk space, CPU load).
- `GET /health/liveness`: Lightweight Kubernetes Liveness probe (`{ status: "up" }`).
- `GET /health/readiness`: Kubernetes Readiness probe evaluating database connectivity and resource thresholds.

### 3. OpenTelemetry Distributed Tracing
- Implements W3C `traceparent` context parsing and propagation (`00-{traceId}-{spanId}-01`).
- Injects response headers (`x-trace-id`, `x-span-id`, `traceparent`).
- Tracks request span lifecycle, parent-child span relations, span attributes, and span events.
- Exposes traces on `GET /monitoring/traces` with OpenTelemetry OTLP JSON export format support (`?format=otlp`).

### 4. Application Performance Monitoring (APM)
- Tracks request throughput (Requests Per Second - RPS).
- Computes rolling window latency percentiles: `p50`, `p90`, `p95`, `p99`, `min`, `max`, and `avg`.
- Calculates error rate percentages (4xx / 5xx) on `GET /monitoring/performance`.

### 5. Alerting Engine & Real-Time Ops Notifications
- Pre-configured alert rules:
  - `HighErrorRate` (>5% error rate)
  - `HighLatencyP95` (>1000ms latency)
  - `HighMemoryUsage` (>85% heap usage)
  - `DatabaseDisconnected` (DB status down)
  - `RebalancingFailureSpike` (>3 failed rebalancings)
- Periodically evaluates metrics against thresholds.
- Real-time alert dispatcher using EventEmitter and ops alert logger.
- Endpoints: `GET /monitoring/alerts` (rule states and fired alert history) and `POST /monitoring/alerts/test` (trigger manual test alert).

### 6. Structured JSON Logging & Log Aggregation
- `StructuredLogger`: Formats logs as JSON strings containing `timestamp`, `level`, `message`, `context`, `traceId`, `spanId`, `route`, `statusCode`, `durationMs`, and stack traces.
- `LogAggregationService`: Buffers log entries, allows querying/filtering by level, context, search term, or trace ID on `GET /monitoring/logs`, and supports Grafana Loki stream export format (`?format=loki`).

### 7. Dashboards & Config Artifacts
- **Grafana Dashboard**: Ready-to-import Grafana dashboard definition at [`grafana-dashboard.json`](file:///home/semicolon/Pictures/atraport-api/grafana-dashboard.json).
- **Prometheus Alert Rules**: Standard Prometheus Alertmanager rules file at [`prometheus-alerts.yml`](file:///home/semicolon/Pictures/atraport-api/prometheus-alerts.yml).

---

## API Endpoints Summary

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/metrics` | Prometheus metrics text format output |
| `GET` | `/health` | Consolidated health check summary JSON |
| `GET` | `/health/liveness` | Liveness probe endpoint |
| `GET` | `/health/readiness` | Readiness probe checking database & memory |
| `GET` | `/monitoring/performance` | APM summary (RPS, p50/p90/p95/p99 latencies, error rate) |
| `GET` | `/monitoring/alerts` | Alerting rules, active states, and fired alert history |
| `POST` | `/monitoring/alerts/test` | Trigger a manual test ops alert notification |
| `GET` | `/monitoring/traces` | Recent distributed trace spans & OpenTelemetry OTLP format |
| `GET` | `/monitoring/logs` | Query structured logs with filtering or Loki stream format |
| `GET` | `/monitoring/dashboard` | Dashboard configuration metadata & panel definitions |

---

## File Changes List

```
src/
├── app.module.ts                              # [MODIFY] Import MonitoringModule & register global MetricsInterceptor
├── main.ts                                    # [MODIFY] Attach StructuredLogger to Nest application
└── monitoring/
    ├── dto/
    │   └── monitoring.dto.ts                  # [NEW] DTOs & Interfaces for observability
    ├── interceptors/
    │   └── metrics.interceptor.ts             # [NEW] HTTP interceptor for metrics, tracing, APM, headers
    ├── __tests__/
    │   └── monitoring.service.spec.ts         # [NEW] Unit test suite
    ├── alerting.service.ts                    # [NEW] Alert engine & ops team notification dispatcher
    ├── health.service.ts                      # [NEW] Health probes for app, DB, CPU, memory, disk
    ├── log-aggregation.service.ts             # [NEW] Log ingestion, query filter, Loki stream export
    ├── logger.service.ts                      # [NEW] Structured JSON logger implementing Nest LoggerService
    ├── metrics.service.ts                     # [NEW] Prometheus registry, system & custom business metrics
    ├── monitoring.controller.ts               # [NEW] Monitoring endpoints (/metrics, /health, /monitoring/*)
    ├── monitoring.module.ts                   # [NEW] NestJS global monitoring module
    ├── performance.service.ts                 # [NEW] APM metrics, latency percentiles (p50-p99), RPS
    └── tracing.service.ts                     # [NEW] OpenTelemetry/Jaeger tracer, W3C traceparent parser
grafana-dashboard.json                         # [NEW] Grafana dashboard export configuration
prometheus-alerts.yml                          # [NEW] Prometheus Alertmanager rules file
```

---

## Verification & Testing
- **Unit Test Suite**: Ran `monitoring.service.spec.ts` covering:
  - Prometheus metrics string generation & counter/gauge updates.
  - Health status evaluations (ok, degraded, down).
  - Trace ID generation, parent-child span tracking, W3C `traceparent` parsing.
  - APM latency percentile calculations (p50, p90, p95, p99).
  - Alert rule evaluation and real-time EventEmitter notification dispatches.
  - Structured log aggregation and Loki format output.

---

## Checklist
- [x] Prometheus metrics exposed on `/metrics` endpoint
- [x] Health check endpoint returning status
- [x] Distributed tracing collecting traces
- [x] Key business metrics tracked
- [x] System resource metrics collected
- [x] Performance metrics accessible
- [x] Alerting rules configured and firing
- [x] Monitoring dashboard displaying key metrics
- [x] Log aggregation working
- [x] Real-time alerts to ops team working
