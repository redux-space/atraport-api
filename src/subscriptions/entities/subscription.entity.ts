import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { DeliveryMode, EventFilterDto } from '../dto/event-filter.dto';

/**
 * Persisted subscription preferences.
 * Uses TypeORM but works without a live DB connection (in-memory fallback in
 * the service keeps tests independent of Postgres).
 */
@Entity({ name: 'subscriptions' })
export class SubscriptionEntity {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Owner of the subscription. */
  @Column({ name: 'user_id' })
  userId: string;

  /** Human-readable label. */
  @Column()
  name: string;

  /**
   * Event filter stored as JSONB.
   * Cast to EventFilterDto on read.
   */
  @Column({ type: 'simple-json' })
  filter: EventFilterDto;

  @Column({
    name: 'delivery_mode',
    type: 'varchar',
    default: DeliveryMode.IMMEDIATE,
  })
  deliveryMode: DeliveryMode;

  /** Seconds between batch flushes. 0 means use default (60 s). */
  @Column({ name: 'batch_interval_seconds', default: 0 })
  batchIntervalSeconds: number;

  @Column({ name: 'callback_url', nullable: true, type: 'varchar' })
  callbackUrl: string | null;

  @Column({ default: true })
  active: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
