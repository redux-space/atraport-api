import {
  SlidingWindowRateLimiter,
  TokenBucketRateLimiter,
} from './rate-limit.algorithms';
import { RateLimitPolicy } from './rate-limit.types';

describe('rate limit algorithms', () => {
  const tokenPolicy: RateLimitPolicy = {
    limit: 2,
    windowMs: 1000,
    algorithm: 'token-bucket',
  };
  const windowPolicy: RateLimitPolicy = {
    limit: 2,
    windowMs: 1000,
    algorithm: 'sliding-window',
  };

  it('refills token buckets continuously', () => {
    const limiter = new TokenBucketRateLimiter();

    expect(limiter.consume('client', tokenPolicy, 0)).toMatchObject({
      allowed: true,
      remaining: 1,
    });
    expect(limiter.consume('client', tokenPolicy, 0)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
    expect(limiter.consume('client', tokenPolicy, 0)).toMatchObject({
      allowed: false,
      retryAfterMs: 500,
    });
    expect(limiter.consume('client', tokenPolicy, 500)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });

  it('keeps token buckets isolated by key', () => {
    const limiter = new TokenBucketRateLimiter();
    limiter.consume('client-a', tokenPolicy, 0);
    limiter.consume('client-a', tokenPolicy, 0);

    expect(limiter.consume('client-a', tokenPolicy, 0).allowed).toBe(false);
    expect(limiter.consume('client-b', tokenPolicy, 0).allowed).toBe(true);
  });

  it('expires requests at the exact sliding-window boundary', () => {
    const limiter = new SlidingWindowRateLimiter();
    limiter.consume('client', windowPolicy, 0);
    limiter.consume('client', windowPolicy, 100);

    const rejected = limiter.consume('client', windowPolicy, 999);
    expect(rejected).toMatchObject({
      allowed: false,
      remaining: 0,
      resetAt: 1000,
      retryAfterMs: 1,
    });

    expect(limiter.consume('client', windowPolicy, 1000)).toMatchObject({
      allowed: true,
      remaining: 0,
    });
  });
});
