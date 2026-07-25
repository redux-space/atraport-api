import { GlobalExceptionFilter } from './global-exception.filter';
import { HttpException, HttpStatus } from '@nestjs/common';
import { ArgumentsHost } from '@nestjs/common';
import { ValidationError, ResourceNotFoundError, InternalError } from '../errors/app.errors';
import { AppLoggerService } from '../services/app-logger.service';
import { ErrorTrackingService } from '../services/error-tracking.service';

function makeHost(req: Partial<Request> = {}, res: any = {}): ArgumentsHost {
  const defaultReq = {
    url: '/test',
    method: 'GET',
    headers: {},
    ...(req as object),
  };
  const statusFn = jest.fn().mockReturnValue(res);
  const jsonFn = jest.fn();
  const defaultRes = {
    status: statusFn,
    json: jsonFn,
    setHeader: jest.fn(),
    ...res,
  };
  defaultRes.status = jest.fn().mockReturnValue(defaultRes);

  return {
    switchToHttp: () => ({
      getRequest: () => defaultReq,
      getResponse: () => defaultRes,
    }),
    getType: () => 'http',
  } as any;
}

function makeLogger(): AppLoggerService {
  return {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    logError: jest.fn(),
    logPerformance: jest.fn(),
  } as any;
}

function makeErrorTracking(): ErrorTrackingService {
  return {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    flush: jest.fn(),
  } as any;
}

describe('GlobalExceptionFilter', () => {
  let filter: GlobalExceptionFilter;
  let logger: AppLoggerService;
  let errorTracking: ErrorTrackingService;

  beforeEach(() => {
    logger = makeLogger();
    errorTracking = makeErrorTracking();
    filter = new GlobalExceptionFilter(logger, errorTracking);
  });

  it('should handle BaseAppError and return correct status', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<any>();
    const err = new ValidationError('bad field');

    filter.catch(err, host);

    expect(res.status).toHaveBeenCalledWith(400);
    const body = res.json.mock.calls[0][0];
    expect(body.statusCode).toBe(400);
    expect(body.code).toBe('VALIDATION_ERROR');
    expect(body.message).toBe('bad field');
    expect(body.correlationId).toBeDefined();
  });

  it('should handle HttpException', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<any>();
    const err = new HttpException('Not Found', HttpStatus.NOT_FOUND);

    filter.catch(err, host);

    expect(res.status).toHaveBeenCalledWith(404);
    const body = res.json.mock.calls[0][0];
    expect(body.statusCode).toBe(404);
  });

  it('should return 500 for unknown errors', () => {
    const host = makeHost();
    const res = host.switchToHttp().getResponse<any>();

    filter.catch(new Error('Something broke'), host);

    expect(res.status).toHaveBeenCalledWith(500);
    const body = res.json.mock.calls[0][0];
    expect(body.message).toBe('An unexpected error occurred');
  });

  it('should call errorTracking for non-operational errors', () => {
    const host = makeHost();
    const err = new InternalError('db failed');

    filter.catch(err, host);

    expect(errorTracking.captureException).toHaveBeenCalledWith(
      err,
      expect.objectContaining({ correlationId: expect.any(String) }),
    );
  });

  it('should NOT call errorTracking for operational errors', () => {
    const host = makeHost();
    const err = new ResourceNotFoundError('Widget', '123');

    filter.catch(err, host);

    expect(errorTracking.captureException).not.toHaveBeenCalled();
  });

  it('should include timestamp and path in the response body', () => {
    const host = makeHost({ url: '/api/portfolios' } as any);
    const res = host.switchToHttp().getResponse<any>();
    filter.catch(new ValidationError(), host);

    const body = res.json.mock.calls[0][0];
    expect(body.timestamp).toBeDefined();
    expect(body.path).toBe('/api/portfolios');
  });

  it('should log warnings for 4xx errors', () => {
    const host = makeHost();
    filter.catch(new ValidationError('oops'), host);
    expect(logger.warn).toHaveBeenCalled();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should log errors for 5xx', () => {
    const host = makeHost();
    filter.catch(new InternalError(), host);
    expect(logger.logError).toHaveBeenCalled();
  });
});
