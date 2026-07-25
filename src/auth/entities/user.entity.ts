import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  READONLY = 'readonly',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
}

@Entity({ name: 'users' })
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ unique: true })
  email: string;

  @Column({ select: false })
  passwordHash: string;

  @Column({ default: UserRole.USER })
  role: UserRole;

  @Column({ default: UserStatus.ACTIVE })
  status: UserStatus;

  /** Hashed refresh token stored on the user, null when logged out. */
  @Column({ name: 'refresh_token_hash', nullable: true, select: false })
  refreshTokenHash: string | null;

  /** API key for service-to-service auth (stored hashed). */
  @Column({ name: 'api_key_hash', nullable: true, select: false })
  apiKeyHash: string | null;

  /** Plain-text API key prefix shown once to the user for identification. */
  @Column({ name: 'api_key_prefix', nullable: true })
  apiKeyPrefix: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
