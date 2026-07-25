import { BaseAppError } from './base.error';

// ─── 400 Bad Request ────────────────────────────────────────────────────────

export class ValidationError extends BaseAppError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;

  constructor(
    message = 'Validation failed',
    context?: Record<string, unknown>,
  ) {
    super(message, { isOperational: true, context });
  }
}

// ─── 401 Unauthorized ───────────────────────────────────────────────────────

export class AuthenticationError extends BaseAppError {
  readonly code = 'AUTHENTICATION_ERROR';
  readonly statusCode = 401;

  constructor(
    message = 'Authentication required',
    context?: Record<string, unknown>,
  ) {
    super(message, { isOperational: true, context });
  }
}

// ─── 403 Forbidden ──────────────────────────────────────────────────────────

export class AuthorizationError extends BaseAppError {
  readonly code = 'AUTHORIZATION_ERROR';
  readonly statusCode = 403;

  constructor(
    message = 'Insufficient permissions',
    context?: Record<string, unknown>,
  ) {
    super(message, { isOperational: true, context });
  }
}

// ─── 404 Not Found ──────────────────────────────────────────────────────────

export class ResourceNotFoundError extends BaseAppError {
  readonly code = 'RESOURCE_NOT_FOUND';
  readonly statusCode = 404;

  constructor(resource: string, id?: string, context?: Record<string, unknown>) {
    const msg = id
      ? `${resource} with id '${id}' was not found`
      : `${resource} was not found`;
    super(msg, { isOperational: true, context });
  }
}

// ─── 409 Conflict ───────────────────────────────────────────────────────────

export class ConflictError extends BaseAppError {
  readonly code = 'CONFLICT_ERROR';
  readonly statusCode = 409;

  constructor(
    message = 'Resource already exists or conflicts with current state',
    context?: Record<string, unknown>,
  ) {
    super(message, { isOperational: true, context });
  }
}

// ─── 422 Business Logic Error ───────────────────────────────────────────────

export class BusinessLogicError extends BaseAppError {
  readonly code = 'BUSINESS_LOGIC_ERROR';
  readonly statusCode = 422;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { isOperational: true, context });
  }
}

// ─── 429 Rate Limit ─────────────────────────────────────────────────────────

export class RateLimitError extends BaseAppError {
  readonly code = 'RATE_LIMIT_EXCEEDED';
  readonly statusCode = 429;
  readonly retryAfterSeconds?: number;

  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super(message, { isOperational: true });
    this.retryAfterSeconds = retryAfterSeconds;
  }
}

// ─── 500 External Service ───────────────────────────────────────────────────

export class ExternalServiceError extends BaseAppError {
  readonly code = 'EXTERNAL_SERVICE_ERROR';
  readonly statusCode = 502;
  readonly service: string;

  constructor(service: string, message?: string, context?: Record<string, unknown>) {
    super(message ?? `External service '${service}' failed`, {
      isOperational: false,
      context,
    });
    this.service = service;
  }
}

// ─── 500 Internal / Programming Error ───────────────────────────────────────

export class InternalError extends BaseAppError {
  readonly code = 'INTERNAL_ERROR';
  readonly statusCode = 500;

  constructor(message = 'An unexpected error occurred', context?: Record<string, unknown>) {
    super(message, { isOperational: false, context });
  }
}

// ─── 503 Service Unavailable ────────────────────────────────────────────────

export class ServiceUnavailableError extends BaseAppError {
  readonly code = 'SERVICE_UNAVAILABLE';
  readonly statusCode = 503;

  constructor(message = 'Service temporarily unavailable', context?: Record<string, unknown>) {
    super(message, { isOperational: true, context });
  }
}

// ─── Portfolio / Domain ──────────────────────────────────────────────────────

export class PortfolioError extends BaseAppError {
  readonly code = 'PORTFOLIO_ERROR';
  readonly statusCode = 422;

  constructor(message: string, context?: Record<string, unknown>) {
    super(message, { isOperational: true, context });
  }
}

export class InsufficientBalanceError extends BaseAppError {
  readonly code = 'INSUFFICIENT_BALANCE';
  readonly statusCode = 422;

  constructor(required: number, available: number) {
    super(`Insufficient balance: required ${required}, available ${available}`, {
      isOperational: true,
      context: { required, available },
    });
  }
}
