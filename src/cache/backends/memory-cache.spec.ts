import { MemoryCacheBackend } from './memory-cache';

describe('MemoryCacheBackend (#63)', () => {
  let backend: MemoryCacheBackend;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));
    backend = new MemoryCacheBackend(3);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe('available and identity', () => {
    it('always reports available as true and name as memory', () => {
      expect(backend.name).toBe('memory');
      expect(backend.available).toBe(true);
    });
  });

  describe('get / set round-trip and getWithTtl', () => {
    it('stores and retrieves values unchanged', async () => {
      const payload = { portfolioId: 'p-1', assets: ['XLM', 'USDC'], active: true };
      await backend.set('portfolio:p-1', payload, 5_000);

      const actual = await backend.get<typeof payload>('portfolio:p-1');
      expect(actual).toEqual(payload);
      expect(await backend.size()).toBe(1);
    });

    it('returns undefined for missing keys', async () => {
      expect(await backend.get('non-existent')).toBeUndefined();
      expect(await backend.getWithTtl('non-existent')).toBeUndefined();
    });

    it('returns value and remaining pttlMs via getWithTtl', async () => {
      await backend.set('rate:xlm', 0.125, 10_000);
      jest.advanceTimersByTime(3_500);

      const result = await backend.getWithTtl<number>('rate:xlm');
      expect(result).toEqual({ value: 0.125, pttlMs: 6_500 });
    });
  });

  describe('TTL expiry with fake timers', () => {
    it('returns undefined after TTL has elapsed and removes the expired entry from size()', async () => {
      await backend.set('session:1', 'token-abc', 1_000);
      expect(await backend.size()).toBe(1);

      jest.advanceTimersByTime(1_001);

      expect(await backend.get('session:1')).toBeUndefined();
      expect(await backend.size()).toBe(0);
    });

    it('expires entry on getWithTtl when clock reaches or passes TTL', async () => {
      await backend.set('session:2', 'token-xyz', 500);
      jest.advanceTimersByTime(500);

      expect(await backend.getWithTtl('session:2')).toBeUndefined();
      expect(await backend.size()).toBe(0);
    });
  });

  describe('ttlMs <= 0 immediate-expiry behaviour', () => {
    it('treats ttlMs <= 0 as immediately expired on subsequent get() and evicts on next set()', async () => {
      await backend.set('zero-ttl', 'ephemeral', 0);
      expect(await backend.get('zero-ttl')).toBeUndefined();
      expect(await backend.size()).toBe(0);

      await backend.set('negative-ttl', 'already-past', -500);
      expect(await backend.get('negative-ttl')).toBeUndefined();
      expect(await backend.size()).toBe(0);
    });
  });

  describe('LRU eviction at maxKeys capacity', () => {
    it('evicts the oldest key when inserting beyond maxKeys', async () => {
      await backend.set('k1', 'v1', 60_000);
      await backend.set('k2', 'v2', 60_000);
      await backend.set('k3', 'v3', 60_000);
      expect(await backend.size()).toBe(3);

      await backend.set('k4', 'v4', 60_000);

      expect(await backend.size()).toBe(3);
      expect(await backend.get('k1')).toBeUndefined();
      expect(await backend.get('k2')).toBe('v2');
      expect(await backend.get('k3')).toBe('v3');
      expect(await backend.get('k4')).toBe('v4');
    });

    it('refreshes recency on get() so the least-recently-used key is evicted first', async () => {
      await backend.set('k1', 'v1', 60_000);
      await backend.set('k2', 'v2', 60_000);
      await backend.set('k3', 'v3', 60_000);

      // Touch k1 so k2 becomes the least-recently-used entry
      expect(await backend.get('k1')).toBe('v1');

      await backend.set('k4', 'v4', 60_000);

      expect(await backend.size()).toBe(3);
      expect(await backend.get('k2')).toBeUndefined();
      expect(await backend.get('k1')).toBe('v1');
      expect(await backend.get('k3')).toBe('v3');
      expect(await backend.get('k4')).toBe('v4');
    });

    it('terminates the eviction loop cleanly and never exceeds maxKeys under repeated inserts and reads', async () => {
      for (let i = 0; i < 10; i++) {
        await backend.set(`key:${i}`, i, 60_000);
        // Retrieve the oldest surviving key to exercise Map recency re-insertion at capacity
        const oldestIdx = Math.max(0, i - 2);
        await backend.get(`key:${oldestIdx}`);
        expect(await backend.size()).toBeLessThanOrEqual(3);
      }
      expect(await backend.size()).toBe(3);
    });
  });

  describe('del, invalidateByPrefix, clear, and size', () => {
    it('deletes only the requested key and leaves other keys intact', async () => {
      await backend.set('a', 1, 60_000);
      await backend.set('b', 2, 60_000);

      await backend.del('a');

      expect(await backend.get('a')).toBeUndefined();
      expect(await backend.get('b')).toBe(2);
      expect(await backend.size()).toBe(1);
    });

    it('invalidates only keys starting with the prefix and ignores non-leading substring matches', async () => {
      const largeBackend = new MemoryCacheBackend(10);
      await largeBackend.set('bar:1', 'match-1', 60_000);
      await largeBackend.set('bar:2', 'match-2', 60_000);
      await largeBackend.set('cache:Foo:bar', 'non-leading-bar', 60_000);
      await largeBackend.set('other:key', 'untouched', 60_000);

      const removed = await largeBackend.invalidateByPrefix('bar');

      expect(removed).toBe(2);
      expect(await largeBackend.get('bar:1')).toBeUndefined();
      expect(await largeBackend.get('bar:2')).toBeUndefined();
      expect(await largeBackend.get('cache:Foo:bar')).toBe('non-leading-bar');
      expect(await largeBackend.get('other:key')).toBe('untouched');
      expect(await largeBackend.size()).toBe(2);
    });

    it('resets size to 0 on clear()', async () => {
      await backend.set('x', 10, 60_000);
      await backend.set('y', 20, 60_000);
      expect(await backend.size()).toBe(2);

      await backend.clear();

      expect(await backend.size()).toBe(0);
      expect(await backend.get('x')).toBeUndefined();
    });
  });
});
