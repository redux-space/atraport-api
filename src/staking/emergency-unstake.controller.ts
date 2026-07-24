import { 
  Controller, 
  Post, 
  Get, 
  Body, 
  Param, 
  Query, 
  HttpCode, 
  HttpStatus 
} from '@nestjs/common';
import { EmergencyUnstakeService } from './emergency-unstake.service';
import { 
  InitiateEmergencyUnstakeDto, 
  EmergencyUnstakePreviewDto,
  EmergencyUnstakeHistoryFilterDto 
} from './dto/emergency-unstake.dto';

@Controller('api/staking')
export class EmergencyUnstakeController {
  constructor(private readonly emergencyUnstakeService: EmergencyUnstakeService) {}

  @Get('emergency-config')
  @HttpCode(HttpStatus.OK)
  getEmergencyConfig() {
    return this.emergencyUnstakeService.getPenaltyConfig();
  }

  @Post('emergency-unstake')
  @HttpCode(HttpStatus.CREATED)
  initiateEmergencyUnstake(@Body() dto: InitiateEmergencyUnstakeDto) {
    return this.emergencyUnstakeService.initiateEmergencyUnstake(dto);
  }

  @Get('emergency-unstake/preview')
  @HttpCode(HttpStatus.OK)
  previewPenalty(@Query() previewDto: EmergencyUnstakePreviewDto) {
    return this.emergencyUnstakeService.previewPenalty(previewDto);
  }

  @Get('emergency-unstake-status/:staker_id')
  @HttpCode(HttpStatus.OK)
  getUnstakeStatus(@Param('staker_id') stakerId: string) {
    return this.emergencyUnstakeService.getUnstakeStatus(stakerId);
  }

  @Get(':staker_id/emergency-history')
  @HttpCode(HttpStatus.OK)
  getEmergencyHistory(
    @Param('staker_id') stakerId: string,
    @Query() filters: EmergencyUnstakeHistoryFilterDto
  ) {
    return this.emergencyUnstakeService.getEmergencyHistory(stakerId, filters);
  }
}