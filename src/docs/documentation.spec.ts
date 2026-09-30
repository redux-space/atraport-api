import 'reflect-metadata';
import { MODULE_METADATA } from '@nestjs/common/constants';
import { AppModule } from '../app.module';
import { DocumentationModule } from './documentation.module';
import { DocumentationService } from './documentation.service';

describe('DocumentationModule & DocumentationService (#51)', () => {
  it('registers DocumentationModule inside AppModule imports', () => {
    const imports: unknown[] =
      Reflect.getMetadata(MODULE_METADATA.IMPORTS, AppModule) ?? [];
    expect(imports).toContain(DocumentationModule);
  });

  it('mounts /docs, /docs/json, and /docs/redoc and returns a valid OpenAPI document with known paths', async () => {
    const registeredRoutes = new Map<string, (req: any, res: any) => void>();

    const mockExpressInstance = {
      _router: {
        stack: [
          {
            route: {
              path: '/status',
              methods: { get: true },
            },
          },
          {
            route: {
              path: '/api/portfolio',
              methods: { get: true, post: true },
            },
          },
        ],
      },
    };

    const mockHttpAdapter = {
      getInstance: () => mockExpressInstance,
      get: jest.fn((path: string, handler: (req: any, res: any) => void) => {
        registeredRoutes.set(path, handler);
      }),
    };

    const mockApp = {
      getHttpAdapter: () => mockHttpAdapter,
    };

    const service = new DocumentationService();
    const document = await service.setup(mockApp);

    expect(document.openapi).toBe('3.0.3');
    expect(document.paths).toBeDefined();
    expect(document.paths['/status']).toBeDefined();
    expect(document.paths['/api/portfolio']).toBeDefined();

    expect(registeredRoutes.has('/docs')).toBe(true);
    expect(registeredRoutes.has('/docs/json')).toBe(true);
    expect(registeredRoutes.has('/docs/redoc')).toBe(true);

    let jsonPayload: any;
    registeredRoutes.get('/docs/json')?.(
      {},
      {
        json: (payload: any) => {
          jsonPayload = payload;
        },
      },
    );
    expect(jsonPayload).toEqual(document);
    expect(Object.keys(jsonPayload.paths)).toContain('/status');
  });
});
