import {
  applyDecorators,
  Body,
  createParamDecorator,
  ExecutionContext,
  Param,
  Query,
  SetMetadata,
  UsePipes,
} from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from '../pipes/zod-validation.pipe';
import { ValidationOptions, ValidationTarget } from '../interfaces/validation.interfaces';

export const SCHEMA_METADATA_KEY = 'custom:zod_schema';

/**
 * Parameter decorator that validates and transforms the incoming request body using a Zod schema.
 *
 * @example
 * ```ts
 * @Post()
 * create(@ValidateBody(CreateUserSchema) dto: CreateUserDto) {
 *   return this.usersService.create(dto);
 * }
 * ```
 */
export function ValidateBody(schema: ZodSchema<any>, options?: ValidationOptions) {
  return Body(new ZodValidationPipe(schema, options));
}

/**
 * Parameter decorator that validates and transforms query parameters using a Zod schema.
 *
 * @example
 * ```ts
 * @Get()
 * findAll(@ValidateQuery(PaginationSchema) query: PaginationDto) {
 *   return this.usersService.findAll(query);
 * }
 * ```
 */
export function ValidateQuery(schema: ZodSchema<any>, options?: ValidationOptions) {
  return Query(new ZodValidationPipe(schema, options));
}

/**
 * Parameter decorator that validates and transforms route parameters using a Zod schema.
 *
 * @example
 * ```ts
 * @Get(':id')
 * findOne(@ValidateParams(IdParamSchema) params: { id: string }) {
 *   return this.usersService.findOne(params.id);
 * }
 * ```
 */
export function ValidateParams(schema: ZodSchema<any>, options?: ValidationOptions) {
  return Param(new ZodValidationPipe(schema, options));
}

/**
 * Parameter decorator that validates and transforms request headers using a Zod schema.
 */
export const ValidateHeaders = createParamDecorator(
  (schema: ZodSchema<any> | undefined, ctx: ExecutionContext) => {
    const req = ctx.switchToHttp().getRequest();
    const headers = req.headers || {};
    if (!schema) {
      return headers;
    }
    const pipe = new ZodValidationPipe(schema);
    return pipe.transform(headers, { type: 'custom' });
  },
);

/**
 * Method or class decorator that applies a Zod validation pipe and registers schema metadata.
 */
export function UseSchema(
  schema: ZodSchema<any>,
  target: ValidationTarget = 'body',
  options?: ValidationOptions,
) {
  return applyDecorators(
    SetMetadata(SCHEMA_METADATA_KEY, { schema, target }),
    UsePipes(new ZodValidationPipe(schema, options)),
  );
}
