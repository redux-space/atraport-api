import { ZodSchema, ZodTypeDef } from 'zod';

/**
 * Single field-level validation error structure.
 */
export interface FormattedValidationError {
  /** Dot-notation or bracket-notation path to the invalid field (e.g. 'user.email' or 'items[0].price') */
  field: string;
  /** Human-readable explanation of why validation failed */
  message: string;
  /** Error code categorising the failure (e.g. 'invalid_type', 'too_small', 'custom') */
  code: string;
  /** Array path components, preserving numerical array indexes and object keys */
  path: (string | number)[];
  /** Received value if available */
  received?: unknown;
  /** Expected type or constraint description if available */
  expected?: string;
}

/**
 * Standard request validation error envelope payload.
 */
export interface ValidationErrorPayload {
  statusCode: number;
  error: string;
  message: string;
  code: string;
  errors: FormattedValidationError[];
  correlationId?: string;
  timestamp: string;
  path?: string;
}

/**
 * Target parts of an incoming HTTP request that can be validated.
 */
export type ValidationTarget = 'body' | 'query' | 'params' | 'headers';

/**
 * Options for validation middleware and pipes.
 */
export interface ValidationOptions {
  /** If true, stops validation after the first error. Default is false (collect all errors). */
  abortEarly?: boolean;
  /** If true, automatically strips unknown properties from objects when parsing. Default is true. */
  stripUnknown?: boolean;
  /** If true, coerces string representations of primitives (numbers, booleans, dates) in query/params. Default is true. */
  coercePrimitives?: boolean;
  /** Custom error message when the entire payload is missing or invalid */
  customErrorMessage?: string;
}

/**
 * Configuration options for the Express / NestJS validation middleware.
 */
export interface ValidationMiddlewareOptions extends ValidationOptions {
  body?: ZodSchema<any, ZodTypeDef, any>;
  query?: ZodSchema<any, ZodTypeDef, any>;
  params?: ZodSchema<any, ZodTypeDef, any>;
  headers?: ZodSchema<any, ZodTypeDef, any>;
}

/**
 * Configuration options for file upload validation.
 */
export interface FileValidationOptions {
  /** Maximum allowed file size in bytes or formatted string (e.g. '5MB', '500KB', '1GB'). Default is 10MB */
  maxSize?: number | string;
  /** Minimum allowed file size in bytes or formatted string (e.g. '1KB'). Default is 1 */
  minSize?: number | string;
  /** Array of allowed MIME types (e.g. ['image/png', 'image/jpeg', 'application/pdf']) or regex (e.g. /^image\//) */
  allowedMimeTypes?: (string | RegExp)[];
  /** Array of allowed file extensions with or without leading dot (e.g. ['.png', '.jpg', 'pdf']) */
  allowedExtensions?: string[];
  /** Whether to verify binary magic bytes/signature to prevent MIME-spoofing. Default is true */
  validateMagicBytes?: boolean;
  /** Whether the file is required. Default is true */
  required?: boolean;
  /** Custom error message on file validation failure */
  customErrorMessage?: string;
}

/**
 * Configuration options for multi-file upload validation.
 */
export interface MultiFileValidationOptions extends FileValidationOptions {
  /** Minimum number of uploaded files required */
  minCount?: number;
  /** Maximum number of uploaded files allowed */
  maxCount?: number;
  /** Maximum aggregate upload size across all files */
  totalMaxSize?: number | string;
}

/**
 * Standard shape of an uploaded file (compatible with Express.Multer.File).
 */
export interface UploadedFileDto {
  fieldname?: string;
  originalname: string;
  encoding?: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
  destination?: string;
  filename?: string;
  path?: string;
}
