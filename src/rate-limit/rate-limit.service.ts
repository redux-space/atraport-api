import {
  Injectable,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';
import {
  SlidingWindowRateLimiter,
  TokenBucketRateLimiter,
} from './rate-limit.algorithms';
import { loadRateLimitConfiguration } from './rate-limit.config';
import {
  EndpointRateLimitPolicy,
  RateLimitAnalytics,
  RateLimitConfiguration,
  RateLimitDecision,
  RateLimitOverride,
  RateLimitPolicy,
  RateLimitResult,
  RateLimitScope,
} from './rate-limit.types';

interface RateLimitRequest {
  method?: string;
  ip?: string;
  url?: string;
  originalUrl?: string;
  route?: { path?: string };
  headers?: Record<string, string | string[] | undefined>;
  socket?: { remoteAddress?: string };
  user?: { id?: string };
}

interface AppliedLimit {
  scope: RateLimitScope;
  algorithm: RateLimitPolicy['algorithm'];
  result: RateLimitResult;
}

const MAX_IDLE_MS = 60 * 60 * 1000;

@Injectable()
export class RateLimitService implements OnModuleInit, OnModuleDestroy {
  private readonly tokenBucket = new TokenBucketRateLimiter();
  private readonly slidingWindow = new SlidingWindowRateLimiter();
  private readonly config: RateLimitConfiguration;
  private cleanupTimer: NodeJS.Timeout | null = null;
  private readonly analytics: Omit<RateLimitAnalytics, 'activeKeys'> = {
    total: 0,
    allowed: 0,
    rejected: 0,
    bypassed: 0,
    byScope: {
      ip: { allowed: 0, rejected: 0 },
      user: { allowed: 0, rejected: 0 },
      endpoint: { allowed: 0, rejected: 0 },
    },
  };

  constructor(private readonly metrics: MetricsService) {
    this.config = loadRateLimitConfiguration();
    this.registerMetrics();
  }

  onModuleInit(): void {
    this.cleanupTimer = setInterval(() => {
      const cutoff = Date.now() - MAX_IDLE_MS;
      this.tokenBucket.prune(cutoff);
      this.slidingWindow.prune(cutoff);
      this.updateActiveKeysMetric();
    }, 5 * 60 * 1000);
    this.cleanupTimer.unref();
  }

  onModuleDestroy(): void {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer);
    this.cleanupTimer = null;
  }

  check(
    request: RateLimitRequest,
    override?: RateLimitOverride,
    skip = false,
  ): RateLimitDecision {
    this.analytics.total += 1;
    if (!this.config.enabled || skip) return this.bypass('configuration');

    const ip = this.clientIp(request);
    const userId = request.user?.id;
    const apiKey = this.header(request, 'x-api-key');
    if (this.isWhitelisted(ip, userId, apiKey)) return this.bypass('whitelist');

    const limits: AppliedLimit[] = [];
    limits.push(this.apply('ip', `ip:${ip}`, this.config.ip));

    if (userId) {
      limits.push(this.apply('user', `user:${userId}`, this.config.user));
    }

    const endpointPolicy = override
      ? this.overridePolicy(request, override)
      : this.endpointPolicy(request);
    if (endpointPolicy) {
      const identity =
        endpointPolicy.scope === 'ip' || !userId ? `ip:${ip}` : `user:${userId}`;
      limits.push(
        this.apply(
          'endpoint',
          `endpoint:${this.requestPath(request)}:${identity}`,
          endpointPolicy,
        ),
      );
    }

    const denied = limits.find((limit) => !limit.result.allowed);
    const selected = denied ?? this.mostRestrictive(limits);
    this.analytics[denied ? 'rejected' : 'allowed'] += 1;
    this.updateActiveKeysMetric();

    return {
      ...selected.result,
      bypassed: false,
      scope: selected.scope,
      algorithm: selected.algorithm,
    };
  }

  getAnalytics(): RateLimitAnalytics {
    return {
      ...this.analytics,
      byScope: {
        ip: { ...this.analytics.byScope.ip },
        user: { ...this.analytics.byScope.user },
        endpoint: { ...this.analytics.byScope.endpoint },
      },
      activeKeys: this.tokenBucket.size + this.slidingWindow.size,
    };
  }

  getConfigurationSummary() {
    return {
      enabled: this.config.enabled,
      failOpen: this.config.failOpen,
      ip: this.config.ip,
      user: this.config.user,
      endpoints: this.config.endpoints,
      whitelistCounts: {
        ips: this.config.whitelist.ips.size,
        userIds: this.config.whitelist.userIds.size,
        apiKeys: this.config.whitelist.apiKeys.size,
      },
    };
  }

  shouldFailOpen(): boolean {
    return this.config.failOpen;
  }

  private apply(
    scope: RateLimitScope,
    key: string,
    policy: RateLimitPolicy,
  ): AppliedLimit {
    const limiter =
      policy.algorithm === 'sliding-window'
        ? this.slidingWindow
        : this.tokenBucket;
    const result = limiter.consume(`${scope}:${key}`, policy);
    const outcome = result.allowed ? 'allowed' : 'rejected';
    this.analytics.byScope[scope][outcome] += 1;
    this.metrics.incrementCounter('rate_limit_checks_total', {
      scope,
      algorithm: policy.algorithm,
      outcome,
    });
    if (!result.allowed) {
      this.metrics.incrementCounter('rate_limit_exceeded_total', { scope });
    }
    return { scope, algorithm: policy.algorithm, result };
  }

  private bypass(reason: string): RateLimitDecision {
    this.analytics.bypassed += 1;
    this.metrics.incrementCounter('rate_limit_bypassed_total', { reason });
    return {
      allowed: true,
      bypassed: true,
      limit: 0,
      remaining: 0,
      resetAt: Date.now(),
      retryAfterMs: 0,
    };
  }

  private mostRestrictive(limits: AppliedLimit[]): AppliedLimit {
    return limits.reduce((selected, candidate) => {
      const selectedRatio = selected.result.remaining / selected.result.limit;
      const candidateRatio = candidate.result.remaining / candidate.result.limit;
      return candidateRatio < selectedRatio ? candidate : selected;
    });
  }

  private endpointPolicy(
    request: RateLimitRequest,
  ): EndpointRateLimitPolicy | undefined {
    const method = (request.method ?? 'GET').toUpperCase();
    const path = this.requestPath(request);
    return this.config.endpoints.find((policy) => {
      if (policy.method && policy.method !== method) return false;
      return policy.path.endsWith('*')
        ? path.startsWith(policy.path.slice(0, -1))
        : path === policy.path;
    });
  }

  private overridePolicy(
    request: RateLimitRequest,
    override: RateLimitOverride,
  ): EndpointRateLimitPolicy {
    return {
      path: this.requestPath(request),
      limit: override.limit,
      windowMs: override.windowMs,
      algorithm: override.algorithm ?? 'token-bucket',
      scope: override.scope ?? 'user',
    };
  }

  private requestPath(request: RateLimitRequest): string {
    const routePath = request.route?.path;
    if (routePath) return routePath;
    return (request.originalUrl ?? request.url ?? '/').split('?')[0];
  }

  private clientIp(request: RateLimitRequest): string {
    return request.ip ?? request.socket?.remoteAddress ?? 'unknown';
  }

  private header(request: RateLimitRequest, name: string): string | undefined {
    const value = request.headers?.[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private isWhitelisted(
    ip: string,
    userId?: string,
    apiKey?: string,
  ): boolean {
    return (
      this.config.whitelist.ips.has(ip) ||
      (userId !== undefined &&
        this.config.whitelist.userIds.has(String(userId))) ||
      (apiKey !== undefined && this.config.whitelist.apiKeys.has(apiKey))
    );
  }

  private registerMetrics(): void {
    this.metrics.registerMetric({
      name: 'rate_limit_checks_total',
      help: 'Rate limit checks by scope, algorithm, and outcome',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'rate_limit_exceeded_total',
      help: 'Requests rejected by rate limit scope',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'rate_limit_bypassed_total',
      help: 'Requests that bypassed rate limiting',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'rate_limit_active_keys',
      help: 'Active in-memory rate limit keys',
      type: 'gauge',
      values: [],
    });
  }

  private updateActiveKeysMetric(): void {
    this.metrics.setGauge(
      'rate_limit_active_keys',
      this.tokenBucket.size + this.slidingWindow.size,
    );
  }
}
