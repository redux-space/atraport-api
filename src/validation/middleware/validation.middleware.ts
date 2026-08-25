import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import {
  FormattedValidationError,
  ValidationMiddlewareOptions,
  ValidationTarget,
} from '../interfaces/validation.interfaces';
import { ValidationErrorFormatter } from '../formatters/validation-error.formatter';
import { RequestValidationException } from '../errors/validation.exception';

// Extend Express Request interface to expose validatedData
declare global {
  namespace Express {
    interface Request {
      validatedData?: {
        body?: unknown;
        query?: unknown;
        params?: unknown;
        headers?: unknown;
      };
    }
  }
}

/**
 * Creates an Express / NestJS compatible validation middleware.
 * Validates request body, query, params, and headers against specified Zod schemas.
 */
export function createValidationMiddleware(options: ValidationMiddlewareOptions) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const allErrors: FormattedValidationError[] = [];
    const validatedData: Record<string, unknown> = {};

    const targets: ValidationTarget[] = ['body', 'query', 'params', 'headers'];

    for (const target of targets) {
      const schema = options[target];
      if (!schema) {
        continue;
      }

      const input = (req as any)[target] ?? {};

      try {
        const parsed = schema.parse(input);
        (req as any)[target] = parsed;
        validatedData[target] = parsed;
      } catch (error) {
        if (error instanceof ZodError) {
          const formatted = ValidationErrorFormatter.formatZodError(error).map((err) => ({
            ...err,
            field: target === 'body' ? err.field : `${target}.${err.field}`,
          }));

          allErrors.push(...formatted);

          if (options.abortEarly) {
            break;
          }
        } else {
          return next(error);
        }
      }
    }

    if (allErrors.length > 0) {
      const validationException = new RequestValidationException(
        allErrors,
        options.customErrorMessage,
      );
      return next(validationException);
    }

    req.validatedData = validatedData;
    next();
  };
}

/**
 * NestJS Middleware injectable class for request validation.
 */
@Injectable()
export class ValidationMiddleware implements NestMiddleware {
  private middlewareFn = createValidationMiddleware({});

  configure(options: ValidationMiddlewareOptions): this {
    this.middlewareFn = createValidationMiddleware(options);
    return this;
  }

  use(req: Request, res: Response, next: NextFunction): void {
    this.middlewareFn(req, res, next);
  }
}
