import { Module } from "@nestjs/common";
import { SubscriptionModule } from "../subscriptions/subscription.module";
import { WebhookController } from "./webhook.controller";
import { WebhookService } from "./webhook.service";

@Module({
  imports: [SubscriptionModule],
  controllers: [WebhookController],
  providers: [WebhookService],
  exports: [WebhookService],
})
export class WebhookModule {}
