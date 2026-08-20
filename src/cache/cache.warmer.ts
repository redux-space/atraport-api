import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { CacheService } from './cache.service';

@Injectable()
export class CacheWarmer implements OnApplicationBootstrap {
  private readonly logger = new Logger('CacheWarmer');

  constructor(private readonly cacheService: CacheService) {}

  onApplicationBootstrap(): void {
    // Warming is non-blocking so the app can serve traffic while keys load.
    void this.cacheService.warmOnStartup().then((count) => {
      if (count > 0) {
        this.logger.log(`Cache warmed ${count} keys`, 'CacheWarmer');
      }
    });
  }
}