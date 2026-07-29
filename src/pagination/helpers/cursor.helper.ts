import { BadRequestException } from '@nestjs/common';
import { CursorData } from '../interfaces/pagination-response.interface';

const CURSOR_SEPARATOR = ':';
const CURSOR_SECRET_PREFIX = 'v1';

export function encodeCursor(data: CursorData): string {
  const payload = JSON.stringify({
    s: data.sortValue,
    i: data.id,
  });
  const base64 = Buffer.from(payload).toString('base64url');
  return `${CURSOR_SECRET_PREFIX}.${base64}`;
}

export function decodeCursor(cursor: string): CursorData {
  if (!cursor) {
    throw new BadRequestException('Invalid cursor: empty value');
  }

  const parts = cursor.split('.');
  if (parts.length !== 2 || parts[0] !== CURSOR_SECRET_PREFIX) {
    throw new BadRequestException('Invalid cursor format');
  }

  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf-8'));

    if (payload.s === undefined || payload.i === undefined) {
      throw new BadRequestException('Invalid cursor payload');
    }

    return {
      sortValue: payload.s,
      id: payload.i,
    };
  } catch (error) {
    if (error instanceof BadRequestException) {
      throw error;
    }
    throw new BadRequestException('Invalid cursor: failed to decode');
  }
}
