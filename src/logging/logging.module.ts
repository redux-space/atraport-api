import { Global, MiddlewareConsumer, Module, NestModule, RequestMethod } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { AppLoggerService } from './services/app-logger.service';
import { ErrorTrackingService } from './services/error-tracking.service';
import { CorrelationIdMiddleware } from './middleware/correlation-id.middleware';
import { HttpLoggingInterceptor } from './interceptors/http-logging.interceptor';
import { GlobalExceptionFilter } from './filters/global-exception.filter';

/**
 * LoggingModule — registers everything globally.
 *
 * Mark this module as `@Global()` so that `AppLoggerService` and
 * `ErrorTrackingService` can be injected in any other module without
 * needing to re-import `LoggingModule`.
 */
@Global()
@Module({
  providers: [
    AppLoggerService,
    ErrorTrackingService,

    // Register the interceptor globally via APP_INTERCEPTOR token
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpLoggingInterceptor,
    },

    // Register the exception filter globally via APP_FILTER token
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
  exports: [AppLoggerService, ErrorTrackingService],
})
export class LoggingModule implements NestModule {
  /**
   * Apply the correlation-ID middleware to every route so every request gets
   * a tracing ID before any other code runs.
   */
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(CorrelationIdMiddleware)
      .forRoutes({ path: '*', method: RequestMethod.ALL });
  }
}
