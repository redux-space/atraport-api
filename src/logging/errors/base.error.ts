/**
 * Base application error class.
 * All custom errors should extend this class.
 */
export abstract class BaseAppError extends Error {
  /** Machine-readable error code */
  abstract readonly code: string;
  /** HTTP status code to respond with */
  abstract readonly statusCode: number;
  /** Whether this error should be reported to the error-tracking service */
  readonly isOperational: boolean;
  /** Arbitrary extra context attached to the error */
  readonly context?: Record<string, unknown>;

  constructor(
    message: string,
    options: { isOperational?: boolean; context?: Record<string, unknown> } = {},
  ) {
    super(message);
    this.name = new.target.name;
    this.isOperational = options.isOperational ?? true;
    this.context = options.context;
    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, new.target);
    }
  }
}
