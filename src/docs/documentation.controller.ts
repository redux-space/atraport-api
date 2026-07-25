import { Controller, Get, Req, Res } from '@nestjs/common';
import { Request, Response } from 'express';
import { buildOpenApiDocument } from './openapi';
import { INestApplication } from '@nestjs/common';

@Controller('docs')
export class DocumentationController {
  constructor(private readonly app: INestApplication) {}

  @Get()
  async swaggerPage(@Res() res: Response) {
    res.type('html').send(`<!doctype html>
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
        window.ui = SwaggerUIBundle({
          url: '/docs/json',
          dom_id: '#swagger-ui',
        });
      };
    </script>
  </body>
</html>`);
  }

  @Get('json')
  async swaggerJson(@Req() req: Request) {
    return buildOpenApiDocument(this.app as any);
  }

  @Get('redoc')
  async redocPage(@Res() res: Response) {
    res.type('html').send(`<!doctype html>
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
</html>`);
  }
}
