import { CorrelationIdMiddleware, CORRELATION_ID_HEADER, CORRELATION_ID_KEY } from './correlation-id.middleware';
import { Request, Response } from 'express';

function makeMockReq(headers: Record<string, string> = {}): Partial<Request> {
  return { headers } as any;
}

function makeMockRes(): { headers: Record<string, string>; setHeader: jest.Mock } {
  const headers: Record<string, string> = {};
  return {
    headers,
    setHeader: jest.fn((key: string, val: string) => {
      headers[key] = val;
    }),
  };
}

describe('CorrelationIdMiddleware', () => {
  let middleware: CorrelationIdMiddleware;

  beforeEach(() => {
    middleware = new CorrelationIdMiddleware();
  });

  it('should generate a new UUID when no correlation-id header is present', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();

    middleware.use(req as Request, res as any, next);

    expect((req as any)[CORRELATION_ID_KEY]).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(res.setHeader).toHaveBeenCalledWith(
      CORRELATION_ID_HEADER,
      (req as any)[CORRELATION_ID_KEY],
    );
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('should reuse an existing correlation-id header', () => {
    const existingId = '550e8400-e29b-41d4-a716-446655440000';
    const req = makeMockReq({ [CORRELATION_ID_HEADER]: existingId });
    const res = makeMockRes();
    const next = jest.fn();

    middleware.use(req as Request, res as any, next);

    expect((req as any)[CORRELATION_ID_KEY]).toBe(existingId);
    expect(res.setHeader).toHaveBeenCalledWith(CORRELATION_ID_HEADER, existingId);
  });

  it('should call next()', () => {
    const req = makeMockReq();
    const res = makeMockRes();
    const next = jest.fn();

    middleware.use(req as Request, res as any, next);
    expect(next).toHaveBeenCalledTimes(1);
  });
});
