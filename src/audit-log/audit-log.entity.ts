import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

@Entity('audit_logs')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @Column()
  eventType: string;

  @Column()
  portfolioId?: string;

  @Column()
  userAction: string;

  @Column('jsonb')
  details: Record<string, any>;

  @Column()
  ipAddress: string;

  @Column()
  userAgent: string;

  @Column()
  checksum: string;

  @Column({ nullable: true })
  previousChecksum?: string;

  @CreateDateColumn()
  createdAt: Date;
}