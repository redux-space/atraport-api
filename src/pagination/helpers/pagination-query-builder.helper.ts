import { SelectQueryBuilder } from 'typeorm';
import { decodeCursor } from './cursor.helper';

export function applyOffsetPagination<T>(
  queryBuilder: SelectQueryBuilder<T>,
  page: number,
  limit: number,
): void {
  const skip = (page - 1) * limit;
  queryBuilder.skip(skip).take(limit);
}

export function applySorting<T>(
  queryBuilder: SelectQueryBuilder<T>,
  sortBy: string,
  sortOrder: 'ASC' | 'DESC',
  alias: string,
): void {
  queryBuilder.orderBy(`${alias}.${sortBy}`, sortOrder);
}

export function applyCursorPagination<T>(
  queryBuilder: SelectQueryBuilder<T>,
  cursor: string,
  sortField: string,
  sortOrder: 'ASC' | 'DESC',
  limit: number,
  alias: string,
  idField: string = 'id',
): void {
  const decoded = decodeCursor(cursor);
  const comparator = sortOrder === 'ASC' ? '>' : '<';

  queryBuilder
    .andWhere(
      `(${alias}.${sortField} ${comparator} :cursorSortValue) OR (${alias}.${sortField} = :cursorSortValue AND ${alias}.${idField} ${comparator} :cursorId)`,
      {
        cursorSortValue: decoded.sortValue,
        cursorId: decoded.id,
      },
    )
    .orderBy(`${alias}.${sortField}`, sortOrder)
    .addOrderBy(`${alias}.${idField}`, sortOrder)
    .take(limit + 1);
}

export async function executeCursorQuery<T>(
  queryBuilder: SelectQueryBuilder<T>,
  cursor: string,
  sortField: string,
  sortOrder: 'ASC' | 'DESC',
  limit: number,
  alias: string,
  idField: string = 'id',
): Promise<{ items: T[]; hasMore: boolean }> {
  applyCursorPagination(queryBuilder, cursor, sortField, sortOrder, limit, alias, idField);
  const results = await queryBuilder.getMany();
  const hasMore = results.length > limit;
  if (hasMore) {
    results.pop();
  }
  return { items: results, hasMore };
}
