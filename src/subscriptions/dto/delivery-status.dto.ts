/**
 * Delivery attempt outcome.
 */
export enum DeliveryOutcome {
  PENDING = 'pending',
  DELIVERED = 'delivered',
  ACKNOWLEDGED = 'acknowledged',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

/**
 * Individual delivery record for a single event.
 */
export class DeliveryRecordDto {
  /** Unique delivery record ID. */
  id: string;

  /** The event ID that was delivered. */
  eventId: string;

  /** Current outcome status. */
  outcome: DeliveryOutcome;

  /** ISO timestamp of the first delivery attempt. */
  firstAttemptAt: string;

  /** ISO timestamp of the most recent attempt. */
  lastAttemptAt: string;

  /** Number of delivery attempts made so far. */
  attemptCount: number;

  /** Next scheduled retry, if outcome is RETRYING. */
  nextRetryAt: string | null;
}

/**
 * Response for GET /api/subscriptions/:id/delivery-status.
 */
export class DeliveryStatusDto {
  subscriptionId: string;

  /** Aggregate counts. */
  summary: {
    pending: number;
    delivered: number;
    acknowledged: number;
    failed: number;
    retrying: number;
  };

  /** Individual delivery records (most recent first). */
  records: DeliveryRecordDto[];
}
