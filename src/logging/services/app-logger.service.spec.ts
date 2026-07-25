// Mock 'winston-daily-rotate-file' BEFORE importing the service so the module-level
// `import 'winston-daily-rotate-file'` side effect picks up our mock.
// Winston validates transports by checking for a `write` method; we satisfy that
// by extending the built-in winston-transport base class.
jest.mock('winston-daily-rotate-file', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const Transport = require('winston-transport');
  const winston = require('winston');

  class MockDailyRotateFile extends Transport {
    constructor(opts?: any) {
      super(opts);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    log(info: any, cb: () => void) {
      if (cb) cb();
    }
  }

  // Register on winston.transports so `new (winston.transports as any).DailyRotateFile()`
  // works inside the service.
  winston.transports.DailyRotateFile = MockDailyRotateFile;
  return MockDailyRotateFile;
});

import { AppLoggerService } from './app-logger.service';

describe('AppLoggerService', () => {
  let service: AppLoggerService;

  beforeEach(() => {
    service = new AppLoggerService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should expose log/error/warn/debug/verbose methods', () => {
    expect(typeof service.log).toBe('function');
    expect(typeof service.error).toBe('function');
    expect(typeof service.warn).toBe('function');
    expect(typeof service.debug).toBe('function');
    expect(typeof service.verbose).toBe('function');
  });

  it('log() should not throw', () => {
    expect(() => service.log('hello', 'TestContext')).not.toThrow();
  });

  it('error() with trace string should not throw', () => {
    expect(() =>
      service.error('something failed', 'Error: trace here', 'TestService'),
    ).not.toThrow();
  });

  it('error() with meta object should not throw', () => {
    expect(() =>
      service.error('something failed', {
        correlationId: 'abc',
        error: { name: 'Error', message: 'oops' },
      }),
    ).not.toThrow();
  });

  it('logError() should not throw', () => {
    const err = new Error('test error');
    expect(() => service.logError(err, { correlationId: 'x' })).not.toThrow();
  });

  it('logPerformance() should not throw', () => {
    expect(() => service.logPerformance('doSomething', 42)).not.toThrow();
  });

  it('http() should not throw', () => {
    expect(() =>
      service.http('GET /api/test', {
        correlationId: 'cid-1',
        http: { method: 'GET', url: '/api/test', statusCode: 200, durationMs: 15 },
      }),
    ).not.toThrow();
  });
});
