import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";
import { v4 as uuidv4 } from "uuid";

import { DeliveryOutcome } from "../subscriptions/dto/delivery-status.dto";
import { EventSeverity } from "../subscriptions/dto/event-filter.dto";
import { SubscriptionDto } from "../subscriptions/dto/subscription.dto";
import { SubscriptionService } from "../subscriptions/subscription.service";

export interface WebhookEvent {
  id: string;
  type: string;
  severity: EventSeverity;
  data: Record<string, unknown>;
  metadata: Record<string, string>;
  occurredAt: string;
}

export interface PublishEventInput {
  type: string;
  severity?: EventSeverity;
  data?: Record<string, unknown>;
  metadata?: Record<string, string>;
}

export interface WebhookDeliveryResult {
  eventId: string;
  subscriptionId: string;
  callbackUrl: string | null;
  outcome: DeliveryOutcome;
  attemptCount: number;
  nextRetryAt: string | null;
  signature: string;
}

interface DeliveryTransportResult {
  ok: boolean;
  statusCode?: number;
  error?: string;
}

const DEFAULT_SECRET = "development-webhook-secret";

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);
  private readonly eventHistory: WebhookEvent[] = [];

  constructor(private readonly subscriptionService: SubscriptionService) {}

  publishEvent(input: PublishEventInput): WebhookEvent {
    const event: WebhookEvent = {
      id: uuidv4(),
      type: input.type,
      severity: input.severity ?? EventSeverity.LOW,
      data: input.data ?? {},
      metadata: input.metadata ?? {},
      occurredAt: new Date().toISOString(),
    };

    this.eventHistory.unshift(event);
    return event;
  }

  async publishAndDeliver(input: PublishEventInput): Promise<{
    event: WebhookEvent;
    deliveries: WebhookDeliveryResult[];
  }> {
    const event = this.publishEvent(input);
    const deliveries: WebhookDeliveryResult[] = [];

    for (const subscription of this.subscriptionService.listActiveSubscriptions()) {
      if (!this.subscriptionService.matchesFilter(subscription.filter, event)) {
        continue;
      }

      deliveries.push(await this.deliverToSubscription(subscription, event));
    }

    return { event, deliveries };
  }

  async simulateDelivery(
    subscriptionId: string,
    input: PublishEventInput,
  ): Promise<WebhookDeliveryResult> {
    const event = this.publishEvent(input);
    const subscription = this.subscriptionService.getSubscriptionById(subscriptionId);
    return this.deliverToSubscription(subscription, event, true);
  }

  async retryDueDeliveries(now = new Date()): Promise<WebhookDeliveryResult[]> {
    const results: WebhookDeliveryResult[] = [];

    for (const record of this.subscriptionService.listDeliveryRecords()) {
      if (
        record.outcome !== DeliveryOutcome.RETRYING ||
        !record.nextRetryAt ||
        new Date(record.nextRetryAt).getTime() > now.getTime() ||
        !record.subscriptionId
      ) {
        continue;
      }

      const event = this.eventHistory.find((item) => item.id === record.eventId);
      if (!event) {
        continue;
      }

      const subscription = this.subscriptionService.getSubscriptionById(record.subscriptionId);
      results.push(await this.deliverToSubscription(subscription, event));
    }

    return results;
  }

  listEventHistory(): WebhookEvent[] {
    return [...this.eventHistory];
  }

  getDashboard() {
    const subscriptions = this.subscriptionService.listAllSubscriptions();
    const deliveryRecords = this.subscriptionService.listDeliveryRecords();

    return {
      subscriptions: {
        total: subscriptions.length,
        active: subscriptions.filter((sub) => sub.active).length,
      },
      events: {
        total: this.eventHistory.length,
        recent: this.eventHistory.slice(0, 10),
      },
      deliveries: {
        total: deliveryRecords.length,
        delivered: deliveryRecords.filter((record) => record.outcome === DeliveryOutcome.DELIVERED).length,
        retrying: deliveryRecords.filter((record) => record.outcome === DeliveryOutcome.RETRYING).length,
        failed: deliveryRecords.filter((record) => record.outcome === DeliveryOutcome.FAILED).length,
      },
      retryQueue: deliveryRecords
        .filter((record) => record.outcome === DeliveryOutcome.RETRYING)
        .map((record) => ({
          eventId: record.eventId,
          subscriptionId: record.subscriptionId,
          attemptCount: record.attemptCount,
          nextRetryAt: record.nextRetryAt,
        })),
    };
  }

  signPayload(payload: unknown): string {
    return this.generateSignature(this.serializePayload(payload));
  }

  verifySignature(signature: string, payload: unknown): boolean {
    const expectedSignature = this.signPayload(payload);
    if (signature.length !== expectedSignature.length) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature),
    );
  }

  async sendWebhook(url: string, data: any): Promise<DeliveryTransportResult> {
    const signature = this.signPayload(data);
    try {
      if (typeof fetch !== "function") {
        this.logger.warn("Global fetch is unavailable; webhook delivery simulated");
        return { ok: true, statusCode: 202 };
      }

      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-webhook-signature": signature,
          "x-webhook-signature-algorithm": "hmac-sha256",
        },
        body: this.serializePayload(data),
      });

      return { ok: response.ok, statusCode: response.status };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Failed to send webhook to ${url}: ${message}`);
      return { ok: false, error: message };
    }
  }

  validateSignature(signature: string, data: any): boolean {
    return this.verifySignature(signature, data);
  }

  private async deliverToSubscription(
    subscription: SubscriptionDto,
    event: WebhookEvent,
    forceSimulation = false,
  ): Promise<WebhookDeliveryResult> {
    const envelope = {
      id: event.id,
      type: event.type,
      severity: event.severity,
      occurredAt: event.occurredAt,
      data: event.data,
      metadata: event.metadata,
    };
    const signature = this.signPayload(envelope);
    let outcome = DeliveryOutcome.DELIVERED;

    if (!forceSimulation && subscription.callbackUrl) {
      const result = await this.sendWebhook(subscription.callbackUrl, envelope);
      outcome = result.ok ? DeliveryOutcome.DELIVERED : DeliveryOutcome.RETRYING;
    }

    const record = this.subscriptionService.recordDeliveryAttempt(
      subscription.id,
      event.id,
      outcome,
    );

    return {
      eventId: event.id,
      subscriptionId: subscription.id,
      callbackUrl: subscription.callbackUrl,
      outcome: record.outcome,
      attemptCount: record.attemptCount,
      nextRetryAt: record.nextRetryAt,
      signature,
    };
  }

  private serializePayload(payload: unknown): string {
    return typeof payload === "string" ? payload : JSON.stringify(payload);
  }

  private generateSignature(data: string): string {
    return crypto
      .createHmac("sha256", process.env.WEBHOOK_SECRET ?? DEFAULT_SECRET)
      .update(data)
      .digest("hex");
  }
}
