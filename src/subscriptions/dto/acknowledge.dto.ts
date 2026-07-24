/**
 * Payload for POST /api/subscriptions/:id/acknowledge.
 */
export class AcknowledgeDto {
  /**
   * IDs of the delivered events being acknowledged.
   * Must contain at least one entry.
   */
  eventIds: string[];
}

/**
 * Response shape for POST /api/subscriptions/:id/acknowledge.
 */
export class AcknowledgeResponseDto {
  /** Number of events successfully acknowledged. */
  acknowledgedCount: number;

  /** IDs that were not found or already acknowledged. */
  skippedIds: string[];
}
