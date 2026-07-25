import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNumber, IsEnum, Min, Matches } from 'class-validator';
import { JobPriority } from '../interfaces/job.interface';

export class ScheduleJobDto {
  @ApiProperty({ description: 'Job type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Job payload' })
  @IsObject()
  payload: any;

  @ApiProperty({ description: 'Cron expression' })
  @IsString()
  @Matches(/^(\*|([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])|\*\/([0-9]|1[0-9]|2[0-9]|3[0-9]|4[0-9]|5[0-9])) (\*|([0-9]|1[0-9]|2[0-3])|\*\/([0-9]|1[0-9]|2[0-3])) (\*|([1-9]|1[0-9]|2[0-9]|3[0-1])|\*\/([1-9]|1[0-9]|2[0-9]|3[0-1])) (\*|([1-9]|1[0-2])|\*\/([1-9]|1[0-2])) (\*|([0-6])|\*\/([0-6]))$/, {
    message: 'Invalid cron expression',
  })
  cronExpression: string;

  @ApiPropertyOptional({ description: 'Job priority', enum: JobPriority })
  @IsOptional()
  @IsEnum(JobPriority)
  priority?: JobPriority;

  @ApiPropertyOptional({ description: 'Maximum retries', default: 3 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxRetries?: number;

  @ApiPropertyOptional({ description: 'Timeout in milliseconds', default: 30000 })
  @IsOptional()
  @IsNumber()
  @Min(1000)
  timeout?: number;

  @ApiPropertyOptional({ description: 'Job metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
