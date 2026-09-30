import { ArgumentsHost } from '@nestjs/common';
import { RequestValidationException } from './validation.exception';
import { GlobalExceptionFilter } from '../../logging/filters/global-exception.filter';

describe('RequestValidationException & GlobalExceptionFilter integration (#69)', () => {
  it('constructs a 400 operational error with VALIDATION_ERROR code and formatted errors', () => {
    const single = RequestValidationException.forField(
      'user.email',
      'Invalid email address',
      'invalid_string',
      'not-an-email',
    );

    expect(single.statusCode).toBe(400);
    expect(single.code).toBe('VALIDATION_ERROR');
    expect(single.isOperational).toBe(true);
    expect(single.message).toBe(
      "Validation failed on 'user.email': Invalid email address",
    );
    expect(single.errors).toEqual([
      {
        field: 'user.email',
        message: 'Invalid email address',
        code: 'invalid_string',
        path: ['user', 'email'],
        received: 'not-an-email',
      },
    ]);
  });

  it('renders as a structured 400 Bad Request response through GlobalExceptionFilter without reporting to Sentry', () => {
    const mockLogger = {
      warn: jest.fn(),
      logError: jest.fn(),
    } as any;
    const mockErrorTracking = {
      captureException: jest.fn(),
    } as any;

    const filter = new GlobalExceptionFilter(mockLogger, mockErrorTracking);
    const exception = new RequestValidationException([
      {
        field: 'a.b[0].c',
        message: 'Number must be greater than 0',
        code: 'too_small',
        path: ['a', 'b', 0, 'c'],
      },
      {
        field: 'email',
        message: 'Invalid email',
        code: 'invalid_string',
        path: ['email'],
      },
    ]);

    const jsonSpy = jest.fn();
    const statusSpy = jest.fn().mockReturnValue({ json: jsonSpy });
    const mockHost: ArgumentsHost = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'POST',
          url: '/api/portfolio',
          headers: { 'x-correlation-id': 'corr-test-69' },
        }),
        getResponse: () => ({
          status: statusSpy,
        }),
      }),
    } as any;

    filter.catch(exception, mockHost);

    expect(statusSpy).toHaveBeenCalledWith(400);
    expect(mockErrorTracking.captureException).not.toHaveBeenCalled();
    expect(mockLogger.warn).toHaveBeenCalledTimes(1);

    const responseBody = jsonSpy.mock.calls[0][0];
    expect(responseBody.statusCode).toBe(400);
    expect(responseBody.code).toBe('VALIDATION_ERROR');
    expect(responseBody.message).toBe('Validation failed (2 errors)');
    expect(responseBody.path).toBe('/api/portfolio');
    expect(responseBody.errors).toEqual(exception.errors);
  });
});
