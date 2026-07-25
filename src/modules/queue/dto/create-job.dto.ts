import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsObject, IsNumber, IsEnum, Min } from 'class-validator';
import { JobPriority } from '../interfaces/job.interface';

export class CreateJobDto {
  @ApiProperty({ description: 'Job type' })
  @IsString()
  type: string;

  @ApiProperty({ description: 'Job payload' })
  @IsObject()
  payload: any;

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

  @ApiPropertyOptional({ description: 'Delay in milliseconds' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  delay?: number;

  @ApiPropertyOptional({ description: 'Job metadata' })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
