import { IsOptional, IsInt, Min, Max, IsString, IsIn } from 'class-validator';
import { Type } from 'class-transformer';

const DEFAULT_CURSOR_PAGE_SIZE = 10;
const MAX_CURSOR_PAGE_SIZE = 100;

export class CursorPaginationQueryDto {
  @IsOptional()
  @IsString()
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(MAX_CURSOR_PAGE_SIZE)
  limit?: number = DEFAULT_CURSOR_PAGE_SIZE;

  @IsOptional()
  @IsString()
  sortField?: string = 'createdAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}

export { DEFAULT_CURSOR_PAGE_SIZE, MAX_CURSOR_PAGE_SIZE };
