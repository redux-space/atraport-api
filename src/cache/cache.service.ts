import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { MetricsService } from '../monitoring/metrics.service';
import { MemoryCacheBackend } from './backends/memory-cache';
import { RedisCacheBackend } from './backends/redis-cache';
import { loadCacheConfiguration } from './cache.config';
import {
  CacheConfiguration,
  CacheStatistics,
  CacheWarmTask,
} from './cache.types';

@Injectable()
export class CacheService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger('CacheService');
  private readonly config: CacheConfiguration;
  private readonly memory: MemoryCacheBackend;
  private readonly redis: RedisCacheBackend;
  private readonly warmupTasks = new Map<string, CacheWarmTask>();
  private readonly stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    invalidations: 0,
    warmups: 0,
  };

  constructor(private readonly metrics: MetricsService) {
    this.config = loadCacheConfiguration();
    this.memory = new MemoryCacheBackend(this.config.memory.maxKeys);
    this.redis = new RedisCacheBackend(this.config.redis);
    this.registerMetrics();
  }

  async onModuleInit(): Promise<void> {
    await this.redis.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.redis.disconnect();
  }

  getConfigurationSummary() {
    return {
      enabled: this.config.enabled,
      defaultTtlMs: this.config.defaultTtlMs,
      memory: this.config.memory,
      redis: {
        enabled: this.config.redis.enabled,
        host: this.config.redis.host,
        port: this.config.redis.port,
        db: this.config.redis.db,
        prefix: this.config.redis.prefix,
      },
      warm: {
        enabled: this.config.warm.enabled,
        onStartup: this.config.warm.onStartup,
        keys: this.config.warm.keys.map((task) => task.key),
      },
    };
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.config.enabled) return undefined;

    const memoryValue = await this.memory.get<T>(key);
    if (memoryValue !== undefined) {
      this.recordHit('memory');
      return memoryValue;
    }

    const redisValue = await this.redis.get<T>(key);
    if (redisValue !== undefined) {
      this.recordHit('redis');
      await this.memory.set(key, redisValue, this.config.defaultTtlMs);
      return redisValue;
    }

    this.recordMiss();
    return undefined;
  }

  async set<T>(key: string, value: T, ttlMs?: number): Promise<void> {
    if (!this.config.enabled) return;
    const ttl = ttlMs ?? this.config.defaultTtlMs;
    this.stats.sets += 1;
    this.metrics.incrementCounter('cache_sets_total');
    await this.memory.set(key, value, ttl);
    await this.redis.set(key, value, ttl);
  }

  async del(key: string): Promise<void> {
    if (!this.config.enabled) return;
    await this.memory.del(key);
    await this.redis.del(key);
  }

  async wrap<T>(
    key: string,
    producer: () => Promise<T> | T,
    ttlMs?: number,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) return cached;
    const value = await producer();
    if (value !== undefined && value !== null) {
      await this.set(key, value, ttlMs);
    }
    return value;
  }

  async invalidateByPrefix(prefix: string): Promise<number> {
    if (!this.config.enabled) return 0;
    const memoryCount = await this.memory.invalidateByPrefix(prefix);
    const redisCount = await this.redis.invalidateByPrefix(prefix);
    this.stats.invalidations += 1;
    this.metrics.incrementCounter('cache_invalidations_total');
    return memoryCount + redisCount;
  }

  async clear(): Promise<void> {
    if (!this.config.enabled) return;
    await this.memory.clear();
    await this.redis.clear();
    this.stats.invalidations += 1;
    this.metrics.incrementCounter('cache_invalidations_total');
  }

  registerWarmup(key: string, producer: CacheWarmTask['producer'], ttl?: number): void {
    this.warmupTasks.set(key, { key, producer, ttl });
  }

  async warmOnStartup(): Promise<number> {
    if (!this.config.warm.enabled || !this.config.warm.onStartup) return 0;
    return this.warmup();
  }

  async warmup(): Promise<number> {
    if (!this.config.warm.enabled) return 0;
    const tasks: CacheWarmTask[] = [
      ...this.config.warm.keys,
      ...this.warmupTasks.values(),
    ];

    for (const task of tasks) {
      try {
        const value = await task.producer();
        if (value !== undefined && value !== null) {
          await this.set(task.key, value, task.ttl);
          this.stats.warmups += 1;
          this.metrics.incrementCounter('cache_warmups_total');
        }
      } catch (error) {
        this.logger.warn(
          `Cache warmup failed for key "${task.key}": ${
            error instanceof Error ? error.message : String(error)
          }`,
          'CacheService',
        );
      }
    }
    return this.stats.warmups;
  }

  async getStatistics(): Promise<CacheStatistics> {
    const total = this.stats.hits + this.stats.misses;
    return {
      enabled: this.config.enabled,
      defaultTtlMs: this.config.defaultTtlMs,
      hits: this.stats.hits,
      misses: this.stats.misses,
      sets: this.stats.sets,
      invalidations: this.stats.invalidations,
      warmups: this.stats.warmups,
      hitRate: total === 0 ? 0 : this.stats.hits / total,
      backends: [
        {
          name: this.memory.name,
          available: this.memory.available,
          size: await this.memory.size(),
        },
        {
          name: this.redis.name,
          available: this.redis.available,
          size: await this.redis.size(),
        },
      ],
    };
  }

  private recordHit(backend: 'memory' | 'redis'): void {
    this.stats.hits += 1;
    this.metrics.incrementCounter('cache_hits_total', { backend });
  }

  private recordMiss(): void {
    this.stats.misses += 1;
    this.metrics.incrementCounter('cache_misses_total');
  }

  private registerMetrics(): void {
    this.metrics.registerMetric({
      name: 'cache_hits_total',
      help: 'Cache hits by backend',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'cache_misses_total',
      help: 'Cache misses',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'cache_sets_total',
      help: 'Cache write operations',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'cache_invalidations_total',
      help: 'Cache invalidation operations',
      type: 'counter',
      values: [],
    });
    this.metrics.registerMetric({
      name: 'cache_warmups_total',
      help: 'Keys loaded by cache warming',
      type: 'counter',
      values: [],
    });
  }
}