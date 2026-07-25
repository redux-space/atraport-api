import { Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

/** Bcrypt cost factor – 12 rounds gives ~300 ms on modern hardware. */
const BCRYPT_ROUNDS = 12;

@Injectable()
export class HashService {
  /**
   * Hash a plain-text value (password, API key, refresh token).
   */
  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, BCRYPT_ROUNDS);
  }

  /**
   * Compare a plain-text value against a stored bcrypt hash.
   */
  async compare(plain: string, hashed: string): Promise<boolean> {
    return bcrypt.compare(plain, hashed);
  }
}
