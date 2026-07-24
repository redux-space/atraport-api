import { Module } from '@nestjs/common';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

/**
 * SubscriptionModule wires together the subscription controller and service.
 * The service currently uses an in-memory store; swap out the provider for a
 * TypeORM-backed implementation when a database connection is available.
 */
@Module({
  controllers: [SubscriptionController],
  providers: [SubscriptionService],
  exports: [SubscriptionService],
})
export class SubscriptionModule {}
