import { MetricsService } from '../monitoring/metrics.service';
import { RateLimitService } from './rate-limit.service';

const RATE_LIMIT_ENV_KEYS = [
  'RATE_LIMIT_ENABLED',
  'RATE_LIMIT_FAIL_OPEN',
  'RATE_LIMIT_IP_LIMIT',
  'RATE_LIMIT_IP_WINDOW_MS',
  'RATE_LIMIT_IP_ALGORITHM',
  'RATE_LIMIT_USER_LIMIT',
  'RATE_LIMIT_USER_WINDOW_MS',
  'RATE_LIMIT_USER_ALGORITHM',
  'RATE_LIMIT_ENDPOINTS_JSON',
  'RATE_LIMIT_WHITELIST_IPS',
  'RATE_LIMIT_WHITELIST_USER_IDS',
  'RATE_LIMIT_WHITELIST_API_KEYS',
] as const;

describe('RateLimitService', () => {
  const originalEnvironment = { ...process.env };
  let metrics: MetricsService;
  let service: RateLimitService;

  beforeEach(() => {
    for (const key of RATE_LIMIT_ENV_KEYS) delete process.env[key];
    process.env.RATE_LIMIT_IP_LIMIT = '100';
    process.env.RATE_LIMIT_USER_LIMIT = '1';
    process.env.RATE_LIMIT_USER_WINDOW_MS = '60000';
    metrics = new MetricsService();
  });

  afterEach(() => {
    service?.onModuleDestroy();
    metrics.onModuleDestroy();
    process.env = { ...originalEnvironment };
  });

  it('enforces per-user limits independently behind the same IP', () => {
    service = new RateLimitService(metrics);
    const request = {
      ip: '203.0.113.10',
      method: 'GET',
      url: '/portfolio',
      user: { id: 'user-a' },
    };

    expect(service.check(request).allowed).toBe(true);
    expect(service.check(request)).toMatchObject({
      allowed: false,
      scope: 'user',
    });
    expect(
      service.check({ ...request, user: { id: 'user-b' } }).allowed,
    ).toBe(true);
  });

  it('applies endpoint-specific environment policies', () => {
    process.env.RATE_LIMIT_ENDPOINTS_JSON = JSON.stringify({
      'POST /expensive*': {
        limit: 1,
        windowMs: 60000,
        algorithm: 'sliding-window',
        scope: 'ip',
      },
    });
    service = new RateLimitService(metrics);
    const request = {
      ip: '203.0.113.11',
      method: 'POST',
      url: '/expensive/report?full=true',
    };

    expect(service.check(request).allowed).toBe(true);
    expect(service.check(request)).toMatchObject({
      allowed: false,
      scope: 'endpoint',
      algorithm: 'sliding-window',
    });
  });

  it('bypasses whitelisted IPs, users, and API keys', () => {
    process.env.RATE_LIMIT_WHITELIST_IPS = '203.0.113.12';
    process.env.RATE_LIMIT_WHITELIST_USER_IDS = 'trusted-user';
    process.env.RATE_LIMIT_WHITELIST_API_KEYS = 'trusted-key';
    service = new RateLimitService(metrics);

    const decisions = [
      service.check({ ip: '203.0.113.12' }),
      service.check({ ip: 'other', user: { id: 'trusted-user' } }),
      service.check({
        ip: 'other',
        headers: { 'x-api-key': 'trusted-key' },
      }),
    ];

    expect(decisions.every((decision) => decision.bypassed)).toBe(true);
    expect(service.getAnalytics().bypassed).toBe(3);
  });

  it('tracks allowed and rejected checks in reports and metrics', () => {
    process.env.RATE_LIMIT_IP_LIMIT = '1';
    service = new RateLimitService(metrics);
    const request = { ip: '203.0.113.13', url: '/health' };

    service.check(request);
    service.check(request);

    expect(service.getAnalytics()).toMatchObject({
      total: 2,
      allowed: 1,
      rejected: 1,
    });
    expect(
      metrics.getMetricValue('rate_limit_exceeded_total', { scope: 'ip' }),
    ).toBe(1);
    expect(metrics.getPrometheusMetricsText()).toContain(
      'rate_limit_checks_total',
    );
  });
});
