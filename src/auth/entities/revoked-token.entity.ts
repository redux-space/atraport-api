import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

/**
 * Stores revoked JWT token IDs (jti claims) until they expire.
 * Keeps the blacklist bounded in size.
 */
@Entity({ name: 'revoked_tokens' })
export class RevokedToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** JWT ID (jti) that has been revoked. */
  @Index({ unique: true })
  @Column({ unique: true })
  jti: string;

  /** When this revocation record was created. */
  @CreateDateColumn({ name: 'revoked_at' })
  revokedAt: Date;

  /** Original token expiry – used to purge stale rows. */
  @Column({ name: 'expires_at' })
  expiresAt: Date;
}
