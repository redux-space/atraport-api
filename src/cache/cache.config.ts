import { CacheConfiguration, CacheWarmTask } from './cache.types';

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function booleanValue(value: string | undefined, fallback: boolean): boolean {
  if (value === undefined) return fallback;
  return !['false', '0', 'no', 'off'].includes(value.trim().toLowerCase());
}

function parseWarmKeys(raw: string | undefined): CacheWarmTask[] {
  if (!raw) return [];

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return [];

    const tasks: CacheWarmTask[] = [];
    for (const [key, value] of Object.entries(parsed)) {
      if (!value || typeof value !== 'object' || Array.isArray(value)) continue;
      const candidate = value as Record<string, unknown>;
      if (!('value' in candidate)) continue;
      const ttl = positiveInteger(String(candidate.ttl ?? ''), 0);
      tasks.push({
        key,
        ttl: ttl > 0 ? ttl : undefined,
        producer: () => candidate.value,
      });
    }
    return tasks;
  } catch {
    return [];
  }
}

export function loadCacheConfiguration(): CacheConfiguration {
  return {
    enabled: booleanValue(process.env.CACHE_ENABLED, true),
    defaultTtlMs: positiveInteger(process.env.CACHE_DEFAULT_TTL_MS, 60_000),
    memory: {
      maxKeys: positiveInteger(process.env.CACHE_MEMORY_MAX_KEYS, 10_000),
    },
    redis: {
      enabled: booleanValue(process.env.CACHE_REDIS_ENABLED, true),
      host: process.env.CACHE_REDIS_HOST ?? '127.0.0.1',
      port: positiveInteger(process.env.CACHE_REDIS_PORT, 6379),
      password: process.env.CACHE_REDIS_PASSWORD || undefined,
      db: positiveInteger(process.env.CACHE_REDIS_DB, 0),
      prefix: process.env.CACHE_REDIS_PREFIX ?? 'astraport:cache:',
    },
    warm: {
      enabled: booleanValue(process.env.CACHE_WARM_ENABLED, true),
      onStartup: booleanValue(process.env.CACHE_WARM_ON_STARTUP, true),
      keys: parseWarmKeys(process.env.CACHE_WARM_KEYS_JSON),
    },
  };
}