/**
 * Severity levels for event filtering.
 */
export enum EventSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Delivery modes for subscriptions.
 */
export enum DeliveryMode {
  IMMEDIATE = 'immediate',
  BATCH = 'batch',
}

/**
 * Represents an event filter used when creating or updating a subscription.
 * Defines which events a subscriber wants to receive.
 */
export class EventFilterDto {
  /** List of event type identifiers to subscribe to (e.g. 'portfolio.updated'). */
  eventTypes: string[];

  /** Minimum severity level to receive. Defaults to 'low' if omitted. */
  minSeverity?: EventSeverity;

  /**
   * Arbitrary key/value predicates that must match event metadata.
   * E.g. { "assetId": "XLM" }
   */
  customPredicates?: Record<string, string>;
}
