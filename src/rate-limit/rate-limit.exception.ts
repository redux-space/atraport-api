import { HttpException, HttpStatus } from '@nestjs/common';

export class RateLimitExceededException extends HttpException {
  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        code: 'RATE_LIMIT_EXCEEDED',
        message: 'Rate limit exceeded. Please retry later.',
        retryAfter: retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
