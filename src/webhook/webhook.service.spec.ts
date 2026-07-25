import { DeliveryOutcome } from "../subscriptions/dto/delivery-status.dto";
import { EventSeverity } from "../subscriptions/dto/event-filter.dto";
import { SubscriptionService } from "../subscriptions/subscription.service";
import { WebhookService } from "./webhook.service";

describe("WebhookService", () => {
  function makeServices() {
    const subscriptionService = new SubscriptionService();
    const webhookService = new WebhookService(subscriptionService);
    return { subscriptionService, webhookService };
  }

  it("signs and verifies payloads with HMAC", () => {
    const { webhookService } = makeServices();
    const payload = { type: "portfolio.updated", data: { portfolioId: "p1" } };
    const signature = webhookService.signPayload(payload);

    expect(signature).toHaveLength(64);
    expect(webhookService.verifySignature(signature, payload)).toBe(true);
    expect(webhookService.verifySignature(signature, { type: "portfolio.deleted" })).toBe(false);
  });

  it("publishes only to subscriptions whose filters match", async () => {
    const { subscriptionService, webhookService } = makeServices();
    const matching = subscriptionService.createSubscription("user-a", {
      name: "Risk alerts",
      filter: {
        eventTypes: ["risk.threshold_breached"],
        minSeverity: EventSeverity.HIGH,
        customPredicates: { portfolioId: "p1" },
      },
    });
    subscriptionService.createSubscription("user-a", {
      name: "Portfolio updates",
      filter: { eventTypes: ["portfolio.updated"] },
    });

    const result = await webhookService.publishAndDeliver({
      type: "risk.threshold_breached",
      severity: EventSeverity.CRITICAL,
      data: { score: 92 },
      metadata: { portfolioId: "p1" },
    });

    expect(result.deliveries).toHaveLength(1);
    expect(result.deliveries[0].subscriptionId).toBe(matching.id);
    expect(result.deliveries[0].outcome).toBe(DeliveryOutcome.DELIVERED);
  });

  it("tracks failed webhook deliveries as retrying with exponential backoff", async () => {
    const { subscriptionService, webhookService } = makeServices();
    const subscription = subscriptionService.createSubscription("user-a", {
      name: "Webhook",
      filter: { eventTypes: ["portfolio.updated"] },
      callbackUrl: "https://example.invalid/webhook",
    });
    jest.spyOn(webhookService, "sendWebhook").mockResolvedValue({ ok: false, statusCode: 500 });

    const result = await webhookService.publishAndDeliver({
      type: "portfolio.updated",
      metadata: {},
    });

    expect(result.deliveries[0].outcome).toBe(DeliveryOutcome.RETRYING);
    expect(result.deliveries[0].nextRetryAt).not.toBeNull();

    const status = subscriptionService.getDeliveryStatus("user-a", subscription.id);
    expect(status.summary.retrying).toBe(1);
  });

  it("retries due failed deliveries from event history", async () => {
    const { subscriptionService, webhookService } = makeServices();
    subscriptionService.createSubscription("user-a", {
      name: "Webhook",
      filter: { eventTypes: ["portfolio.updated"] },
      callbackUrl: "https://example.invalid/webhook",
    });
    const sendWebhook = jest
      .spyOn(webhookService, "sendWebhook")
      .mockResolvedValueOnce({ ok: false, statusCode: 500 })
      .mockResolvedValueOnce({ ok: true, statusCode: 200 });

    await webhookService.publishAndDeliver({ type: "portfolio.updated" });
    const retried = await webhookService.retryDueDeliveries(
      new Date(Date.now() + 2_000),
    );

    expect(sendWebhook).toHaveBeenCalledTimes(2);
    expect(retried).toHaveLength(1);
    expect(retried[0].outcome).toBe(DeliveryOutcome.DELIVERED);
    expect(retried[0].attemptCount).toBe(2);
  });

  it("exposes event history and dashboard metrics", async () => {
    const { subscriptionService, webhookService } = makeServices();
    subscriptionService.createSubscription("user-a", {
      name: "All portfolio updates",
      filter: { eventTypes: ["portfolio.updated"] },
    });

    await webhookService.publishAndDeliver({ type: "portfolio.updated" });

    expect(webhookService.listEventHistory()).toHaveLength(1);
    expect(webhookService.getDashboard()).toMatchObject({
      subscriptions: { total: 1, active: 1 },
      events: { total: 1 },
      deliveries: { total: 1, delivered: 1 },
    });
  });
});
