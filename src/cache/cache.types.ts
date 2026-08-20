export interface CacheBackend {
  readonly name: string;
  readonly available: boolean;
  get<T>(key: string): Promise<T | undefined>;
  set<T>(key: string, value: T, ttlMs: number): Promise<void>;
  del(key: string): Promise<void>;
  invalidateByPrefix(prefix: string): Promise<number>;
  clear(): Promise<void>;
  size(): Promise<number>;
}

export interface CacheDecoratorOptions {
  /** Fixed cache key. When omitted the key is derived from class + method + args. */
  key?: string;
  /** TTL in milliseconds; falls back to CACHE_DEFAULT_TTL_MS. */
  ttl?: number;
}

export interface ConditionalCacheOptions {
  /** Sets `Cache-Control: public, max-age=<s>`. Omitted → `no-cache`. */
  maxAge?: number;
}

export interface CacheWarmTask {
  key: string;
  ttl?: number;
  producer: () => unknown | Promise<unknown>;
}

export interface CacheConfiguration {
  enabled: boolean;
  defaultTtlMs: number;
  memory: {
    maxKeys: number;
  };
  redis: {
    enabled: boolean;
    host: string;
    port: number;
    password?: string;
    db: number;
    prefix: string;
  };
  warm: {
    enabled: boolean;
    onStartup: boolean;
    keys: CacheWarmTask[];
  };
}

export interface CacheStatistics {
  enabled: boolean;
  defaultTtlMs: number;
  hits: number;
  misses: number;
  sets: number;
  invalidations: number;
  warmups: number;
  hitRate: number;
  backends: { name: string; available: boolean; size: number }[];
}