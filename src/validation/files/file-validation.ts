import { Injectable, PipeTransform, ArgumentMetadata } from '@nestjs/common';
import {
  FileValidationOptions,
  MultiFileValidationOptions,
  UploadedFileDto,
} from '../interfaces/validation.interfaces';
import { RequestValidationException } from '../errors/validation.exception';

/**
 * Parses size strings like '5MB', '500KB', '1.5GB', '1024B' into number of bytes.
 */
export function parseSizeToBytes(size: number | string): number {
  if (typeof size === 'number') {
    return size;
  }

  const trimmed = size.trim().toUpperCase();
  const match = trimmed.match(/^([\d.]+)\s*(B|KB|MB|GB|TB)$/);

  if (!match) {
    const fallback = Number(trimmed);
    if (!Number.isNaN(fallback)) {
      return fallback;
    }
    throw new Error(`Invalid size string format: "${size}". Example formats: '5MB', '500KB', '1GB'`);
  }

  const num = parseFloat(match[1]);
  const unit = match[2];

  const multipliers: Record<string, number> = {
    B: 1,
    KB: 1024,
    MB: 1024 * 1024,
    GB: 1024 * 1024 * 1024,
    TB: 1024 * 1024 * 1024 * 1024,
  };

  return Math.round(num * (multipliers[unit] || 1));
}

/**
 * Known file signatures (magic bytes) for binary validation.
 */
const MAGIC_SIGNATURES: {
  mime: string;
  extensions: string[];
  check: (buffer: Buffer) => boolean;
}[] = [
  {
    mime: 'image/jpeg',
    extensions: ['jpg', 'jpeg'],
    check: (buf) => buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff,
  },
  {
    mime: 'image/png',
    extensions: ['png'],
    check: (buf) =>
      buf.length >= 8 &&
      buf[0] === 0x89 &&
      buf[1] === 0x50 &&
      buf[2] === 0x4e &&
      buf[3] === 0x47 &&
      buf[4] === 0x0d &&
      buf[5] === 0x0a &&
      buf[6] === 0x1a &&
      buf[7] === 0x0a,
  },
  {
    mime: 'image/gif',
    extensions: ['gif'],
    check: (buf) =>
      buf.length >= 6 &&
      buf[0] === 0x47 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x38 &&
      (buf[4] === 0x37 || buf[4] === 0x39) &&
      buf[5] === 0x61,
  },
  {
    mime: 'image/webp',
    extensions: ['webp'],
    check: (buf) =>
      buf.length >= 12 &&
      buf.toString('ascii', 0, 4) === 'RIFF' &&
      buf.toString('ascii', 8, 12) === 'WEBP',
  },
  {
    mime: 'application/pdf',
    extensions: ['pdf'],
    check: (buf) => buf.length >= 4 && buf.toString('ascii', 0, 4) === '%PDF',
  },
  {
    mime: 'application/zip',
    extensions: ['zip'],
    check: (buf) =>
      buf.length >= 4 &&
      buf[0] === 0x50 &&
      buf[1] === 0x4b &&
      (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07) &&
      (buf[3] === 0x04 || buf[3] === 0x06 || buf[3] === 0x08),
  },
];

/**
 * Validates an uploaded single file against specified constraints.
 */
