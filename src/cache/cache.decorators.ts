import { SetMetadata } from '@nestjs/common';
import { CacheService } from './cache.service';
import { CacheDecoratorOptions, ConditionalCacheOptions } from './cache.types';

export const CONDITIONAL_CACHE_METADATA = 'cache:conditional';

/**
 * Opts an HTTP handler into conditional caching: the response gets an `ETag`
 * and `Last-Modified` header and returns `304 Not Modified` when the client
 * sends a matching `If-None-Match`.
 */
export const ConditionalCache = (options: ConditionalCacheOptions = {}) =>
  SetMetadata(CONDITIONAL_CACHE_METADATA, options);

function serializeArg(arg: unknown): string {
  if (arg === undefined) return 'undefined';
  if (arg === null) return 'null';
  if (typeof arg === 'object') {
    try {
      return JSON.stringify(arg, Object.keys(arg).sort());
    } catch {
      return String(arg);
    }
  }
  return String(arg);
}

function cacheKey(
  className: string,
  methodName: string,
  args: unknown[],
  override?: string,
): string {
  if (override) return `cache:${override}`;
  const serialized = args.map(serializeArg).join(':');
  return `cache:${className}:${methodName}${serialized ? ':' + serialized : ''}`;
}

/**
 * Caches the result of a service method. The host class must inject
 * `CacheService` as a `cacheService` property. Keys are derived from the
 * class, method, and serialized arguments unless an explicit key is given.
 */
export function Cached(options: CacheDecoratorOptions = {}) {
  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = async function (
      this: { cacheService?: CacheService },
      ...args: unknown[]
    ): Promise<unknown> {
      const cacheService = this.cacheService;
      if (!cacheService) return original.apply(this, args);
      const key = cacheKey(target.constructor.name, propertyKey, args, options.key);
      return cacheService.wrap(
        key,
        () => original.apply(this, args),
        options.ttl,
      );
    };
    return descriptor;
  };
}

/**
 * Invalidates cached entries after a mutation completes. By default it clears
 * every cached method of the host class; pass a key/prefix to target a subset.
 */
export function InvalidateCache(prefix?: string) {
  return (
    target: object,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const original = descriptor.value as (...args: unknown[]) => unknown;
    descriptor.value = async function (
      this: { cacheService?: CacheService },
      ...args: unknown[]
    ): Promise<unknown> {
      const result = await original.apply(this, args);
      const cacheService = this.cacheService;
      if (cacheService) {
        await cacheService.invalidateByPrefix(
          prefix ?? `cache:${target.constructor.name}:`,
        );
      }
      return result;
    };
    return descriptor;
  };
}