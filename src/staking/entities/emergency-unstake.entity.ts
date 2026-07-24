import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity()
export class EmergencyUnstake {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  stakerId: string;

  @Column('decimal')
  amount: number;

  @Column('decimal')
  penalty: number;

  @Column('decimal')
  penaltyRate: number;

  @Column()
  originalUnlockDate: Date;

  @Column()
  status: 'pending' | 'processed' | 'failed';

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  processedAt?: Date;

  @Column('jsonb', { nullable: true })
  auditLog?: {
    timestamp: Date;
    action: string;
    details: string;
  }[];
}