import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { RevokedToken } from './entities/revoked-token.entity';

@Injectable()
export class TokenRevocationService {
  private readonly logger = new Logger(TokenRevocationService.name);

  constructor(
    @InjectRepository(RevokedToken)
    private readonly revokedTokenRepo: Repository<RevokedToken>,
  ) {}

  /** Blacklist a token by its jti until its natural expiry. */
  async revoke(jti: string, expiresAt: Date): Promise<void> {
    const record = this.revokedTokenRepo.create({ jti, expiresAt });
    await this.revokedTokenRepo.save(record);
  }

  /** Returns true when the jti is on the blacklist. */
  async isRevoked(jti: string): Promise<boolean> {
    const count = await this.revokedTokenRepo.count({ where: { jti } });
    return count > 0;
  }

  /**
   * Remove revocation records whose token has already expired.
   * Call periodically (e.g. via a cron job) to keep the table small.
   */
  async purgeExpired(): Promise<void> {
    const result = await this.revokedTokenRepo.delete({
      expiresAt: LessThan(new Date()),
    });
    this.logger.log(`Purged ${result.affected ?? 0} expired revocation records.`);
  }
}
