import { IsString, IsNumber, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';
import { PaginationQueryDto } from '../../pagination/dto/pagination-query.dto';

export class InitiateEmergencyUnstakeDto {
  @IsString()
  stakerId: string;

  @IsString()
  stakingPositionId: string;

  @IsNumber()
  @Min(0.000001)
  amount: number;
}

export class EmergencyUnstakePreviewDto {
  @IsString()
  stakerId: string;

  @IsString()
  stakingPositionId: string;

  @IsNumber()
  @Min(0.000001)
  amount: number;

  @IsDateString()
  currentUnlockDate: Date;
}

export class EmergencyUnstakeHistoryFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsString()
  status?: 'pending' | 'processed' | 'failed';

  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;
}

export class PenaltyConfigDto {
  maxPenaltyRate: number;
  minPenaltyRate: number;
  rateLimitDays: number;
  lockupPeriodDays: number;
}
