export type RateLimitAlgorithm = 'token-bucket' | 'sliding-window';
export type RateLimitScope = 'ip' | 'user' | 'endpoint';

export interface RateLimitPolicy {
  limit: number;
  windowMs: number;
  algorithm: RateLimitAlgorithm;
}

export interface EndpointRateLimitPolicy extends RateLimitPolicy {
  path: string;
  method?: string;
  scope?: 'ip' | 'user';
}

export interface RateLimitConfiguration {
  enabled: boolean;
  failOpen: boolean;
  ip: RateLimitPolicy;
  user: RateLimitPolicy;
  endpoints: EndpointRateLimitPolicy[];
  whitelist: {
    ips: Set<string>;
    userIds: Set<string>;
    apiKeys: Set<string>;
  };
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterMs: number;
}

export interface RateLimitDecision extends RateLimitResult {
  bypassed: boolean;
  scope?: RateLimitScope;
  algorithm?: RateLimitAlgorithm;
}

export interface RateLimitOverride {
  limit: number;
  windowMs: number;
  algorithm?: RateLimitAlgorithm;
  scope?: 'ip' | 'user';
}

export interface RateLimitAnalytics {
  total: number;
  allowed: number;
  rejected: number;
  bypassed: number;
  activeKeys: number;
  byScope: Record<RateLimitScope, { allowed: number; rejected: number }>;
}
