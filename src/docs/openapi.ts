import { ValidationSchemaRegistry, zodToOpenApiSchema } from '../validation';

interface OperationDefinition {
  method: string;
  path: string;
}

export async function buildOpenApiDocument(app: any) {
  const operations = collectOperations(app);
  const paths: Record<string, any> = {};

  for (const operation of operations) {
    const normalizedPath = normalizePath(operation.path);
    if (!normalizedPath || normalizedPath.startsWith('/docs')) {
      continue;
    }

    const method = operation.method.toLowerCase();
    const tag = getTag(normalizedPath);
    const summary = getSummary(method, normalizedPath);
    const description = getDescription(method, normalizedPath);
    const example = getExample(method, normalizedPath);

    // Look for route schema in ValidationSchemaRegistry
    const bodySchema = ValidationSchemaRegistry.getRouteSchema(method, normalizedPath, 'body');
    const openApiBodySchema = bodySchema ? zodToOpenApiSchema(bodySchema) : undefined;

    paths[normalizedPath] = paths[normalizedPath] || {};
    paths[normalizedPath][method] = {
      tags: [tag],
      summary,
      description,
      operationId: `${method}_${normalizedPath.replace(/[^a-zA-Z0-9]+/g, '_')}`,
      security: [{ bearer: [] }],
      responses: {
        '200': {
          description: 'Successful response',
          content: {
            'application/json': {
              example,
            },
          },
        },
        '400': {
          description: 'Validation failed or bad request',
          content: {
            'application/json': {
              schema: {
                $ref: '#/components/schemas/ValidationErrorResponse',
              },
            },
          },
        },
      },
      requestBody: getRequestBody(method, example, openApiBodySchema),
    };
  }

  const registeredSchemas = ValidationSchemaRegistry.getComponentsSchemas();

  const document = {
    openapi: '3.0.0',
    info: {
      title: 'AstraPort API',
      version: '1.0.0',
      description: 'Comprehensive API documentation for the AstraPort platform.',
    },
    servers: [{ url: process.env.API_BASE_URL || 'http://localhost:3000', description: 'Local development' }],
    tags: getTags(),
    paths,
    components: {
      securitySchemes: {
        bearer: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        ValidationErrorResponse: {
          type: 'object',
          properties: {
            statusCode: { type: 'number', example: 400 },
            error: { type: 'string', example: 'ValidationError' },
            message: { type: 'string', example: 'Validation failed (2 errors)' },
            code: { type: 'string', example: 'VALIDATION_ERROR' },
            correlationId: { type: 'string', example: 'corr-123456' },
            timestamp: { type: 'string', format: 'date-time' },
            path: { type: 'string', example: '/api/resource' },
            errors: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  field: { type: 'string', example: 'amount' },
                  message: { type: 'string', example: 'Amount must be at least 0' },
                  code: { type: 'string', example: 'too_small' },
                  path: { type: 'array', items: { type: 'string' } },
                },
              },
            },
          },
        },
        ...registeredSchemas,
      },
    },
    security: [{ bearer: [] }],
    'x-api-version': 'v1',
  };

  return document;
}

function collectOperations(app: any): OperationDefinition[] {
  const adapter = app?.getHttpAdapter?.();
  const instance = adapter?.getInstance?.() ?? adapter;
  const stack = instance?._router?.stack ?? [];
  const operations: OperationDefinition[] = [];

  const visit = (layers: any[]) => {
    for (const layer of layers) {
      if (layer.route) {
        const methods = Object.keys(layer.route.methods).filter((method) => layer.route.methods[method]);
        for (const method of methods) {
          operations.push({ method: method.toUpperCase(), path: layer.route.path });
        }
      }

      if (layer.handle?.stack) {
        visit(layer.handle.stack);
      }
    }
  };

  visit(stack);
  return operations;
}

function normalizePath(path: string) {
  if (!path) {
    return '/';
  }

  const normalized = path.startsWith('/') ? path : `/${path}`;
  return normalized.replace(/\/+/g, '/');
}

function getTag(path: string) {
  const segments = path.split('/').filter(Boolean);
  if (segments[0] === 'api') {
    return segments[1] || 'general';
  }
  return segments[0] || 'general';
}

function getTags() {
  return [
    { name: 'health', description: 'Health and status endpoints' },
    { name: 'auth', description: 'Authentication and session endpoints' },
    { name: 'portfolio', description: 'Portfolio operations' },
    { name: 'risk', description: 'Risk analytics endpoints' },
    { name: 'contracts', description: 'Contract management endpoints' },
    { name: 'ai-triggers', description: 'AI trigger management' },
    { name: 'ai-analysis', description: 'AI analysis and recommendations' },
    { name: 'rebalancing', description: 'Portfolio rebalancing operations' },
    { name: 'staking', description: 'Multi-asset staking operations' },
    { name: 'subscriptions', description: 'Event subscriptions and delivery' },
    { name: 'audit-logs', description: 'Audit log inspection and export' },
    { name: 'general', description: 'General endpoints' },
  ];
}

function getSummary(method: string, path: string) {
  const resourceName = describePath(path);
  return `${method.toUpperCase()} ${resourceName}`;
}

function getDescription(method: string, path: string) {
  const action = method === 'POST' ? 'Create or execute' : method === 'PUT' ? 'Update' : method === 'DELETE' ? 'Remove' : 'Retrieve';
  return `${action} the ${describePath(path)} resource.`;
}

function describePath(path: string) {
  const cleanPath = path.replace(/[:/]+/g, ' ').trim();
  return cleanPath || 'resource';
}

function getExample(method: string, path: string) {
  if (path.includes('status')) {
    return { status: 'ok', service: 'AstraPort API' };
  }

  if (method === 'POST') {
    return { success: true, message: 'Request accepted' };
  }

  if (method === 'DELETE') {
    return { success: true };
  }

  return { success: true, data: [] };
}

function getRequestBody(method: string, example: any, schemaOverride?: any) {
  if (method === 'POST' || method === 'PUT' || method === 'PATCH') {
    return {
      required: true,
      content: {
        'application/json': {
          schema: schemaOverride || {
            type: 'object',
            additionalProperties: true,
          },
          example,
        },
      },
    };
  }

  return undefined;
}
