import { Injectable } from '@nestjs/common';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { buildOpenApiDocument } from './openapi';

@Injectable()
export class DocumentationService {
  async setup(app: any) {
    const document = await buildOpenApiDocument(app);

    const sdkPath = join(process.cwd(), 'generated-client.ts');
    writeFileSync(sdkPath, this.renderClientSdk(document));

    const httpAdapter = app.getHttpAdapter();
    httpAdapter.get('/docs', (_req: any, res: any) => {
      res.type('html').send(this.renderSwaggerPage());
    });
    httpAdapter.get('/docs/json', (_req: any, res: any) => {
      res.json(document);
    });
    httpAdapter.get('/docs/redoc', (_req: any, res: any) => {
      res.type('html').send(this.renderRedocPage());
    });

    return document;
  }

  private renderSwaggerPage() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AstraPort API Docs</title>
    <link rel="stylesheet" href="https://unpkg.com/swagger-ui-dist@5.17.2/swagger-ui.css" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.17.2/swagger-ui-bundle.js"></script>
    <script>
      window.onload = () => {
        window.ui = SwaggerUIBundle({ url: '/docs/json', dom_id: '#swagger-ui' });
      };
    </script>
  </body>
</html>`;
  }

  private renderRedocPage() {
    return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>AstraPort API ReDoc</title>
    <script src="https://unpkg.com/redoc@2.4.0/bundles/redoc.standalone.js"></script>
  </head>
  <body>
    <redoc spec-url="/docs/json"></redoc>
  </body>
</html>`;
  }

  private renderClientSdk(document: any) {
    const endpointNames = Object.entries(document.paths || {})
      .flatMap(([path, methods]: any) => Object.keys(methods || {}).map((method) => `${method.toUpperCase()} ${path}`))
      .slice(0, 20);

    const methods = endpointNames
      .map((endpoint, index) => {
        const name = endpoint.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || `endpoint_${index + 1}`;
        return `  async ${name}() { return this.request('${endpoint.split(' ')[0]}', '${endpoint.split(' ').slice(1).join(' ')}'); }`;
      })
      .join('\n');

    return `export class AstraPortClient {
  constructor(private readonly baseUrl = 'http://localhost:3000') {}

  private async request(method: string, path: string) {
    const response = await fetch(\`${'${'}this.baseUrl\}${'${'}path\`}\`, { method });
    return response.json();
  }

${methods}
}`;
  }
}
