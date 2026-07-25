import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post } from "@nestjs/common";

import { WebhookService } from "./webhook.service";

@Controller("api/webhooks")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post("events")
  @HttpCode(HttpStatus.ACCEPTED)
  publishEvent(@Body() body: any) {
    return this.webhookService.publishAndDeliver(body);
  }

  @Get("events")
  getEventHistory() {
    return { events: this.webhookService.listEventHistory() };
  }

  @Post("test/:subscription_id")
  @HttpCode(HttpStatus.OK)
  testWebhook(@Param("subscription_id") subscriptionId: string, @Body() body: any) {
    return this.webhookService.simulateDelivery(subscriptionId, {
      type: body?.type ?? "portfolio.updated",
      severity: body?.severity,
      data: body?.data ?? { test: true },
      metadata: body?.metadata ?? {},
    });
  }

  @Post("retry-due")
  @HttpCode(HttpStatus.OK)
  retryDueDeliveries() {
    return this.webhookService.retryDueDeliveries();
  }

  @Post("verify-signature")
  @HttpCode(HttpStatus.OK)
  verifySignature(@Body() body: any) {
    return {
      valid: this.webhookService.verifySignature(body.signature, body.payload),
    };
  }

  @Get("dashboard")
  getDashboard() {
    return this.webhookService.getDashboard();
  }
}
