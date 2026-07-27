import { RateLimitPolicy, RateLimitResult } from './rate-limit.types';

interface TokenBucketState {
  tokens: number;
  lastRefill: number;
  limit: number;
  windowMs: number;
}

export class TokenBucketRateLimiter {
  private readonly buckets = new Map<string, TokenBucketState>();

  consume(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitResult {
    let bucket = this.buckets.get(key);
    if (
      !bucket ||
      bucket.limit !== policy.limit ||
      bucket.windowMs !== policy.windowMs
    ) {
      bucket = {
        tokens: policy.limit,
        lastRefill: now,
        limit: policy.limit,
        windowMs: policy.windowMs,
      };
      this.buckets.set(key, bucket);
    }

    const refillRate = policy.limit / policy.windowMs;
    const elapsed = Math.max(0, now - bucket.lastRefill);
    bucket.tokens = Math.min(policy.limit, bucket.tokens + elapsed * refillRate);
    bucket.lastRefill = now;

    const allowed = bucket.tokens >= 1;
    if (allowed) bucket.tokens -= 1;

    const retryAfterMs = allowed
      ? 0
      : Math.max(1, Math.ceil((1 - bucket.tokens) / refillRate));
    const resetAt =
      now + Math.ceil((policy.limit - bucket.tokens) / refillRate);

    return {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, Math.floor(bucket.tokens)),
      resetAt,
      retryAfterMs,
    };
  }

  prune(olderThan: number): void {
    for (const [key, bucket] of this.buckets) {
      if (bucket.lastRefill < olderThan) this.buckets.delete(key);
    }
  }

  get size(): number {
    return this.buckets.size;
  }
}

interface SlidingWindowState {
  timestamps: number[];
  lastSeen: number;
}

export class SlidingWindowRateLimiter {
  private readonly windows = new Map<string, SlidingWindowState>();

  consume(key: string, policy: RateLimitPolicy, now = Date.now()): RateLimitResult {
    const cutoff = now - policy.windowMs;
    const state = this.windows.get(key) ?? { timestamps: [], lastSeen: now };
    state.timestamps = state.timestamps.filter((timestamp) => timestamp > cutoff);
    state.lastSeen = now;

    const allowed = state.timestamps.length < policy.limit;
    if (allowed) state.timestamps.push(now);
    this.windows.set(key, state);

    const oldest = state.timestamps[0];
    const resetAt = oldest === undefined ? now + policy.windowMs : oldest + policy.windowMs;
    return {
      allowed,
      limit: policy.limit,
      remaining: Math.max(0, policy.limit - state.timestamps.length),
      resetAt,
      retryAfterMs: allowed ? 0 : Math.max(1, resetAt - now),
    };
  }

  prune(olderThan: number): void {
    for (const [key, state] of this.windows) {
      if (state.lastSeen < olderThan) this.windows.delete(key);
    }
  }

  get size(): number {
    return this.windows.size;
  }
}
