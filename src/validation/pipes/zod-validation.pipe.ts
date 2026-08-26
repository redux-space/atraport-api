import {
  ArgumentMetadata,
  Injectable,
  Optional,
  PipeTransform,
} from '@nestjs/common';
import { ZodError, ZodSchema } from 'zod';
import { RequestValidationException } from '../errors/validation.exception';
import { ValidationErrorFormatter } from '../formatters/validation-error.formatter';
import { ValidationOptions } from '../interfaces/validation.interfaces';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(
    @Optional() private readonly schema?: ZodSchema<any>,
    @Optional() private readonly options: ValidationOptions = {},
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    const targetSchema = this.schema;

    if (!targetSchema) {
      return value;
    }

    try {
      const parsed = targetSchema.parse(value);
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = ValidationErrorFormatter.formatZodError(error);
        throw new RequestValidationException(
          formattedErrors,
          this.options.customErrorMessage,
        );
      }
      throw error;
    }
  }
}

/**
 * Factory helper function to create a new ZodValidationPipe.
 */
export const createZodValidationPipe = (
  schema: ZodSchema<any>,
  options?: ValidationOptions,
) => new ZodValidationPipe(schema, options);
