import { DeliveryMode, EventFilterDto } from './event-filter.dto';

/**
 * Payload for POST /api/subscriptions.
 */
export class CreateSubscriptionDto {
  /** Human-readable label for this subscription. */
  name: string;

  /** Event filter configuration. */
  filter: EventFilterDto;

  /** How events should be delivered. Defaults to IMMEDIATE. */
  deliveryMode?: DeliveryMode;

  /**
   * For BATCH delivery: how many seconds to accumulate events before flushing.
   * Ignored when deliveryMode is IMMEDIATE.
   */
  batchIntervalSeconds?: number;

  /** Callback URL to push events to (webhook). Optional. */
  callbackUrl?: string;
}
