import {
  AuthenticationError,
  AuthorizationError,
  BusinessLogicError,
  ConflictError,
  ExternalServiceError,
  InsufficientBalanceError,
  InternalError,
  PortfolioError,
  RateLimitError,
  ResourceNotFoundError,
  ValidationError,
} from '../errors/app.errors';
import { BaseAppError } from '../errors/base.error';

describe('Custom Error Classes', () => {
  describe('ValidationError', () => {
    it('should have statusCode 400 and correct code', () => {
      const err = new ValidationError('bad input');
      expect(err).toBeInstanceOf(Error);
      expect(err).toBeInstanceOf(BaseAppError);
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.message).toBe('bad input');
      expect(err.isOperational).toBe(true);
    });

    it('should use default message when none provided', () => {
      const err = new ValidationError();
      expect(err.message).toBe('Validation failed');
    });

    it('should attach context', () => {
      const err = new ValidationError('err', { field: 'email' });
      expect(err.context).toEqual({ field: 'email' });
    });
  });

  describe('AuthenticationError', () => {
    it('should have statusCode 401', () => {
      const err = new AuthenticationError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('AUTHENTICATION_ERROR');
    });
  });

  describe('AuthorizationError', () => {
    it('should have statusCode 403', () => {
      const err = new AuthorizationError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('AUTHORIZATION_ERROR');
    });
  });

  describe('ResourceNotFoundError', () => {
    it('should include resource name and id in message', () => {
      const err = new ResourceNotFoundError('Portfolio', 'abc-123');
      expect(err.statusCode).toBe(404);
      expect(err.message).toContain('Portfolio');
      expect(err.message).toContain('abc-123');
    });

    it('should work without id', () => {
      const err = new ResourceNotFoundError('User');
      expect(err.message).toContain('User');
    });
  });

  describe('ConflictError', () => {
    it('should have statusCode 409', () => {
      const err = new ConflictError();
      expect(err.statusCode).toBe(409);
    });
  });

  describe('BusinessLogicError', () => {
    it('should have statusCode 422', () => {
      const err = new BusinessLogicError('cannot sell');
      expect(err.statusCode).toBe(422);
      expect(err.code).toBe('BUSINESS_LOGIC_ERROR');
    });
  });

  describe('RateLimitError', () => {
    it('should have statusCode 429', () => {
      const err = new RateLimitError('slow down', 60);
      expect(err.statusCode).toBe(429);
      expect(err.retryAfterSeconds).toBe(60);
    });
  });

  describe('ExternalServiceError', () => {
    it('should have statusCode 502 and be non-operational', () => {
      const err = new ExternalServiceError('Stellar');
      expect(err.statusCode).toBe(502);
      expect(err.service).toBe('Stellar');
      expect(err.isOperational).toBe(false);
    });
  });

  describe('InternalError', () => {
    it('should have statusCode 500 and be non-operational', () => {
      const err = new InternalError();
      expect(err.statusCode).toBe(500);
      expect(err.isOperational).toBe(false);
    });
  });

  describe('PortfolioError', () => {
    it('should have overridden code', () => {
      const err = new PortfolioError('bad portfolio');
      expect(err.code).toBe('PORTFOLIO_ERROR');
      expect(err.statusCode).toBe(422);
    });
  });

  describe('InsufficientBalanceError', () => {
    it('should include required and available in context', () => {
      const err = new InsufficientBalanceError(100, 50);
      expect(err.context).toMatchObject({ required: 100, available: 50 });
      expect(err.message).toContain('100');
      expect(err.message).toContain('50');
    });
  });

  describe('BaseAppError', () => {
    it('should capture stack trace', () => {
      const err = new ValidationError('test');
      expect(err.stack).toBeDefined();
      expect(err.stack).toContain('ValidationError');
    });

    it('should have correct name matching class name', () => {
      expect(new ValidationError().name).toBe('ValidationError');
      expect(new AuthenticationError().name).toBe('AuthenticationError');
    });
  });
});
