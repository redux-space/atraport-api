import { IsString, IsNumber, IsUUID, IsOptional, Min, Max, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

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

export class EmergencyUnstakeHistoryFilterDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number = 10;

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