# AstraPort API

Minimal scaffold for AstraPort API (NestJS)

## Getting started

Install and run in development:

```bash
npm install
npm run start:dev
```

Run tests:

```bash
npm test
```

## Rate limiting

All HTTP endpoints are protected by combined per-IP and per-user limits. Public
requests use the IP policy; authenticated requests must satisfy both policies.
Token-bucket and sliding-window algorithms are supported, and the most
restrictive active policy is reported in:

- `X-RateLimit-Limit`
- `X-RateLimit-Remaining`
- `X-RateLimit-Reset` (Unix timestamp in seconds)
- `X-RateLimit-Scope`
- `Retry-After` on rejected requests

Rejected requests return HTTP `429` with code `RATE_LIMIT_EXCEEDED`. Metrics are
included in `/metrics`, and administrators can retrieve the aggregate report at
`GET /monitoring/rate-limits`.

### Configuration

| Variable | Default | Description |
|---|---:|---|
| `RATE_LIMIT_ENABLED` | `true` | Enables global rate limiting |
| `RATE_LIMIT_FAIL_OPEN` | `true` | Allows requests if the limiter itself fails |
| `RATE_LIMIT_IP_LIMIT` | `100` | Per-IP capacity |
| `RATE_LIMIT_IP_WINDOW_MS` | `60000` | Per-IP refill/window duration |
| `RATE_LIMIT_IP_ALGORITHM` | `token-bucket` | Per-IP algorithm |
| `RATE_LIMIT_USER_LIMIT` | `300` | Per-user capacity |
| `RATE_LIMIT_USER_WINDOW_MS` | `60000` | Per-user refill/window duration |
| `RATE_LIMIT_USER_ALGORITHM` | `sliding-window` | Per-user algorithm |
| `RATE_LIMIT_ENDPOINTS_JSON` | `{}` | Endpoint policy map (see below) |
| `RATE_LIMIT_WHITELIST_IPS` | empty | Comma-separated trusted IPs |
| `RATE_LIMIT_WHITELIST_USER_IDS` | empty | Comma-separated trusted user IDs |
| `RATE_LIMIT_WHITELIST_API_KEYS` | empty | Comma-separated trusted API keys |
| `RATE_LIMIT_TRUST_PROXY` | unset | Express proxy hop count or trusted subnet |

Endpoint selectors may include an HTTP method and a trailing `*` wildcard:

```bash
RATE_LIMIT_ENDPOINTS_JSON='{
  "POST /auth/login": {
    "limit": 5,
    "windowMs": 60000,
    "algorithm": "sliding-window",
    "scope": "ip"
  },
  "/ai/*": {
    "limit": 20,
    "windowMs": 60000,
    "algorithm": "token-bucket",
    "scope": "user"
  }
}'
```

Only set `RATE_LIMIT_TRUST_PROXY` when the API is behind a trusted proxy that
removes client-supplied forwarding headers. A value of `1` is typical for one
reverse-proxy hop.

Individual controllers or handlers can override or skip the configured policy:

```ts
import { RateLimit, SkipRateLimit } from './rate-limit';

@RateLimit({
  limit: 10,
  windowMs: 60_000,
  algorithm: 'sliding-window',
  scope: 'user',
})
@Post('expensive-operation')
runExpensiveOperation() {}

@SkipRateLimit()
@Get('internal-probe')
internalProbe() {}
```

The default store is process-local and prunes inactive clients automatically.
For a horizontally scaled deployment, route a client consistently to one
instance or replace the limiter store with a shared atomic backend.

## Caching

A multi-layer cache (in-memory L1 + optional Redis L2) lives in `src/cache/`.
Lookups hit memory first, fall back to Redis, and populate the memory layer on
a Redis hit. Redis failures are non-fatal: the memory layer keeps serving and a
warning is logged once.

### Usage

Cache a service method by injecting `CacheService` as `cacheService` and adding
`@Cached()` (keys are derived from class, method, and serialized arguments):

