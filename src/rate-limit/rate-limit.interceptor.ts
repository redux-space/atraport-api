import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Response } from 'express';
import { Observable } from 'rxjs';
import {
  RATE_LIMIT_METADATA,
  SKIP_RATE_LIMIT_METADATA,
} from './rate-limit.decorators';
import { RateLimitExceededException } from './rate-limit.exception';
import { RateLimitService } from './rate-limit.service';
import { RateLimitDecision, RateLimitOverride } from './rate-limit.types';

@Injectable()
export class RateLimitInterceptor implements NestInterceptor {
  constructor(
    private readonly service: RateLimitService,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse<Response>();
    const targets = [context.getHandler(), context.getClass()];
    const skip =
      this.reflector.getAllAndOverride<boolean>(
        SKIP_RATE_LIMIT_METADATA,
        targets,
      ) ?? false;
    const override = this.reflector.getAllAndOverride<RateLimitOverride>(
      RATE_LIMIT_METADATA,
      targets,
    );

    let decision: RateLimitDecision;
    try {
      decision = this.service.check(request, override, skip);
    } catch (error) {
      if (!this.service.shouldFailOpen()) throw error;
      response.setHeader('X-RateLimit-Policy', 'degraded');
      return next.handle();
    }

    this.setHeaders(response, decision);
    if (!decision.allowed) {
      throw new RateLimitExceededException(
        Math.max(1, Math.ceil(decision.retryAfterMs / 1000)),
      );
    }
    return next.handle();
  }

  private setHeaders(response: Response, decision: RateLimitDecision): void {
    if (decision.bypassed) {
      response.setHeader('X-RateLimit-Policy', 'bypass');
      return;
    }

    response.setHeader('X-RateLimit-Limit', String(decision.limit));
    response.setHeader('X-RateLimit-Remaining', String(decision.remaining));
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil(decision.resetAt / 1000)),
    );
    if (decision.scope) {
      response.setHeader('X-RateLimit-Scope', decision.scope);
    }
    if (!decision.allowed) {
      response.setHeader(
        'Retry-After',
        String(Math.max(1, Math.ceil(decision.retryAfterMs / 1000))),
      );
    }
  }
}
