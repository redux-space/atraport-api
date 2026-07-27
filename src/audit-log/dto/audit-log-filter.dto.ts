import { IsOptional, IsString, IsDateString } from 'class-validator';
import { PaginationQueryDto } from '../../pagination/dto/pagination-query.dto';

export class AuditLogFilterDto extends PaginationQueryDto {
  @IsOptional()
  @IsDateString()
  startDate?: Date;

  @IsOptional()
  @IsDateString()
  endDate?: Date;

  @IsOptional()
  @IsString()
  eventType?: string;

  @IsOptional()
  @IsString()
  portfolioId?: string;

  @IsOptional()
  @IsString()
  userAction?: string;
}
