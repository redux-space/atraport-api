import { PaginationMeta, CursorPaginationMeta, CursorData } from '../interfaces/pagination-response.interface';
import { encodeCursor, decodeCursor } from './cursor.helper';

export function buildPaginationMeta(
  total: number,
  page: number,
  limit: number,
): PaginationMeta {
  const totalPages = Math.ceil(total / limit);
  return {
    total,
    page,
    limit,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  };
}

export function buildCursorPaginationMeta<T extends Record<string, any>>(
  data: T[],
  limit: number,
  sortField: string,
  hasMore: boolean,
  isAscending: boolean,
): CursorPaginationMeta {
  const nextCursor = hasMore && data.length > 0
    ? createCursorFromItem(data[data.length - 1], sortField)
    : undefined;

  const previousCursor = undefined;

  return {
    nextCursor,
    previousCursor,
    hasNext: hasMore,
    hasPrevious: false,
    limit,
  };
}

function createCursorFromItem(item: Record<string, any>, sortField: string): string | undefined {
  const sortValue = item[sortField];
  const id = item['id'];

  if (sortValue === undefined || id === undefined) {
    return undefined;
  }

  return encodeCursor({ sortValue, id });
}

export function createOffsetPaginatedResponse<T>(
  data: T[],
  total: number,
  page: number,
  limit: number,
) {
  return {
    data,
    meta: buildPaginationMeta(total, page, limit),
  };
}

export function createCursorPaginatedResponse<T>(
  data: T[],
  limit: number,
  sortField: string,
  hasMore: boolean,
  isAscending: boolean,
) {
  return {
    data,
    meta: buildCursorPaginationMeta(data, limit, sortField, hasMore, isAscending),
  };
}

export { encodeCursor, decodeCursor };
