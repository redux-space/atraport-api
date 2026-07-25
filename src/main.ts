import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { AppLoggerService } from './logging/services/app-logger.service';
import { ErrorTrackingService } from './logging/services/error-tracking.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    // Suppress NestJS's own bootstrap logs; our logger will take over
    bufferLogs: true,
  });

  // Replace the default NestJS logger with our structured Winston logger
  const logger = app.get(AppLoggerService);
  app.useLogger(logger);
  app.flushLogs();

  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
    forbidNonWhitelisted: true,
  }));

  app.enableCors();

  // ── Process-level safety nets ────────────────────────────────────────────────
  const errorTracking = app.get(ErrorTrackingService);

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.logError(error, { service: 'bootstrap', context: { event: 'unhandledRejection' } });
    errorTracking.captureException(error, { force: true });
  });

  process.on('uncaughtException', async (error: Error) => {
    logger.logError(error, { service: 'bootstrap', context: { event: 'uncaughtException' } });
    errorTracking.captureException(error, { force: true });
    await errorTracking.flush(2000);
    process.exit(1);
  });

  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  await app.listen(port);
  logger.info(`AstraPort API listening on http://localhost:${port}`, {
    service: 'bootstrap',
  });
}

bootstrap();
