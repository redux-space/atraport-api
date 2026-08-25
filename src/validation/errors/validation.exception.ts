import { BaseAppError } from '../../logging/errors/base.error';
import { FormattedValidationError } from '../interfaces/validation.interfaces';

/**
 * Exception thrown when incoming request parameters, body, query, headers, or files
 * fail schema or custom domain validation constraints.
 */
export class RequestValidationException extends BaseAppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode: number;
  readonly errors: FormattedValidationError[];

  constructor(
    errors: FormattedValidationError[],
    message?: string,
    statusCode = 400,
  ) {
    const defaultMessage =
      errors.length === 1
        ? `Validation failed on '${errors[0].field}': ${errors[0].message}`
        : `Validation failed (${errors.length} error${errors.length === 1 ? '' : 's'})`;

    super(message || defaultMessage, {
      isOperational: true,
      context: {
        errorCount: errors.length,
        errors,
      },
    });

    this.statusCode = statusCode;
    this.errors = errors;
  }

  /**
   * Helper to build a validation exception for a single field error.
   */
  static forField(
    field: string,
    message: string,
    code = 'custom',
    received?: unknown,
  ): RequestValidationException {
    return new RequestValidationException([
      {
        field,
        message,
        code,
        path: field.split('.'),
        received,
      },
    ]);
  }
}
