import { Controller, Get } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { RateLimitService } from './rate-limit.service';

@Controller('monitoring/rate-limits')
@Roles(UserRole.ADMIN)
export class RateLimitController {
  constructor(private readonly rateLimitService: RateLimitService) {}

  @Get()
  getReport() {
    return {
      analytics: this.rateLimitService.getAnalytics(),
      configuration: this.rateLimitService.getConfigurationSummary(),
    };
  }
}
