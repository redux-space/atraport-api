import { EventFilterDto } from './event-filter.dto';

/**
 * Payload for POST /api/subscriptions/validate-filter.
 */
export class ValidateFilterDto {
  /** The event filter configuration to validate. */
  filter: EventFilterDto;
}

/**
 * Response shape for POST /api/subscriptions/validate-filter.
 */
export class ValidateFilterResponseDto {
  /** Whether the filter is valid. */
  valid: boolean;

  /** Human-readable validation errors, present only when valid is false. */
  errors?: string[];

  /**
   * Compiled filter summary — a human-readable description of what the
   * filter will match, present only when valid is true.
   */
  compiledSummary?: string;
}
