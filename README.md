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

# AstraPort API

AstraPort API is the backend service built with **NestJS**.  
It exposes endpoints for portfolio analysis, risk scoring, and integration with Stellar smart contracts.

## Repo Structure
- /docs        → API usage and endpoint documentation
- /examples    → Example API calls and integrations
- /src         → NestJS modules and services

## Modules
- Auth: JWT-based authentication
- Portfolio: Endpoints for wallet and market data
- Risk: Endpoints for risk scoring (from Core AI)
- Contracts: Integration with Soroban smart contracts

## Tech Stack
- NestJS (TypeScript)
- PostgreSQL
- TypeORM
- Stellar SDK

## Getting Started
1. Clone the repo
2. Install dependencies: `npm install`
3. Run the server: `npm run start:dev`

## Examples
See `/examples` for sample API requests and integrations.
