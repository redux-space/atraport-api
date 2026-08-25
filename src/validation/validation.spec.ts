import { z } from 'zod';
import {
  ZodValidationPipe,
  ValidationErrorFormatter,
  RequestValidationException,
  createValidationMiddleware,
  stellarAddress,
  stellarSecretKey,
  stellarTxHash,
  stellarAssetCode,
  currencyAmount,
  percentage,
  securePassword,
  sanitizedString,
  isoDateString,
  futureDate,
  pastDate,
  uuidV4,
  ethereumAddress,
  ipAddress,
  validateFile,
  validateFiles,
  FileValidationPipe,
  parseSizeToBytes,
  zodToOpenApiSchema,
  ValidationSchemaRegistry,
} from './index';

describe('Request Validation Module', () => {
  // ── 1. ZodValidationPipe & Nested Validation ─────────────────────────────
  describe('ZodValidationPipe', () => {
    const userSchema = z.object({
      id: z.string().uuid(),
      username: z.string().min(3),
      profile: z.object({
        age: z.number().int().min(18),
        address: z.object({
          city: z.string(),
          zipCode: z.string().regex(/^\d{5}$/),
        }),
      }),
      tags: z.array(z.string()).min(1),
      allocations: z.array(
        z.object({
          asset: z.string(),
          weight: z.number().min(0).max(100),
        }),
      ),
    });

    const pipe = new ZodValidationPipe(userSchema);

    it('should successfully validate valid complex nested payload', () => {
      const validPayload = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        username: 'alice',
        profile: {
          age: 25,
          address: {
            city: 'New York',
            zipCode: '10001',
          },
        },
        tags: ['crypto', 'stellar'],
        allocations: [{ asset: 'XLM', weight: 50 }, { asset: 'USDC', weight: 50 }],
      };

      const result = pipe.transform(validPayload, { type: 'body' });
      expect(result).toEqual(validPayload);
    });

    it('should throw RequestValidationException with nested paths when invalid', () => {
      const invalidPayload = {
        id: 'not-a-uuid',
        username: 'ab',
        profile: {
          age: 15,
          address: {
            city: 'New York',
            zipCode: 'invalid-zip',
          },
        },
        tags: [],
        allocations: [{ asset: 'XLM', weight: 150 }],
      };

      try {
        pipe.transform(invalidPayload, { type: 'body' });
        fail('Should have thrown RequestValidationException');
      } catch (err: any) {
        expect(err).toBeInstanceOf(RequestValidationException);
        expect(err.statusCode).toBe(400);
        expect(err.code).toBe('VALIDATION_ERROR');

        const fields = err.errors.map((e: any) => e.field);
        expect(fields).toContain('id');
        expect(fields).toContain('username');
        expect(fields).toContain('profile.age');
        expect(fields).toContain('profile.address.zipCode');
        expect(fields).toContain('tags');
        expect(fields).toContain('allocations[0].weight');
      }
    });

    it('should return value unchanged if no schema provided to pipe', () => {
      const noSchemaPipe = new ZodValidationPipe();
      const payload = { any: 'data' };
      expect(noSchemaPipe.transform(payload, { type: 'body' })).toEqual(payload);
    });
  });

  // ── 2. Error Formatter ───────────────────────────────────────────────────
  describe('ValidationErrorFormatter', () => {
    it('should format array index paths correctly', () => {
      expect(ValidationErrorFormatter.buildFieldPath(['portfolio', 'items', 0, 'asset'])).toBe(
        'portfolio.items[0].asset',
      );
      expect(ValidationErrorFormatter.buildFieldPath(['users', 3, 'tags', 1])).toBe(
        'users[3].tags[1]',
      );
      expect(ValidationErrorFormatter.buildFieldPath([])).toBe('');
    });
  });

  // ── 3. Domain Rules ──────────────────────────────────────────────────────
  describe('Domain Rules', () => {
    describe('stellarAddress', () => {
      const schema = stellarAddress();
      const validAddress = 'GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5';

      it('should accept valid Stellar Ed25519 public key', () => {
        expect(schema.parse(validAddress)).toBe(validAddress);
      });

      it('should reject invalid public key or malformed checksum', () => {
        expect(() => schema.parse('GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA0')).toThrow();
        expect(() => schema.parse('SBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5')).toThrow();
        expect(() => schema.parse('too-short')).toThrow();
      });
    });

    describe('stellarSecretKey', () => {
      const schema = stellarSecretKey();
      const validSecret = 'SCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4';

      it('should accept valid Stellar secret seed', () => {
        expect(schema.parse(validSecret)).toBe(validSecret);
      });

      it('should reject invalid secret seed', () => {
        expect(() => schema.parse('GCZANGBA5YHTNYVVV4C3U252E2B6P6F5T3U6MM63WBSBZATAQI3EBTQ4')).toThrow();
      });
    });

    describe('stellarTxHash', () => {
      const schema = stellarTxHash();
      const validHash = 'a1b2c3d4e5f60718293a4b5c6d7e8f901234567890abcdef1234567890abcdef';

      it('should accept 64 hex characters', () => {
        expect(schema.parse(validHash)).toBe(validHash);
      });

      it('should reject non-hex or invalid length hash', () => {
        expect(() => schema.parse('invalid_hash')).toThrow();
        expect(() => schema.parse(validHash + 'extra')).toThrow();
      });
    });

    describe('stellarAssetCode', () => {
      const schema = stellarAssetCode();

      it('should accept native and 1-12 alphanumeric codes', () => {
        expect(schema.parse('native')).toBe('native');
        expect(schema.parse('XLM')).toBe('XLM');
        expect(schema.parse('USDC')).toBe('USDC');
        expect(schema.parse('EURC12345678')).toBe('EURC12345678');
      });

      it('should reject invalid asset codes', () => {
        expect(() => schema.parse('toolongassetcodename')).toThrow();
        expect(() => schema.parse('XLM$')).toThrow();
      });
    });

    describe('currencyAmount', () => {
      const schema = currencyAmount({ min: 10, max: 1000, maxDecimals: 7 });

      it('should accept valid amounts in range with valid decimals', () => {
        expect(schema.parse('10.5000000')).toBe('10.5000000');
        expect(schema.parse(250.75)).toBe('250.75');
      });

      it('should reject amounts out of range or exceeding decimals', () => {
        expect(() => schema.parse('5')).toThrow(); // below min
        expect(() => schema.parse('1500')).toThrow(); // above max
        expect(() => schema.parse('50.12345678')).toThrow(); // > 7 decimals
        expect(() => schema.parse('not-a-number')).toThrow();
      });
    });

    describe('percentage', () => {
      const schema = percentage({ min: 0, max: 100 });

      it('should validate percentage numbers', () => {
        expect(schema.parse(50)).toBe(50);
        expect(schema.parse('25.5')).toBe(25.5);
      });

      it('should reject percentage outside range', () => {
        expect(() => schema.parse(-1)).toThrow();
        expect(() => schema.parse(101)).toThrow();
      });
    });

    describe('securePassword', () => {
      const schema = securePassword();

      it('should accept strong password', () => {
        expect(schema.parse('ValidP@ssw0rd!')).toBe('ValidP@ssw0rd!');
      });

      it('should reject weak passwords', () => {
        expect(() => schema.parse('short1!')).toThrow();
        expect(() => schema.parse('nouppercase1!')).toThrow();
        expect(() => schema.parse('NOLOWERCASE1!')).toThrow();
        expect(() => schema.parse('NoNumber!')).toThrow();
        expect(() => schema.parse('NoSpecialChar123')).toThrow();
      });
    });

    describe('sanitizedString', () => {
      const schema = sanitizedString();

      it('should strip XSS script tags and HTML tags', () => {
        const input = '  <script>alert("xss")</script><b>Hello</b> World!  ';
        expect(schema.parse(input)).toBe('Hello World!');
      });
    });

    describe('isoDateString, futureDate, pastDate', () => {
      it('should validate ISO date strings', () => {
        const iso = isoDateString();
        expect(iso.parse('2026-01-01T00:00:00.000Z')).toBe('2026-01-01T00:00:00.000Z');
        expect(() => iso.parse('01/01/2026')).toThrow();
      });

      it('should validate future and past dates', () => {
        const future = futureDate();
        const past = pastDate();
        const futureTime = new Date(Date.now() + 1000000).toISOString();
        const pastTime = new Date(Date.now() - 1000000).toISOString();

        expect(future.parse(futureTime)).toBeInstanceOf(Date);
        expect(() => future.parse(pastTime)).toThrow();

        expect(past.parse(pastTime)).toBeInstanceOf(Date);
        expect(() => past.parse(futureTime)).toThrow();
      });
    });

    describe('uuidV4, ethereumAddress, ipAddress', () => {
      it('should validate uuidV4', () => {
        const schema = uuidV4();
        expect(schema.parse('e7b99c72-e19a-4c9d-8386-3fbe3f619b0d')).toBe('e7b99c72-e19a-4c9d-8386-3fbe3f619b0d');
        expect(() => schema.parse('invalid')).toThrow();
      });

      it('should validate ethereumAddress', () => {
        const schema = ethereumAddress();
        expect(schema.parse('0x71C7656EC7ab88b098defB751B7401B5f6d8976F')).toBe('0x71C7656EC7ab88b098defB751B7401B5f6d8976F');
        expect(() => schema.parse('0x123')).toThrow();
      });

      it('should validate ipAddress', () => {
        const schema = ipAddress();
        expect(schema.parse('192.168.1.1')).toBe('192.168.1.1');
        expect(schema.parse('2001:db8::1')).toBe('2001:db8::1');
        expect(() => schema.parse('999.999.999.999')).toThrow();
      });
    });
  });

  // ── 4. Reusable Validation Middleware ────────────────────────────────────
  describe('ValidationMiddleware', () => {
    const middleware = createValidationMiddleware({
      body: z.object({
        name: z.string().min(2),
      }),
      query: z.object({
        page: z.coerce.number().min(1),
      }),
      params: z.object({
        id: z.string().uuid(),
      }),
    });

    it('should validate and sanitize req.body, req.query, and req.params', () => {
      const req: any = {
        body: { name: 'Bob' },
        query: { page: '2' },
        params: { id: 'e7b99c72-e19a-4c9d-8386-3fbe3f619b0d' },
      };
      const res: any = {};
      let nextCalled = false;
      const next = (err?: any) => {
        expect(err).toBeUndefined();
        nextCalled = true;
      };

      middleware(req, res, next);
      expect(nextCalled).toBe(true);
      expect(req.query.page).toBe(2);
      expect(req.validatedData).toBeDefined();
      expect(req.validatedData.body).toEqual({ name: 'Bob' });
    });

    it('should call next with RequestValidationException when invalid', () => {
      const req: any = {
        body: { name: 'A' },
        query: { page: '0' },
        params: { id: 'bad-id' },
      };
      const res: any = {};
      let receivedError: any;
      const next = (err?: any) => {
        receivedError = err;
      };

      middleware(req, res, next);
      expect(receivedError).toBeInstanceOf(RequestValidationException);
      expect(receivedError.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ── 5. File Upload Validation ────────────────────────────────────────────
  describe('File Upload Validation', () => {
    it('should parse size strings into bytes', () => {
      expect(parseSizeToBytes('1KB')).toBe(1024);
      expect(parseSizeToBytes('5MB')).toBe(5 * 1024 * 1024);
      expect(parseSizeToBytes('1GB')).toBe(1024 * 1024 * 1024);
      expect(parseSizeToBytes(2048)).toBe(2048);
    });

    it('should validate valid PNG file buffer with magic bytes', () => {
      const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);
      const file: any = {
        originalname: 'image.png',
        mimetype: 'image/png',
        size: pngBuffer.length,
        buffer: pngBuffer,
      };

      expect(() =>
        validateFile(file, {
          maxSize: '1MB',
          allowedMimeTypes: ['image/png'],
          allowedExtensions: ['png'],
          validateMagicBytes: true,
        }),
      ).not.toThrow();
    });

    it('should reject file when MIME type does not match magic bytes (spoofing detection)', () => {
      const fakePngBuffer = Buffer.from('NOT A REAL PNG FILE HEADER CONTENT');
      const file: any = {
        originalname: 'evil.png',
        mimetype: 'image/png',
        size: fakePngBuffer.length,
        buffer: fakePngBuffer,
      };

      expect(() =>
        validateFile(file, {
          allowedMimeTypes: ['image/png'],
          validateMagicBytes: true,
        }),
      ).toThrow(RequestValidationException);
    });

    it('should reject file exceeding maximum size', () => {
      const buffer = Buffer.alloc(2000);
      const file: any = {
        originalname: 'large.pdf',
        mimetype: 'application/pdf',
        size: 2000,
        buffer,
      };

      expect(() =>
        validateFile(file, {
          maxSize: 1000,
        }),
      ).toThrow(RequestValidationException);
    });

    it('should validate multiple files with min and max counts', () => {
      const buf = Buffer.alloc(10);
      const files: any[] = [
        { originalname: 'doc1.pdf', mimetype: 'application/pdf', size: 10, buffer: buf },
        { originalname: 'doc2.pdf', mimetype: 'application/pdf', size: 10, buffer: buf },
      ];

      expect(() =>
        validateFiles(files, {
          minCount: 1,
          maxCount: 3,
          validateMagicBytes: false,
        }),
      ).not.toThrow();

      expect(() =>
        validateFiles(files, {
          minCount: 3,
          validateMagicBytes: false,
        }),
      ).toThrow(RequestValidationException);
    });

    it('FileValidationPipe transforms valid file', () => {
      const pipe = new FileValidationPipe({ maxSize: '5MB', validateMagicBytes: false });
      const file: any = { originalname: 'test.txt', size: 100, buffer: Buffer.alloc(100) };
      expect(pipe.transform(file, { type: 'custom' })).toBe(file);
    });
  });

  // ── 6. OpenAPI Schema Conversion ─────────────────────────────────────────
  describe('Zod to OpenAPI Schema Converter', () => {
    it('should convert complex Zod schema to OpenAPI 3.0 schema object', () => {
      const schema = z.object({
        id: z.string().uuid().describe('Unique identifier'),
        name: z.string().min(2).max(50),
        status: z.enum(['active', 'pending', 'inactive']),
        age: z.number().int().min(0).max(120),
        isVerified: z.boolean(),
        optionalNotes: z.string().optional(),
        tags: z.array(z.string()),
      });

      const openApiSchema = zodToOpenApiSchema(schema);

      expect(openApiSchema.type).toBe('object');
      expect(openApiSchema.properties).toBeDefined();
      expect(openApiSchema.properties?.id.type).toBe('string');
      expect(openApiSchema.properties?.id.format).toBe('uuid');
      expect(openApiSchema.properties?.id.description).toBe('Unique identifier');
      expect(openApiSchema.properties?.name.minLength).toBe(2);
      expect(openApiSchema.properties?.name.maxLength).toBe(50);
      expect(openApiSchema.properties?.status.enum).toEqual(['active', 'pending', 'inactive']);
      expect(openApiSchema.properties?.age.type).toBe('integer');
      expect(openApiSchema.properties?.isVerified.type).toBe('boolean');
      expect(openApiSchema.properties?.tags.type).toBe('array');

      expect(openApiSchema.required).toContain('id');
      expect(openApiSchema.required).toContain('name');
      expect(openApiSchema.required).not.toContain('optionalNotes');
    });

    it('should register schema in ValidationSchemaRegistry', () => {
      const schema = z.object({
        account: stellarAddress(),
      });

      ValidationSchemaRegistry.registerSchema('StellarAccountRequest', schema);
      const components = ValidationSchemaRegistry.getComponentsSchemas();

      expect(components.StellarAccountRequest).toBeDefined();
      expect(components.StellarAccountRequest.type).toBe('object');
    });
  });
});
