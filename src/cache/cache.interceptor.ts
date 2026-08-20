import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { createHash } from 'crypto';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { CONDITIONAL_CACHE_METADATA } from './cache.decorators';
import { ConditionalCacheOptions } from './cache.types';

function createETag(body: unknown): string {
  const hash = createHash('sha1');
  hash.update(JSON.stringify(body));
  return `"${hash.digest('hex')}"`;
}

@Injectable()
export class ConditionalCacheInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const options = this.reflector.getAllAndOverride<ConditionalCacheOptions>(
      CONDITIONAL_CACHE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return next.handle();

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) return body;

        const etag = createETag(body);
        response.setHeader('ETag', etag);
        response.setHeader(
          'Cache-Control',
          options.maxAge
            ? `public, max-age=${Math.floor(options.maxAge / 1000)}`
            : 'no-cache',
        );
        if (!response.getHeader('Last-Modified')) {
          response.setHeader('Last-Modified', new Date().toUTCString());
        }

        const requested = request.headers['if-none-match'];
        if (
          typeof requested === 'string' &&
          requested.replace(/^W\//, '') === etag
        ) {
          response.status(304);
          return undefined;
        }
        return body;
      }),
    );
  }
}