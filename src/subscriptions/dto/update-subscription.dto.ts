import { DeliveryMode, EventFilterDto } from './event-filter.dto';

/**
 * Payload for PUT /api/subscriptions/:id.
 * All fields are optional — only supplied fields are updated.
 */
export class UpdateSubscriptionDto {
  /** Updated human-readable label. */
  name?: string;

  /** Updated event filter. */
  filter?: EventFilterDto;

  /** Updated delivery mode. */
  deliveryMode?: DeliveryMode;

  /** Updated batch flush interval in seconds. */
  batchIntervalSeconds?: number;

  /** Updated callback URL. */
  callbackUrl?: string;

  /** Whether the subscription is active. */
  active?: boolean;
}
