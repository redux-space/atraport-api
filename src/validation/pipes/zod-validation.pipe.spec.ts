import { z } from 'zod';
import {
  ZodValidationPipe,
  createZodValidationPipe,
} from './zod-validation.pipe';
import { RequestValidationException } from '../errors/validation.exception';

describe('ZodValidationPipe (#69)', () => {
  const querySchema = z.object({
    page: z.coerce.number().int().positive(),
    limit: z.coerce.number().int().min(1).max(100).default(20),
    search: z.string().trim().optional(),
  });

  it('returns value unchanged when no schema is provided', () => {
    const pipe = new ZodValidationPipe();
    const raw = { untouched: '123' };
    expect(pipe.transform(raw)).toBe(raw);
  });

  it('validates and returns the coerced/transformed payload rather than the raw input', () => {
    const pipe = createZodValidationPipe(querySchema);
    const rawInput = { page: '42', search: '  stellar  ', extraField: 'ignored' };

    const result = pipe.transform(rawInput) as z.infer<typeof querySchema>;

    expect(result).toEqual({
      page: 42,
      limit: 20,
      search: 'stellar',
    });
    expect(typeof result.page).toBe('number');
    expect((result as any).extraField).toBeUndefined();
  });

  it('throws RequestValidationException (status 400) instead of raw ZodError on invalid payload', () => {
    const pipe = new ZodValidationPipe(querySchema, {
      customErrorMessage: 'Invalid query parameters',
    });

    let caught: unknown;
    try {
      pipe.transform({ page: 'not-a-number', limit: 500 });
    } catch (err) {
      caught = err;
    }

    expect(caught).toBeInstanceOf(RequestValidationException);
    const validationErr = caught as RequestValidationException;
    expect(validationErr.statusCode).toBe(400);
    expect(validationErr.code).toBe('VALIDATION_ERROR');
    expect(validationErr.message).toBe('Invalid query parameters');
    expect(validationErr.errors.map((e) => e.field)).toEqual(['page', 'limit']);
  });

  it('handles non-object payloads (primitives and arrays) by throwing RequestValidationException', () => {
    const pipe = new ZodValidationPipe(querySchema);

    for (const badInput of ['raw-string', 12345, ['array-item'], null]) {
      expect(() => pipe.transform(badInput)).toThrow(RequestValidationException);
    }
  });

  it('rethrows non-ZodError exceptions unchanged', () => {
    const brokenSchema = {
      parse: () => {
        throw new TypeError('Unexpected parser failure');
      },
    } as any;
    const pipe = new ZodValidationPipe(brokenSchema);

    expect(() => pipe.transform({})).toThrow(TypeError);
  });
});
