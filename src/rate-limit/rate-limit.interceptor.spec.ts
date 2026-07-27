import { Controller, Get, INestApplication } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import * as request from 'supertest';
import { MetricsService } from '../monitoring/metrics.service';
import { RateLimit } from './rate-limit.decorators';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitService } from './rate-limit.service';

@Controller('limited')
class LimitedController {
  @Get()
  @RateLimit({
    limit: 2,
    windowMs: 60000,
    algorithm: 'sliding-window',
    scope: 'ip',
  })
  getLimited() {
    return { ok: true };
  }
}

describe('RateLimitInterceptor HTTP behavior', () => {
  let app: INestApplication;

  beforeAll(async () => {
    process.env.RATE_LIMIT_IP_LIMIT = '100';
    process.env.RATE_LIMIT_USER_LIMIT = '100';
    const moduleRef = await Test.createTestingModule({
      controllers: [LimitedController],
      providers: [
        MetricsService,
        RateLimitService,
        {
          provide: APP_INTERCEPTOR,
          useClass: RateLimitInterceptor,
        },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
    delete process.env.RATE_LIMIT_IP_LIMIT;
    delete process.env.RATE_LIMIT_USER_LIMIT;
  });

  it('returns rate headers and a graceful 429 response', async () => {
    const first = await request(app.getHttpServer()).get('/limited').expect(200);
    expect(first.headers['x-ratelimit-limit']).toBe('2');
    expect(first.headers['x-ratelimit-remaining']).toBe('1');
    expect(first.headers['x-ratelimit-reset']).toMatch(/^\d+$/);
    expect(first.headers['x-ratelimit-scope']).toBe('endpoint');

    await request(app.getHttpServer())
      .get('/limited')
      .expect(200)
      .expect('X-RateLimit-Remaining', '0');

    const rejected = await request(app.getHttpServer())
      .get('/limited')
      .expect(429);
    expect(rejected.headers['retry-after']).toBe('60');
    expect(rejected.headers['x-ratelimit-remaining']).toBe('0');
    expect(rejected.body).toMatchObject({
      statusCode: 429,
      code: 'RATE_LIMIT_EXCEEDED',
      retryAfter: 60,
    });
  });
});
