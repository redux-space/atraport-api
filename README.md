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
