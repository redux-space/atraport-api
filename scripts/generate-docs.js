const { NestFactory } = require('@nestjs/core');
const { AppModule } = require('../dist/app.module');
const { DocumentationService } = require('../dist/docs/documentation.service');

async function main() {
  const app = await NestFactory.create(AppModule);
  const docsService = app.get(DocumentationService);
  await docsService.setup(app);
  await app.close();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
