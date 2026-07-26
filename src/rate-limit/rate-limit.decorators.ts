import { SetMetadata } from '@nestjs/common';
import { RateLimitOverride } from './rate-limit.types';

export const RATE_LIMIT_METADATA = 'rate-limit:policy';
export const SKIP_RATE_LIMIT_METADATA = 'rate-limit:skip';

export const RateLimit = (options: RateLimitOverride) =>
  SetMetadata(RATE_LIMIT_METADATA, options);

export const SkipRateLimit = () => SetMetadata(SKIP_RATE_LIMIT_METADATA, true);