```ts
import { Injectable } from '@nestjs/common';
import { CacheService, Cached, InvalidateCache } from '../cache';

@Injectable()
export class PortfolioService {
  constructor(public cacheService: CacheService) {}

  @Cached({ ttl: 30_000 })
  async getSummary(id: string) {
    // Expensive query; result is cached for 30s.
  }

  @InvalidateCache() // clears this class's cached entries on mutation
  async refresh(id: string) {
    // Write path; invalidates stale data.
  }
}
```

Opt an HTTP handler into conditional caching (ETag / Last-Modified):

```ts
import { ConditionalCache } from '../cache';

@ConditionalCache({ maxAge: 30_000 })
@Get('portfolio/summary')
getSummary() {
  return this.portfolioService.getSummary('main');
}
```

Responses include `ETag` and `Last-Modified`; repeat requests with a matching
`If-None-Match` receive `304 Not Modified`.

Register warmup producers at startup with `cacheService.registerWarmup(key, producer, ttl?)`
or define static warm keys via `CACHE_WARM_KEYS_JSON`. Warming runs in the
background during bootstrap and on demand at `POST /monitoring/cache/warm`.

### Configuration

| Variable | Default | Description |
|---|---:|---|
| `CACHE_ENABLED` | `true` | Master switch for the cache layer |
| `CACHE_DEFAULT_TTL_MS` | `60000` | Default TTL when none is provided |
| `CACHE_MEMORY_MAX_KEYS` | `10000` | In-memory entry limit (LRU-ish eviction) |
| `CACHE_REDIS_ENABLED` | `true` | Enables the Redis (L2) backend |
| `CACHE_REDIS_HOST` | `127.0.0.1` | Redis host |
| `CACHE_REDIS_PORT` | `6379` | Redis port |
| `CACHE_REDIS_PASSWORD` | unset | Redis password |
| `CACHE_REDIS_DB` | `0` | Redis logical database |
| `CACHE_REDIS_PREFIX` | `astraport:cache:` | Key prefix for Redis entries |
| `CACHE_WARM_ENABLED` | `true` | Enables cache warming |
| `CACHE_WARM_ON_STARTUP` | `true` | Warms registered keys during bootstrap |
| `CACHE_WARM_KEYS_JSON` | `{}` | Static warm keys, e.g. `{"config:limits":{"value":20,"ttl":60000}}` |

Cache hit/miss/set/invalidation/warmup counters are exposed on `/metrics`, and
administrators can inspect live statistics, trigger warming, or clear the cache
at `GET/POST/DELETE /monitoring/cache`.

Build and run production image:

```bash
npm run build
docker build -t astraport-api .
docker run -p 3000:3000 astraport-api
```

---

## Centralized Error Handling & Logging

All error handling and structured logging lives in `src/logging/`.

### Architecture

```
src/logging/
├── errors/                   # Custom error classes
│   ├── base.error.ts         # BaseAppError abstract class
│   └── app.errors.ts         # Domain-specific errors
├── filters/
│   └── global-exception.filter.ts   # Catches ALL exceptions globally
├── interceptors/
│   └── http-logging.interceptor.ts  # Request/response logging + timing
├── middleware/
│   └── correlation-id.middleware.ts # x-correlation-id header per request
├── services/
│   ├── app-logger.service.ts        # Winston-based structured logger
│   └── error-tracking.service.ts   # Sentry integration
├── utils/
│   ├── redact.util.ts               # Sensitive data redaction
│   └── performance.decorator.ts    # @TrackPerformance() method decorator
└── logging.module.ts               # Global NestJS module
```

### Custom Error Classes

Throw typed errors from anywhere in the app for consistent HTTP responses:

```ts
import {
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ResourceNotFoundError,
  ConflictError,
  BusinessLogicError,
  RateLimitError,
  ExternalServiceError,
  InternalError,
  PortfolioError,
  InsufficientBalanceError,
} from './logging/errors';

// 404
throw new ResourceNotFoundError('Portfolio', portfolioId);

// 422 — business rule violation
throw new PortfolioError('Cannot rebalance a locked portfolio');

// 502 — downstream service failed
throw new ExternalServiceError('StellarHorizon', 'Timeout after 30s');
```

