import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { RateLimitController } from './rate-limit.controller';
import { RateLimitInterceptor } from './rate-limit.interceptor';
import { RateLimitService } from './rate-limit.service';

@Global()
@Module({
  imports: [MonitoringModule],
  controllers: [RateLimitController],
  providers: [
    RateLimitService,
    {
      provide: APP_INTERCEPTOR,
      useClass: RateLimitInterceptor,
    },
  ],
  exports: [RateLimitService],
})
export class RateLimitModule {}
