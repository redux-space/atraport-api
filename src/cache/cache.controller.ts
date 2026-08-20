import { Controller, Delete, Get, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { CacheService } from './cache.service';

@Controller('monitoring/cache')
@Roles(UserRole.ADMIN)
export class CacheController {
  constructor(private readonly cacheService: CacheService) {}

  @Get()
  async getReport() {
    return {
      statistics: await this.cacheService.getStatistics(),
      configuration: this.cacheService.getConfigurationSummary(),
    };
  }

  @Post('warm')
  async warm() {
    const warmed = await this.cacheService.warmup();
    return { status: 'success', warmed };
  }

  @Delete()
  async clear() {
    await this.cacheService.clear();
    return { status: 'success', message: 'Cache cleared' };
  }
}