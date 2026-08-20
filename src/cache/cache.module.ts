import { Global, Module } from '@nestjs/common';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { MonitoringModule } from '../monitoring/monitoring.module';
import { CacheController } from './cache.controller';
import { ConditionalCacheInterceptor } from './cache.interceptor';
import { CacheService } from './cache.service';
import { CacheWarmer } from './cache.warmer';

@Global()
@Module({
  imports: [MonitoringModule],
  controllers: [CacheController],
  providers: [
    CacheService,
    CacheWarmer,
    {
      provide: APP_INTERCEPTOR,
      useClass: ConditionalCacheInterceptor,
    },
  ],
  exports: [CacheService],
})
export class CacheModule {}