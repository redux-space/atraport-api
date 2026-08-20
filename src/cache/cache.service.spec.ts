import { MetricsService } from '../monitoring/metrics.service';
import { Cached, InvalidateCache } from './cache.decorators';
import { CacheService } from './cache.service';
import { MemoryCacheBackend } from './backends/memory-cache';

const CACHE_ENV_KEYS = [
  'CACHE_ENABLED',
  'CACHE_DEFAULT_TTL_MS',
  'CACHE_MEMORY_MAX_KEYS',
  'CACHE_REDIS_ENABLED',
  'CACHE_REDIS_HOST',
  'CACHE_REDIS_PORT',
  'CACHE_REDIS_PASSWORD',
  'CACHE_REDIS_DB',
  'CACHE_REDIS_PREFIX',
  'CACHE_WARM_ENABLED',
  'CACHE_WARM_ON_STARTUP',
  'CACHE_WARM_KEYS_JSON',
] as const;

describe('MemoryCacheBackend', () => {
  let cache: MemoryCacheBackend;

  beforeEach(() => {
    cache = new MemoryCacheBackend(100);
  });

  it('stores and retrieves values', async () => {
    await cache.set('key', { answer: 42 }, 60_000);
    await expect(cache.get('key')).resolves.toEqual({ answer: 42 });
  });

  it('expires entries after their TTL', async () => {
    await cache.set('key', 'value', 20);
    await expect(cache.get('key')).resolves.toBe('value');
    await new Promise((resolve) => setTimeout(resolve, 30));
    await expect(cache.get('key')).resolves.toBeUndefined();
  });

  it('evicts the oldest key when full', async () => {
    const small = new MemoryCacheBackend(2);
    await small.set('a', 1, 60_000);
    await small.set('b', 2, 60_000);
    await small.set('c', 3, 60_000);
    await expect(small.get('a')).resolves.toBeUndefined();
    await expect(small.get('c')).resolves.toBe(3);
  });

  it('invalidates keys by prefix', async () => {
    await cache.set('users:1', 'a', 60_000);
    await cache.set('users:2', 'b', 60_000);
    await cache.set('reports:1', 'c', 60_000);
    await expect(cache.invalidateByPrefix('users:')).resolves.toBe(2);
    await expect(cache.get('users:1')).resolves.toBeUndefined();
    await expect(cache.get('reports:1')).resolves.toBe('c');
  });
});

describe('CacheService', () => {
  const originalEnvironment = { ...process.env };
  let metrics: MetricsService;
  let service: CacheService;

  beforeEach(async () => {
    for (const key of CACHE_ENV_KEYS) delete process.env[key];
    process.env.CACHE_REDIS_ENABLED = 'false';
    process.env.CACHE_WARM_ENABLED = 'false';
    metrics = new MetricsService();
    service = new CacheService(metrics);
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    metrics.onModuleDestroy();
    process.env = { ...originalEnvironment };
  });

  it('returns cached values and tracks hits', async () => {
    await service.set('portfolio:1', { name: 'Main' }, 60_000);
    await expect(service.get('portfolio:1')).resolves.toEqual({ name: 'Main' });
    await expect(service.get('portfolio:1')).resolves.toEqual({ name: 'Main' });
    const stats = await service.getStatistics();
    expect(stats.hits).toBe(2);
    expect(stats.hitRate).toBe(1);
  });

  it('records misses when the key is absent', async () => {
    await expect(service.get('missing')).resolves.toBeUndefined();
    const stats = await service.getStatistics();
    expect(stats.misses).toBe(1);
    expect(stats.hitRate).toBe(0);
  });

  it('wrap computes once and serves cached result afterwards', async () => {
    let calls = 0;
    const producer = async () => {
      calls += 1;
      return { value: calls };
    };

    const first = await service.wrap('compute:x', producer, 60_000);
    const second = await service.wrap('compute:x', producer, 60_000);
    expect(first).toEqual({ value: 1 });
    expect(second).toEqual({ value: 1 });
    expect(calls).toBe(1);
  });

  it('invalidates entries by prefix on mutation', async () => {
    await service.set('users:list', [{ id: 1 }], 60_000);
    await expect(service.get('users:list')).resolves.toEqual([{ id: 1 }]);

    await expect(service.invalidateByPrefix('users:')).resolves.toBe(1);
    await expect(service.get('users:list')).resolves.toBeUndefined();
  });
});

describe('cache decorators', () => {
  const originalEnvironment = { ...process.env };
  let service: CacheService;

  class PortfolioService {
    calls = 0;
    constructor(public cacheService: CacheService) {}

    @Cached({ ttl: 60_000 })
    async getSummary(id: string) {
      this.calls += 1;
      return { id, summary: `summary-${id}` };
    }

    @InvalidateCache()
    async refresh() {
      this.calls += 1;
      return true;
    }
  }

  beforeEach(async () => {
    for (const key of CACHE_ENV_KEYS) delete process.env[key];
    process.env.CACHE_REDIS_ENABLED = 'false';
    process.env.CACHE_WARM_ENABLED = 'false';
    service = new CacheService(new MetricsService());
    await service.onModuleInit();
  });

  afterEach(async () => {
    await service.onModuleDestroy();
    process.env = { ...originalEnvironment };
  });

  it('caches service method results', async () => {
    const portfolio = new PortfolioService(service);

    const first = await portfolio.getSummary('a');
    const second = await portfolio.getSummary('a');
    expect(first).toEqual(second);
    expect(portfolio.calls).toBe(1);
  });

  it('caches per-argument keys independently', async () => {
    const portfolio = new PortfolioService(service);

    await portfolio.getSummary('a');
    await portfolio.getSummary('b');
    expect(portfolio.calls).toBe(2);
    await portfolio.getSummary('a');
    expect(portfolio.calls).toBe(2);
  });

  it('invalidates cached results after a mutation', async () => {
    const portfolio = new PortfolioService(service);

    await portfolio.getSummary('a');
    expect(portfolio.calls).toBe(1);
    await portfolio.refresh();
    await portfolio.getSummary('a');
    expect(portfolio.calls).toBe(3);
  });
});