export function validateFile(
  file: UploadedFileDto | Express.Multer.File | undefined,
  options: FileValidationOptions = {},
): void {
  const {
    maxSize = '10MB',
    minSize = 1,
    allowedMimeTypes,
    allowedExtensions,
    validateMagicBytes = true,
    required = true,
    customErrorMessage,
  } = options;

  if (!file || !file.buffer) {
    if (required) {
      throw RequestValidationException.forField(
        file?.fieldname || 'file',
        customErrorMessage || 'File is required',
        'required_file',
      );
    }
    return;
  }

  const maxBytes = parseSizeToBytes(maxSize);
  const minBytes = parseSizeToBytes(minSize);
  const field = file.fieldname || 'file';

  // 1. Check size constraints
  if (file.size > maxBytes) {
    throw RequestValidationException.forField(
      field,
      customErrorMessage || `File size (${(file.size / (1024 * 1024)).toFixed(2)} MB) exceeds maximum allowed limit of ${maxSize}`,
      'file_too_large',
      file.size,
    );
  }

  if (file.size < minBytes) {
    throw RequestValidationException.forField(
      field,
      customErrorMessage || `File size (${file.size} bytes) is below minimum required limit of ${minSize}`,
      'file_too_small',
      file.size,
    );
  }

  // 2. Check file extension
  const ext = file.originalname.includes('.')
    ? file.originalname.split('.').pop()!.toLowerCase()
    : '';

  if (allowedExtensions && allowedExtensions.length > 0) {
    const normalizedAllowed = allowedExtensions.map((e) =>
      e.startsWith('.') ? e.slice(1).toLowerCase() : e.toLowerCase(),
    );

    if (!ext || !normalizedAllowed.includes(ext)) {
      throw RequestValidationException.forField(
        field,
        customErrorMessage || `File extension '.${ext}' is not permitted. Allowed extensions: ${normalizedAllowed.map((e) => `.${e}`).join(', ')}`,
        'invalid_file_extension',
        ext,
      );
    }
  }

  // 3. Check declared MIME type
  if (allowedMimeTypes && allowedMimeTypes.length > 0) {
    const isMimeAllowed = allowedMimeTypes.some((pattern) => {
      if (typeof pattern === 'string') {
        return pattern.toLowerCase() === file.mimetype.toLowerCase();
      }
      return pattern.test(file.mimetype);
    });

    if (!isMimeAllowed) {
      throw RequestValidationException.forField(
        field,
        customErrorMessage || `File MIME type '${file.mimetype}' is not permitted`,
        'invalid_mime_type',
        file.mimetype,
      );
    }
  }

  // 4. Check binary magic bytes to prevent MIME spoofing
  if (validateMagicBytes && file.buffer) {
    const matchingSignature = MAGIC_SIGNATURES.find((sig) => {
      if (sig.mime.toLowerCase() === file.mimetype.toLowerCase()) {
        return true;
      }
      return ext ? sig.extensions.includes(ext) : false;
    });

    if (matchingSignature) {
      const isValidMagic = matchingSignature.check(file.buffer);
      if (!isValidMagic) {
        throw RequestValidationException.forField(
          field,
          customErrorMessage || `File content does not match the declared file type '${file.mimetype}' (magic signature mismatch)`,
          'corrupted_or_spoofed_file',
        );
      }
    }
  }
}

/**
 * Validates an array of uploaded files.
 */
export function validateFiles(
  files: (UploadedFileDto | Express.Multer.File)[] | undefined,
  options: MultiFileValidationOptions = {},
): void {
  const { minCount = 1, maxCount, totalMaxSize, required = true, customErrorMessage } = options;

  if (!files || files.length === 0) {
    if (required) {
      throw RequestValidationException.forField(
        'files',
        customErrorMessage || 'At least one file must be uploaded',
        'required_files',
      );
    }
    return;
  }

  if (minCount !== undefined && files.length < minCount) {
    throw RequestValidationException.forField(
      'files',
      customErrorMessage || `Minimum ${minCount} file(s) required, but received ${files.length}`,
      'too_few_files',
      files.length,
    );
  }

  if (maxCount !== undefined && files.length > maxCount) {
    throw RequestValidationException.forField(
      'files',
      customErrorMessage || `Maximum ${maxCount} file(s) allowed, but received ${files.length}`,
      'too_many_files',
      files.length,
    );
  }

  if (totalMaxSize) {
    const maxTotalBytes = parseSizeToBytes(totalMaxSize);
    const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
    if (totalBytes > maxTotalBytes) {
      throw RequestValidationException.forField(
        'files',
        customErrorMessage || `Total upload size (${(totalBytes / (1024 * 1024)).toFixed(2)} MB) exceeds maximum total limit of ${totalMaxSize}`,
        'total_size_exceeded',
        totalBytes,
      );
    }
  }

  for (let i = 0; i < files.length; i++) {
    validateFile(files[i], options);
  }
}

/**
 * NestJS Pipe for single file validation.
 */
@Injectable()
export class FileValidationPipe implements PipeTransform {
  constructor(private readonly options: FileValidationOptions = {}) {}

  transform(value: any, _metadata: ArgumentMetadata): any {
    validateFile(value, this.options);
    return value;
  }
}

/**
 * NestJS Pipe for multiple files validation.
 */
@Injectable()
export class MultiFileValidationPipe implements PipeTransform {
  constructor(private readonly options: MultiFileValidationOptions = {}) {}

  transform(value: any, _metadata: ArgumentMetadata): any {
    if (Array.isArray(value)) {
      validateFiles(value, this.options);
    } else if (value) {
      validateFile(value, this.options);
    }
    return value;
  }
}
