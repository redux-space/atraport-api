import { Injectable, SetMetadata } from '@nestjs/common';
import { z, ZodTypeAny, ZodObject, ZodArray, ZodString, ZodNumber, ZodBoolean, ZodEnum, ZodUnion, ZodOptional, ZodNullable, ZodDefault, ZodEffects, ZodLiteral, ZodNativeEnum, ZodRecord, ZodDate } from 'zod';

export interface OpenApiSchemaObject {
  type?: string;
  format?: string;
  description?: string;
  example?: unknown;
  default?: unknown;
  nullable?: boolean;
  enum?: unknown[];
  properties?: Record<string, OpenApiSchemaObject>;
  required?: string[];
  items?: OpenApiSchemaObject;
  oneOf?: OpenApiSchemaObject[];
  anyOf?: OpenApiSchemaObject[];
  additionalProperties?: boolean | OpenApiSchemaObject;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  [key: string]: unknown;
}

/**
 * Converts a Zod schema into an OpenAPI 3.0 compatible JSON Schema object.
 */
export function zodToOpenApiSchema(schema: ZodTypeAny): OpenApiSchemaObject {
  if (!schema) {
    return { type: 'object' };
  }

  const def = (schema as any)._def;
  const description = (schema as any).description;

  // Handle unwrappers (Optional, Nullable, Default, Effects/Refinements)
  if (schema instanceof ZodOptional) {
    return zodToOpenApiSchema(def.innerType);
  }

  if (schema instanceof ZodNullable) {
    const inner = zodToOpenApiSchema(def.innerType);
    return { ...inner, nullable: true };
  }

  if (schema instanceof ZodDefault) {
    const inner = zodToOpenApiSchema(def.innerType);
    return { ...inner, default: def.defaultValue() };
  }

  if (schema instanceof ZodEffects) {
    const inner = zodToOpenApiSchema(def.schema);
    if (description) inner.description = description;
    return inner;
  }

  // Primitives
  if (schema instanceof ZodString) {
    const res: OpenApiSchemaObject = { type: 'string' };
    if (description) res.description = description;

    for (const check of def.checks || []) {
      if (check.kind === 'min') res.minLength = check.value;
      if (check.kind === 'max') res.maxLength = check.value;
      if (check.kind === 'regex') res.pattern = check.regex.source;
      if (check.kind === 'email') res.format = 'email';
      if (check.kind === 'url') res.format = 'uri';
      if (check.kind === 'uuid') res.format = 'uuid';
      if (check.kind === 'datetime') res.format = 'date-time';
    }
    return res;
  }

  if (schema instanceof ZodNumber) {
    const res: OpenApiSchemaObject = { type: 'number' };
    if (description) res.description = description;

    for (const check of def.checks || []) {
      if (check.kind === 'min') res.minimum = check.value;
      if (check.kind === 'max') res.maximum = check.value;
      if (check.kind === 'int') res.type = 'integer';
    }
    return res;
  }

  if (schema instanceof ZodBoolean) {
    const res: OpenApiSchemaObject = { type: 'boolean' };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodDate) {
    const res: OpenApiSchemaObject = { type: 'string', format: 'date-time' };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodEnum) {
    const res: OpenApiSchemaObject = {
      type: 'string',
      enum: def.values,
    };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodNativeEnum) {
    const values = Object.values(def.values);
    const res: OpenApiSchemaObject = {
      type: typeof values[0] === 'number' ? 'number' : 'string',
      enum: values,
    };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodLiteral) {
    const val = def.value;
    const res: OpenApiSchemaObject = {
      type: typeof val,
      enum: [val],
    };
    if (description) res.description = description;
    return res;
  }

  // Composite structures
  if (schema instanceof ZodArray) {
    const res: OpenApiSchemaObject = {
      type: 'array',
      items: zodToOpenApiSchema(def.type),
    };
    if (description) res.description = description;
    if (def.minLength) res.minItems = def.minLength.value;
    if (def.maxLength) res.maxItems = def.maxLength.value;
    return res;
  }

  if (schema instanceof ZodObject) {
    const properties: Record<string, OpenApiSchemaObject> = {};
    const required: string[] = [];
    const shape = def.shape();

    for (const [key, propSchema] of Object.entries(shape)) {
      properties[key] = zodToOpenApiSchema(propSchema as ZodTypeAny);
      if (!(propSchema instanceof ZodOptional) && !(propSchema instanceof ZodDefault)) {
        required.push(key);
      }
    }

    const res: OpenApiSchemaObject = {
      type: 'object',
      properties,
      required: required.length > 0 ? required : undefined,
    };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodRecord) {
    const res: OpenApiSchemaObject = {
      type: 'object',
      additionalProperties: zodToOpenApiSchema(def.valueType),
    };
    if (description) res.description = description;
    return res;
  }

  if (schema instanceof ZodUnion) {
    const options = (def.options as ZodTypeAny[]).map((opt) => zodToOpenApiSchema(opt));
    const res: OpenApiSchemaObject = {
      oneOf: options,
    };
    if (description) res.description = description;
    return res;
  }

  return { type: 'object', description: description || undefined };
}

export const OPENAPI_SCHEMA_METADATA_KEY = 'custom:openapi_schema';

export interface ApiSchemaOptions {
  name: string;
  description?: string;
  target?: 'body' | 'query' | 'params' | 'response';
  statusCode?: number;
}

/**
 * Decorator to attach an OpenAPI schema metadata to a controller method.
 */
export function ApiSchema(schema: ZodTypeAny, options?: Partial<ApiSchemaOptions>) {
  return SetMetadata(OPENAPI_SCHEMA_METADATA_KEY, { schema, options });
}

/**
 * Global registry for Zod schemas to be exposed in OpenAPI documentation.
 */
@Injectable()
export class ValidationSchemaRegistry {
  private static registeredSchemas = new Map<string, ZodTypeAny>();
  private static routeSchemas = new Map<string, { target: string; schema: ZodTypeAny }>();

  /**
   * Register a named schema for the OpenAPI components.schemas dictionary.
   */
  static registerSchema(name: string, schema: ZodTypeAny): void {
    this.registeredSchemas.set(name, schema);
  }

  /**
   * Register a route-specific schema.
   */
  static registerRouteSchema(method: string, path: string, target: string, schema: ZodTypeAny): void {
    const key = `${method.toUpperCase()}:${path}:${target}`;
    this.routeSchemas.set(key, { target, schema });
  }

  /**
   * Get all schemas formatted for OpenAPI components.schemas.
   */
  static getComponentsSchemas(): Record<string, OpenApiSchemaObject> {
    const schemas: Record<string, OpenApiSchemaObject> = {};
    for (const [name, schema] of this.registeredSchemas.entries()) {
      schemas[name] = zodToOpenApiSchema(schema);
    }
    return schemas;
  }

  /**
   * Find a route schema if registered.
   */
  static getRouteSchema(method: string, path: string, target: string): ZodTypeAny | undefined {
    const key = `${method.toUpperCase()}:${path}:${target}`;
    return this.routeSchemas.get(key)?.schema;
  }

  registerSchema(name: string, schema: ZodTypeAny): void {
    ValidationSchemaRegistry.registerSchema(name, schema);
  }

  getComponentsSchemas(): Record<string, OpenApiSchemaObject> {
    return ValidationSchemaRegistry.getComponentsSchemas();
  }
}
