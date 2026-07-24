import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryOutcome } from '../dto/delivery-status.dto';

/**
 * Tracks the delivery state for each (subscription, event) pair.
 */
@Entity({ name: 'delivery_records' })
@Index(['subscriptionId', 'eventId'], { unique: true })
export class DeliveryRecordEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'subscription_id' })
  subscriptionId: string;

  @Column({ name: 'event_id' })
  eventId: string;

  @Column({ type: 'varchar', default: DeliveryOutcome.PENDING })
  outcome: DeliveryOutcome;

  /** ISO timestamp of first attempt. */
  @Column({ name: 'first_attempt_at', type: 'varchar', nullable: true })
  firstAttemptAt: string | null;

  /** ISO timestamp of last attempt. */
  @Column({ name: 'last_attempt_at', type: 'varchar', nullable: true })
  lastAttemptAt: string | null;

  @Column({ name: 'attempt_count', default: 0 })
  attemptCount: number;

  /** ISO timestamp of next retry (null when not retrying). */
  @Column({ name: 'next_retry_at', type: 'varchar', nullable: true })
  nextRetryAt: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
