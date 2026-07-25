import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('storage_quotas')
export class StorageQuotaEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @Column({ type: 'bigint', default: 0 })
  usedBytes: number;

  @Column({ type: 'bigint', default: 5 * 1024 * 1024 * 1024 }) // 5GB default
  maxBytes: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
