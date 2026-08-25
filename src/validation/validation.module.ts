import { Module, Global } from '@nestjs/common';
import { ValidationErrorFormatter } from './formatters/validation-error.formatter';
import { ValidationSchemaRegistry } from './openapi/zod-to-openapi';
import { ZodValidationPipe } from './pipes/zod-validation.pipe';
import { ValidationMiddleware } from './middleware/validation.middleware';
import { FileValidationPipe, MultiFileValidationPipe } from './files/file-validation';

@Global()
@Module({
  providers: [
    ValidationErrorFormatter,
    ValidationSchemaRegistry,
    ZodValidationPipe,
    ValidationMiddleware,
    FileValidationPipe,
    MultiFileValidationPipe,
  ],
  exports: [
    ValidationErrorFormatter,
    ValidationSchemaRegistry,
    ZodValidationPipe,
    ValidationMiddleware,
    FileValidationPipe,
    MultiFileValidationPipe,
  ],
})
export class ValidationModule {}
