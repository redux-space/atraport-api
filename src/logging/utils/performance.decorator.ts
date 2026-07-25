import { AppLoggerService } from '../services/app-logger.service';

/**
 * Method decorator that automatically measures and logs the execution time of
 * any class method (sync or async).
 *
 * Usage:
 * ```ts
 * @TrackPerformance()
 * async heavyOperation() { … }
 * ```
 *
 * Requires that the class has an `AppLoggerService` injected as `this.logger`.
 */
export function TrackPerformance(labelOverride?: string): MethodDecorator {
  return (
    target: object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ): PropertyDescriptor => {
    const originalMethod = descriptor.value as (...args: unknown[]) => unknown;
    const label = labelOverride ?? `${target.constructor.name}.${String(propertyKey)}`;

    descriptor.value = function (...args: unknown[]) {
      const logger: AppLoggerService | undefined = (this as any).logger;
      const start = Date.now();

      const logResult = (durationMs: number, success: boolean) => {
        if (logger) {
          logger.logPerformance(label, durationMs, {
            service: target.constructor.name,
            performance: { operation: label, durationMs },
            success,
          });
        }
      };

      const result = originalMethod.apply(this, args);

      if (result instanceof Promise) {
        return result.then(
          (value) => {
            logResult(Date.now() - start, true);
            return value;
          },
          (err: unknown) => {
            logResult(Date.now() - start, false);
            throw err;
          },
        );
      }

      logResult(Date.now() - start, true);
      return result;
    };

    return descriptor;
  };
}
