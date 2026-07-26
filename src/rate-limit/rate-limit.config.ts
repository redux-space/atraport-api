import {
  EndpointRateLimitPolicy,
  RateLimitAlgorithm,
  RateLimitConfiguration,
  RateLimitPolicy,
} from './rate-limit.types';

const DEFAULT_WINDOW_MS = 60_000;

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function algorithmValue(
  value: unknown,
  fallback: RateLimitAlgorithm,
): RateLimitAlgorithm {
  return value === 'sliding-window' || value === 'token-bucket'
    ? value
    : fallback;
}

function stringSet(value: string | undefined): Set<string> {
  return new Set(
    (value ?? '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  );
}

function parseEndpointKey(
  key: string,
): Pick<EndpointRateLimitPolicy, 'method' | 'path'> {
  const match = key.trim().match(/^([A-Za-z]+)\s+(.+)$/);
  if (!match) return { path: key.trim() };
  return { method: match[1].toUpperCase(), path: match[2].trim() };
}

function parseEndpointPolicies(
  raw: string | undefined,
): EndpointRateLimitPolicy[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

    const policies: EndpointRateLimitPolicy[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        continue;
      }
      const candidate = value as Record<string, unknown>;
      const limit = Number(candidate.limit);
      const windowMs = Number(candidate.windowMs);
      if (
        !Number.isInteger(limit) ||
        limit <= 0 ||
        !Number.isInteger(windowMs) ||
        windowMs <= 0
      ) {
        continue;
      }
      const selector = parseEndpointKey(key);
      policies.push({
        ...selector,
        limit,
        windowMs,
        algorithm: algorithmValue(candidate.algorithm, 'token-bucket'),
        scope: candidate.scope === 'ip' ? 'ip' : 'user',
      });
    }
    return policies;
  } catch {
    return [];
  }
}

function policyFromEnvironment(
  prefix: 'IP' | 'USER',
  defaults: RateLimitPolicy,
): RateLimitPolicy {
  return {
    limit: positiveInteger(
      process.env[`RATE_LIMIT_${prefix}_LIMIT`],
      defaults.limit,
    ),
    windowMs: positiveInteger(
      process.env[`RATE_LIMIT_${prefix}_WINDOW_MS`],
      defaults.windowMs,
    ),
    algorithm: algorithmValue(
      process.env[`RATE_LIMIT_${prefix}_ALGORITHM`],
      defaults.algorithm,
    ),
  };
}

export function loadRateLimitConfiguration(): RateLimitConfiguration {
  return {
    enabled: booleanValue(process.env.RATE_LIMIT_ENABLED, true),
    failOpen: booleanValue(process.env.RATE_LIMIT_FAIL_OPEN, true),
    ip: policyFromEnvironment('IP', {
      limit: 100,
      windowMs: DEFAULT_WINDOW_MS,
      algorithm: 'token-bucket',
    }),
    user: policyFromEnvironment('USER', {
      limit: 300,
      windowMs: DEFAULT_WINDOW_MS,
      algorithm: 'sliding-window',
    }),
    endpoints: parseEndpointPolicies(
      process.env.RATE_LIMIT_ENDPOINTS_JSON,
    ),
    whitelist: {
      ips: stringSet(process.env.RATE_LIMIT_WHITELIST_IPS),
      userIds: stringSet(process.env.RATE_LIMIT_WHITELIST_USER_IDS),
      apiKeys: stringSet(process.env.RATE_LIMIT_WHITELIST_API_KEYS),
    },
  };
}
