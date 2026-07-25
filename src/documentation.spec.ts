import { buildOpenApiDocument } from './docs/openapi';

describe('OpenAPI documentation', () => {
  it('creates an OpenAPI 3.0 document with documented endpoints', async () => {
    const app = {
      getHttpAdapter: () => ({
        getInstance: () => ({
          _router: {
            stack: [
              {
                route: {
                  path: '/',
                  methods: { get: true },
                },
              },
              {
                route: {
                  path: '/auth/status',
                  methods: { get: true },
                },
              },
            ],
          },
        }),
      }),
    };

    const document = await buildOpenApiDocument(app);

    expect(document.openapi).toBe('3.0.0');
    expect(document.info.title).toBe('AstraPort API');
    expect(document.info.version).toBe('1.0.0');
    expect(document.paths['/']).toBeDefined();
    expect(document.paths['/auth/status']).toBeDefined();
    expect(document.components.securitySchemes.bearer).toBeDefined();
  });
});
