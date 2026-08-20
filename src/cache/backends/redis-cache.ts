import { Logger } from '@nestjs/common';
import { Redis } from 'ioredis';
import { CacheBackend } from '../cache.types';

export interface RedisCacheOptions {
  enabled: boolean;
  host: string;
  port: number;
  password?: string;
  db: number;
  prefix: string;
}

export class RedisCacheBackend implements CacheBackend {
  readonly name = 'redis';
  private readonly logger = new Logger('RedisCache');
  private readonly client: Redis | null;
  private readonly prefix: string;
  private online = false;
  private warned = false;

  constructor(private readonly options: RedisCacheOptions) {
    this.prefix = options.prefix;
    if (!options.enabled) {
      this.client = null;
      return;
    }

    this.client = new Redis({
      host: options.host,
      port: options.port,
      password: options.password,
      db: options.db,
      lazyConnect: true,
      enableOfflineQueue: false,
      maxRetriesPerRequest: 1,
      retryStrategy: () => null,
      connectTimeout: 2000,
    });
    this.client.on('connect', () => {
      this.online = true;
    });
    this.client.on('close', () => {
      this.online = false;
    });
    this.client.on('error', (error) => {
      this.online = false;
      if (!this.warned) {
        this.warned = true;
        this.logger.warn(
          `Redis unavailable (${error.message}); falling back to memory cache`,
          'RedisCache',
        );
      }
    });
  }

  get available(): boolean {
    return this.online;
  }

  async connect(): Promise<void> {
    if (!this.client || this.online) return;
    try {
      await this.client.connect();
    } catch {
      // Connection failures are non-fatal; the memory layer keeps serving.
    }
  }

  async disconnect(): Promise<void> {
    if (!this.client) return;
    try {
      await this.client.quit();
    } catch {
      // Ignore teardown errors.
    }
  }

  async get<T>(key: string): Promise<T | undefined> {
    if (!this.client || !this.online) return undefined;
    try {
      const raw = await this.client.get(this.prefix + key);
      if (raw === null || raw === undefined) return undefined;
      return JSON.parse(raw) as T;
    } catch {
      return undefined;
    }
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    if (!this.client || !this.online) return;
    try {
      await this.client.set(this.prefix + key, JSON.stringify(value), 'PX', ttlMs);
    } catch {
      // Non-fatal: the memory layer already holds the value.
    }
  }

  async del(key: string): Promise<void> {
    if (!this.client || !this.online) return;
    try {
      await this.client.del(this.prefix + key);
    } catch {
      // Ignore.
    }
  }

  async invalidateByPrefix(prefix: string): Promise<number> {
    if (!this.client || !this.online) return 0;
    const pattern = `${this.prefix}${prefix}*`;
    let count = 0;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          pattern,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) {
          count += keys.length;
          await this.client.del(...keys);
        }
      } while (cursor !== '0');
    } catch {
      return 0;
    }
    return count;
  }

  async clear(): Promise<void> {
    if (!this.client || !this.online) return;
    try {
      let cursor = '0';
      do {
        const [next, keys] = await this.client.scan(
          cursor,
          'MATCH',
          `${this.prefix}*`,
          'COUNT',
          100,
        );
        cursor = next;
        if (keys.length > 0) await this.client.del(...keys);
      } while (cursor !== '0');
    } catch {
      // Ignore.
    }
  }

  async size(): Promise<number> {
    if (!this.client || !this.online) return 0;
    try {
      return await this.client.dbsize();
    } catch {
      return 0;
    }
  }
}