All errors expose:
- `statusCode` — used by the global filter to set the HTTP response status
- `code` — machine-readable string identifier returned in the JSON response
- `isOperational` — `true` for expected errors (4xx), `false` for programming errors (5xx)
- `context` — optional object with structured debugging metadata

### Request Correlation IDs

Every request automatically gets a `x-correlation-id` header. If the client sends
one it is reused; otherwise a UUID v4 is generated. The ID is:
- Attached to `req.correlationId`
- Echoed back in the response header
- Included in every log line for that request

### Structured Logging

Inject `AppLoggerService` instead of NestJS's built-in `Logger`:

```ts
import { AppLoggerService } from '../logging/services/app-logger.service';

@Injectable()
export class MyService {
  constructor(private readonly logger: AppLoggerService) {}

  async doWork(correlationId: string) {
    this.logger.info('Starting work', { correlationId, service: 'MyService' });
    this.logger.logPerformance('doWork', 120, { correlationId });
    this.logger.logError(new Error('oops'), { correlationId });
  }
}
```

Log transports:
- **Console** — coloured text in development, JSON in production
- **`logs/application-YYYY-MM-DD.log`** — all levels, rotated daily, 14-day retention
- **`logs/error-YYYY-MM-DD.log`** — errors only, rotated daily, 30-day retention

Environment variables:

| Variable    | Default       | Description                          |
|-------------|---------------|--------------------------------------|
| `LOG_LEVEL` | `info`        | Minimum log level                    |
| `LOG_DIR`   | `logs`        | Directory for rotating log files     |
| `NODE_ENV`  | `development` | Controls log format (JSON in `production`) |

### Performance Monitoring

Use the `@TrackPerformance()` decorator on any service method:

```ts
import { TrackPerformance } from '../logging/utils/performance.decorator';

@Injectable()
export class MyService {
  constructor(private readonly logger: AppLoggerService) {}

  @TrackPerformance()
  async expensiveQuery() { … }
}
```

This logs `[PERF] MyService.expensiveQuery completed in Xms` automatically.

### Sensitive Data Redaction

Passwords, tokens, API keys, and other secrets are automatically stripped from
request bodies and log metadata before writing. The default redacted keys are:
`password`, `token`, `secret`, `apiKey`, `authorization`, `privateKey`,
`creditCard`, `cvv`, `ssn`, `mnemonic`, `seed`, and several aliases.

Use the utility directly when needed:

```ts
import { redactSensitiveData, redactUrlParams } from '../logging/utils/redact.util';

const safe = redactSensitiveData({ user: 'alice', password: 'hunter2' });
// => { user: 'alice', password: '[REDACTED]' }
```

### Error Tracking (Sentry)

Set `SENTRY_DSN` in your environment to enable Sentry reporting. Programming errors
(`isOperational = false`) are automatically captured. Operational errors (expected
4xx) are not sent to keep Sentry noise-free.

```bash
SENTRY_DSN=https://xxxx@sentry.io/project-id
SENTRY_TRACES_SAMPLE_RATE=0.1   # optional, default 0.1
APP_VERSION=1.2.3               # optional, sets the release tag
```

---

## Rebalancing schedules

The API now includes rebalancing schedule management under the `/api/rebalancing` route:

- `POST /api/rebalancing/schedule`
- `GET /api/rebalancing/schedule/:portfolioId`
- `PUT /api/rebalancing/schedule/:portfolioId`
- `DELETE /api/rebalancing/schedule/:portfolioId`
- `GET /api/rebalancing/execution-history/:portfolioId`
- `GET /api/rebalancing/next-execution/:portfolioId`
- `POST /api/rebalancing/execute-now`
- `POST /api/rebalancing/validate-schedule`

Example payload:

```json
{
  "portfolioId": "portfolio-1",
  "enabled": true,
  "intervalMinutes": 30,
  "startAt": "2026-07-23T10:00:00.000Z",
  "timezone": "UTC"
}
```

## API documentation

- Swagger UI: http://localhost:3000/docs
- ReDoc: http://localhost:3000/docs/redoc
- OpenAPI spec: ./openapi.json
- Generated SDK stub: ./generated-client.ts

### Regenerate docs

```bash
npm run build
npm run generate:docs
```
