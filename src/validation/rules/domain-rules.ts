import { z, ZodType } from 'zod';
import { StrKey } from 'stellar-sdk';

/**
 * Validates a Stellar Ed25519 Public Key (Account ID).
 * Checks StrKey checksum and format (starts with 'G', 56 chars base32).
 */
export const stellarAddress = (customMessage?: string) =>
  z.string({ required_error: 'Stellar address is required' })
    .trim()
    .refine(
      (val) => {
        try {
          return StrKey.isValidEd25519PublicKey(val);
        } catch {
          return /^G[A-Z2-7]{55}$/.test(val);
        }
      },
      {
        message: customMessage || 'Invalid Stellar public address (must be a valid 56-character Ed25519 public key starting with G)',
      },
    );

/**
 * Validates a Stellar Secret Key (Seed).
 * Checks StrKey checksum and format (starts with 'S', 56 chars base32).
 */
export const stellarSecretKey = (customMessage?: string) =>
  z.string({ required_error: 'Stellar secret key is required' })
    .trim()
    .refine(
      (val) => {
        try {
          return StrKey.isValidEd25519SecretSeed(val);
        } catch {
          return /^S[A-Z2-7]{55}$/.test(val);
        }
      },
      {
        message: customMessage || 'Invalid Stellar secret key (must be a valid 56-character secret seed starting with S)',
      },
    );

/**
 * Validates a 64-character hexadecimal transaction hash.
 */
export const stellarTxHash = (customMessage?: string) =>
  z.string({ required_error: 'Transaction hash is required' })
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/, {
      message: customMessage || 'Invalid transaction hash: must be a 64-character hexadecimal string',
    });

/**
 * Validates an alphanumeric Stellar asset code (1-12 characters or 'native').
 */
export const stellarAssetCode = (customMessage?: string) =>
  z.string({ required_error: 'Asset code is required' })
    .trim()
    .regex(/^(native|[a-zA-Z0-9]{1,12})$/, {
      message: customMessage || 'Invalid asset code: must be "native" or 1-12 alphanumeric characters',
    });

export interface CurrencyAmountOptions {
  min?: number;
  max?: number;
  maxDecimals?: number;
  allowZero?: boolean;
}

/**
 * Validates a currency amount (as string or number) with precision and bounds checking.
 * Stellar amounts support up to 7 decimal places (stroops).
 */
export const currencyAmount = (options: CurrencyAmountOptions = {}) => {
  const { min = 0, max, maxDecimals = 7, allowZero = true } = options;

  return z.union([z.string(), z.number()])
    .transform((val, ctx) => {
      const strVal = typeof val === 'number' ? val.toString() : val.trim();
      const num = Number(strVal);

      if (Number.isNaN(num) || !/^-?\d+(\.\d+)?$/.test(strVal)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount must be a valid numeric value',
        });
        return z.NEVER;
      }

      if (!allowZero && num === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Amount must be strictly greater than zero',
        });
        return z.NEVER;
      }

      if (num < min) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_small,
          minimum: min,
          type: 'number',
          inclusive: true,
          message: `Amount must be at least ${min}`,
        });
        return z.NEVER;
      }

      if (max !== undefined && num > max) {
        ctx.addIssue({
          code: z.ZodIssueCode.too_big,
          maximum: max,
          type: 'number',
          inclusive: true,
          message: `Amount cannot exceed ${max}`,
        });
        return z.NEVER;
      }

      const decimalParts = strVal.split('.');
      if (decimalParts.length === 2 && decimalParts[1].length > maxDecimals) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Amount exceeds maximum allowed precision of ${maxDecimals} decimal places`,
        });
        return z.NEVER;
      }

      return strVal;
    });
};

/**
 * Validates a percentage value between 0 and 100.
 */
export const percentage = (options: { min?: number; max?: number } = {}) => {
  const min = options.min ?? 0;
  const max = options.max ?? 100;

  return z.coerce
    .number({ invalid_type_error: 'Percentage must be a valid number' })
    .min(min, { message: `Percentage must be at least ${min}%` })
    .max(max, { message: `Percentage cannot exceed ${max}%` });
};

/**
 * Validates password strength (minimum 8 chars, uppercase, lowercase, number, special char).
 */
export const securePassword = (options: {
  minLength?: number;
  requireUppercase?: boolean;
  requireLowercase?: boolean;
  requireNumbers?: boolean;
  requireSpecial?: boolean;
} = {}) => {
  const {
    minLength = 8,
    requireUppercase = true,
    requireLowercase = true,
    requireNumbers = true,
    requireSpecial = true,
  } = options;

  return z.string()
    .min(minLength, { message: `Password must be at least ${minLength} characters long` })
    .superRefine((val, ctx) => {
      if (requireUppercase && !/[A-Z]/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one uppercase letter',
        });
      }
      if (requireLowercase && !/[a-z]/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one lowercase letter',
        });
      }
      if (requireNumbers && !/[0-9]/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one number',
        });
      }
      if (requireSpecial && !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(val)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password must contain at least one special character',
        });
      }
    });
};

/**
 * Sanitizes a string by stripping dangerous HTML/scripts and trimming whitespace.
 */
export const sanitizedString = (options: { minLength?: number; maxLength?: number } = {}) => {
  let schema = z.string().trim();

  if (options.minLength !== undefined) {
    schema = schema.min(options.minLength, {
      message: `Must be at least ${options.minLength} characters`,
    });
  }

  if (options.maxLength !== undefined) {
    schema = schema.max(options.maxLength, {
      message: `Cannot exceed ${options.maxLength} characters`,
    });
  }

  return schema.transform((val) => {
    return val
      .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
      .replace(/<[^>]+>/g, '')
      .replace(/\0/g, '');
  });
};

/**
 * Validates an ISO-8601 date string.
 */
export const isoDateString = () =>
  z.string()
    .datetime({ message: 'Must be a valid ISO-8601 date string (e.g. 2026-01-01T00:00:00.000Z)' });

/**
 * Validates that a date is in the future.
 */
export const futureDate = (customMessage?: string) =>
  z.coerce.date().refine((date) => date.getTime() > Date.now(), {
    message: customMessage || 'Date must be in the future',
  });

/**
 * Validates that a date is in the past.
 */
export const pastDate = (customMessage?: string) =>
  z.coerce.date().refine((date) => date.getTime() < Date.now(), {
    message: customMessage || 'Date must be in the past',
  });

/**
 * Validates standard UUID v4.
 */
export const uuidV4 = (customMessage?: string) =>
  z.string().uuid({ message: customMessage || 'Invalid UUID v4 format' });

/**
 * Validates an Ethereum/EVM hex address.
 */
export const ethereumAddress = (customMessage?: string) =>
  z.string().regex(/^0x[a-fA-F0-9]{40}$/, {
    message: customMessage || 'Invalid Ethereum address (must be 0x followed by 40 hexadecimal characters)',
  });

/**
 * Validates an IPv4 or IPv6 address.
 */
export const ipAddress = (customMessage?: string) =>
  z.string().ip({ message: customMessage || 'Invalid IP address' });

/**
 * Composite domain rules export.
 */
export const domainRules = {
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
};
