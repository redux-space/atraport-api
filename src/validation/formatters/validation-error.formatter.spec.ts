import { z, ZodError } from 'zod';
import { ValidationErrorFormatter } from './validation-error.formatter';

describe('ValidationErrorFormatter (#69)', () => {
  const nestedSchema = z.object({
    a: z.object({
      b: z.array(
        z.object({
          c: z.number().positive(),
        }),
      ),
    }),
    email: z.string().email(),
    role: z.enum(['admin', 'user']),
  });

  it('renders nested object and array index paths in stable dot/bracket notation (a.b[0].c)', () => {
    let zodErr!: ZodError;
    try {
      nestedSchema.parse({
        a: { b: [{ c: -5 }] },
        email: 'valid@example.com',
        role: 'user',
      });
    } catch (err) {
      zodErr = err as ZodError;
    }

    const formatted = ValidationErrorFormatter.formatZodError(zodErr);
    expect(formatted).toHaveLength(1);
    expect(formatted[0].field).toBe('a.b[0].c');
    expect(formatted[0].path).toEqual(['a', 'b', 0, 'c']);
    expect(formatted[0].code).toBe('too_small');
  });

  it('preserves all simultaneous validation errors across multiple fields', () => {
    let zodErr!: ZodError;
    try {
      nestedSchema.parse({
        a: { b: [{ c: 0 }, { c: -10 }] },
        email: 'invalid-email',
        role: 'guest',
      });
    } catch (err) {
      zodErr = err as ZodError;
    }

    const formatter = new ValidationErrorFormatter();
    const formatted = formatter.formatZodError(zodErr);

    expect(formatted).toHaveLength(4);
    expect(formatted.map((e) => e.field)).toEqual([
      'a.b[0].c',
      'a.b[1].c',
      'email',
      'role',
    ]);
  });

  it('normalizes missing required field messages and maps root-level errors to root', () => {
    const stringSchema = z.string();
    let rootErr!: ZodError;
    try {
      stringSchema.parse(undefined);
    } catch (err) {
      rootErr = err as ZodError;
    }

    const [rootFormatted] = ValidationErrorFormatter.formatZodError(rootErr);
    expect(rootFormatted.field).toBe('root');
    expect(rootFormatted.message).toBe('This field is required');
    expect(rootFormatted.path).toEqual([]);
  });

  it('does not leak stack traces or internal schema properties and survives JSON.stringify round-tripping', () => {
    let zodErr!: ZodError;
    try {
      nestedSchema.parse({
        a: { b: [{ c: 'wrong' }] },
        email: 123,
        role: 'user',
      });
    } catch (err) {
      zodErr = err as ZodError;
    }

    const formatted = ValidationErrorFormatter.formatZodError(zodErr);
    for (const item of formatted) {
      expect(Object.keys(item).sort()).toEqual(
        expect.arrayContaining(['code', 'field', 'message', 'path']),
      );
      expect((item as any).stack).toBeUndefined();
      expect((item as any).issues).toBeUndefined();
    }

    const roundTripped = JSON.parse(JSON.stringify(formatted));
    expect(roundTripped).toEqual(formatted);
  });
});
