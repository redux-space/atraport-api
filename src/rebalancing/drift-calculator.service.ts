import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WebhookService } from '../webhook/webhook.service';
import {
  AcknowledgeAlertDto,
  AssetAllocationDto,
  AssetDriftDto,
  DriftAlertDto,
  DriftAnalysisDto,
  DriftConfigRequestDto,
  DriftConfigResponseDto,
  DriftHistoryEntryDto,
  DriftStatusDto,
  DriftWebhookRegistrationDto,
  DriftWebhookResponseDto,
} from './dto/drift.dto';

/** In-memory store entry for drift configuration per portfolio */
interface DriftConfigStore {
  portfolioId: string;
  warningThreshold: number;
  criticalThreshold: number;
  webhookUrl?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

/** Registered webhook subscription */
interface WebhookSubscription {
  webhookId: string;
  portfolioId: string;
  webhookUrl: string;
  events: Array<'warning' | 'critical' | 'resolved'>;
  secret?: string;
  registeredAt: string;
}

@Injectable()
export class DriftCalculatorService {
  private readonly logger = new Logger(DriftCalculatorService.name);

  /** Drift config keyed by portfolioId */
  private readonly configs = new Map<string, DriftConfigStore>();

  /** Drift snapshot history keyed by portfolioId */
  private readonly history = new Map<string, DriftHistoryEntryDto[]>();

  /** Active alerts keyed by alertId */
  private readonly alerts = new Map<string, DriftAlertDto>();

  /** Webhook subscriptions keyed by portfolioId */
  private readonly webhooks = new Map<string, WebhookSubscription[]>();

  constructor(private readonly webhookService: WebhookService) {}

  // ─── Drift Calculation ───────────────────────────────────────────────────────

  /**
   * Calculates current drift metrics for a portfolio snapshot.
   * Persists the snapshot to history and fires alerts if thresholds are breached.
   */
  calculateDrift(portfolioId: string, assets: AssetAllocationDto[]): DriftStatusDto {
    const config = this.configs.get(portfolioId) ?? null;
    const warningThreshold = config?.warningThreshold ?? 0.05;
    const criticalThreshold = config?.criticalThreshold ?? 0.10;

    const totalValue = assets.reduce((sum, a) => sum + a.currentValue, 0);

    const assetDrifts: AssetDriftDto[] = assets.map((asset) => {
      const absoluteDrift = Math.abs(asset.currentWeight - asset.targetWeight);
      const relativeDrift =
        asset.targetWeight > 0
          ? Number((absoluteDrift / asset.targetWeight).toFixed(4))
          : 0;
      const driftValue = Number((absoluteDrift * totalValue).toFixed(4));

      let status: AssetDriftDto['status'] = 'on-target';
      if (absoluteDrift >= criticalThreshold) {
        status = 'critical';
      } else if (absoluteDrift >= warningThreshold) {
        status = 'warning';
      }

      return {
        symbol: asset.symbol,
        currentWeight: asset.currentWeight,
        targetWeight: asset.targetWeight,
        absoluteDrift: Number(absoluteDrift.toFixed(4)),
        relativeDrift,
        driftValue,
        status,
      };
    });

    const driftValues = assetDrifts.map((a) => a.absoluteDrift);
    const overallDrift =
      driftValues.length > 0
        ? Number((driftValues.reduce((s, v) => s + v, 0) / driftValues.length).toFixed(4))
        : 0;
    const maxDrift = driftValues.length > 0 ? Math.max(...driftValues) : 0;

    let portfolioStatus: DriftStatusDto['status'] = 'healthy';
    if (maxDrift >= criticalThreshold) {
      portfolioStatus = 'critical';
    } else if (maxDrift >= warningThreshold) {
      portfolioStatus = 'warning';
    }

    const snapshot: DriftStatusDto = {
      portfolioId,
      timestamp: new Date().toISOString(),
      overallDrift,
      maxDrift: Number(maxDrift.toFixed(4)),
      status: portfolioStatus,
      assets: assetDrifts,
      thresholds: config ? { warning: warningThreshold, critical: criticalThreshold } : null,
      rebalancingRecommended: portfolioStatus !== 'healthy',
    };

    this.persistSnapshot(portfolioId, snapshot);
    this.generateAlerts(portfolioId, snapshot, warningThreshold, criticalThreshold);

    return snapshot;
  }

  // ─── Config ──────────────────────────────────────────────────────────────────

  createConfig(dto: DriftConfigRequestDto): DriftConfigResponseDto {
    const now = new Date().toISOString();
    const entry: DriftConfigStore = {
      portfolioId: dto.portfolioId,
      warningThreshold: dto.warningThreshold,
      criticalThreshold: dto.criticalThreshold,
      webhookUrl: dto.webhookUrl,
      enabled: dto.enabled,
      createdAt: now,
      updatedAt: now,
    };
    this.configs.set(dto.portfolioId, entry);
    this.logger.log(`Drift config created for portfolio ${dto.portfolioId}`);
    return this.toConfigResponse(entry);
  }

  updateConfig(portfolioId: string, dto: Partial<DriftConfigRequestDto>): DriftConfigResponseDto {
    const existing = this.configs.get(portfolioId);
    if (!existing) {
      throw new NotFoundException(`Drift config not found for portfolio ${portfolioId}`);
    }

    const updated: DriftConfigStore = {
      ...existing,
      ...(dto.warningThreshold !== undefined && { warningThreshold: dto.warningThreshold }),
      ...(dto.criticalThreshold !== undefined && { criticalThreshold: dto.criticalThreshold }),
      ...(dto.webhookUrl !== undefined && { webhookUrl: dto.webhookUrl }),
      ...(dto.enabled !== undefined && { enabled: dto.enabled }),
      updatedAt: new Date().toISOString(),
    };
    this.configs.set(portfolioId, updated);
    this.logger.log(`Drift config updated for portfolio ${portfolioId}`);
    return this.toConfigResponse(updated);
  }

  // ─── History ─────────────────────────────────────────────────────────────────

  getHistory(portfolioId: string, limit = 100): DriftHistoryEntryDto[] {
    const entries = this.history.get(portfolioId) ?? [];
    return entries.slice(-limit).reverse();
  }

  // ─── Alerts ──────────────────────────────────────────────────────────────────

  getActiveAlerts(portfolioId?: string): DriftAlertDto[] {
    const all = Array.from(this.alerts.values()).filter((a) => !a.acknowledged);
    return portfolioId ? all.filter((a) => a.portfolioId === portfolioId) : all;
  }

  acknowledgeAlert(alertId: string, dto: AcknowledgeAlertDto): DriftAlertDto {
    const alert = this.alerts.get(alertId);
    if (!alert) {
      throw new NotFoundException(`Alert ${alertId} not found`);
    }
    alert.acknowledged = true;
    alert.acknowledgedAt = new Date().toISOString();
    alert.acknowledgedBy = dto.acknowledgedBy ?? 'system';
    this.alerts.set(alertId, alert);
    this.logger.log(`Alert ${alertId} acknowledged by ${alert.acknowledgedBy}`);
    return alert;
  }

  // ─── Analysis ────────────────────────────────────────────────────────────────

  analysePortfolio(portfolioId: string, assets: AssetAllocationDto[], periodDays = 30): DriftAnalysisDto {
    const currentStatus = this.calculateDrift(portfolioId, assets);
    const history = this.getHistory(portfolioId, periodDays * 24); // rough upper bound

    const driftValues = history.map((h) => h.overallDrift);
    const averageDrift =
      driftValues.length > 0
        ? Number((driftValues.reduce((s, v) => s + v, 0) / driftValues.length).toFixed(4))
        : currentStatus.overallDrift;
    const peakDrift = driftValues.length > 0 ? Math.max(...driftValues) : currentStatus.maxDrift;

    // Simple linear trend: compare last quarter to first quarter of history
    const driftTrend = this.calculateTrend(driftValues);

    const mostDrifted =
      currentStatus.assets.length > 0
        ? currentStatus.assets.reduce((prev, curr) =>
            curr.absoluteDrift > prev.absoluteDrift ? curr : prev,
          ).symbol
        : null;

    // Rough projection: if trend is positive and we know thresholds
    const config = this.configs.get(portfolioId);
    const criticalThreshold = config?.criticalThreshold ?? 0.10;
    const projectedBreachDays = this.projectBreachDays(
      currentStatus.overallDrift,
      driftTrend,
      criticalThreshold,
    );

    const recommendation = this.buildRecommendation(currentStatus, driftTrend, projectedBreachDays);

    return {
      portfolioId,
      analysisTimestamp: new Date().toISOString(),
      analysisPeriodDays: periodDays,
      currentStatus,
      averageDrift,
      peakDrift: Number(peakDrift.toFixed(4)),
      driftTrend: Number(driftTrend.toFixed(4)),
      mostDriftedAsset: mostDrifted,
      lastRebalancedAt: null, // would be sourced from execution history in a full impl
      projectedBreachDays,
      recommendation,
      history,
    };
  }

  // ─── Webhooks ────────────────────────────────────────────────────────────────

  registerWebhook(dto: DriftWebhookRegistrationDto): DriftWebhookResponseDto {
    const webhookId = `dwh-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const subscription: WebhookSubscription = {
      webhookId,
      portfolioId: dto.portfolioId,
      webhookUrl: dto.webhookUrl,
      events: dto.events,
      secret: dto.secret,
      registeredAt: new Date().toISOString(),
    };

    const existing = this.webhooks.get(dto.portfolioId) ?? [];
    this.webhooks.set(dto.portfolioId, [...existing, subscription]);
    this.logger.log(`Webhook registered for portfolio ${dto.portfolioId}: ${dto.webhookUrl}`);

    return {
      webhookId,
      portfolioId: dto.portfolioId,
      webhookUrl: dto.webhookUrl,
      events: dto.events,
      registeredAt: subscription.registeredAt,
    };
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  private persistSnapshot(portfolioId: string, snapshot: DriftStatusDto): void {
    const entry: DriftHistoryEntryDto = {
      snapshotId: `snap-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      portfolioId,
      timestamp: snapshot.timestamp,
      overallDrift: snapshot.overallDrift,
      maxDrift: snapshot.maxDrift,
      status: snapshot.status,
      assetCount: snapshot.assets.length,
      assetsInBreach: snapshot.assets.filter((a) => a.status !== 'on-target').length,
    };

    const existing = this.history.get(portfolioId) ?? [];
    // Keep last 1000 snapshots per portfolio
    this.history.set(portfolioId, [...existing, entry].slice(-1000));
  }

  private generateAlerts(
    portfolioId: string,
    snapshot: DriftStatusDto,
    warningThreshold: number,
    criticalThreshold: number,
  ): void {
    snapshot.assets.forEach((asset) => {
      if (asset.status === 'on-target') return;

      const severity = asset.status as 'warning' | 'critical';
      const threshold = severity === 'critical' ? criticalThreshold : warningThreshold;

      // Avoid duplicate unacknowledged alerts for the same asset + severity
      const duplicate = Array.from(this.alerts.values()).find(
        (a) =>
          a.portfolioId === portfolioId &&
          a.affectedAsset === asset.symbol &&
          a.severity === severity &&
          !a.acknowledged,
      );
      if (duplicate) return;

      const alert: DriftAlertDto = {
        alertId: `alert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        portfolioId,
        severity,
        affectedAsset: asset.symbol,
        currentDrift: asset.absoluteDrift,
        threshold,
        message: `${asset.symbol} has drifted ${(asset.absoluteDrift * 100).toFixed(2)}% from its target (threshold: ${(threshold * 100).toFixed(2)}%)`,
        triggeredAt: snapshot.timestamp,
        acknowledged: false,
      };

      this.alerts.set(alert.alertId, alert);
      this.logger.warn(`[${severity.toUpperCase()}] Drift alert: ${alert.message}`);
      this.dispatchWebhookNotifications(portfolioId, severity, alert);
    });
  }

  private dispatchWebhookNotifications(
    portfolioId: string,
    event: 'warning' | 'critical' | 'resolved',
    alert: DriftAlertDto,
  ): void {
    const subscriptions = this.webhooks.get(portfolioId) ?? [];
    subscriptions
      .filter((s) => s.events.includes(event))
      .forEach((s) => {
        this.webhookService
          .sendWebhook(s.webhookUrl, { event, alert })
          .catch((err) => this.logger.error(`Failed to dispatch webhook: ${err.message}`));
      });
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 4) return 0;
    const half = Math.floor(values.length / 2);
    const firstHalfAvg = values.slice(0, half).reduce((s, v) => s + v, 0) / half;
    const secondHalfAvg = values.slice(half).reduce((s, v) => s + v, 0) / (values.length - half);
    return secondHalfAvg - firstHalfAvg;
  }

  private projectBreachDays(
    currentDrift: number,
    trendPerSnapshot: number,
    criticalThreshold: number,
  ): number | null {
    if (currentDrift >= criticalThreshold) return null; // already breached
    if (trendPerSnapshot <= 0) return null; // converging or stable
    const remaining = criticalThreshold - currentDrift;
    // Each snapshot ≈ a few minutes in practice; we express projection in days loosely
    const snapshotsToBreachEstimate = Math.ceil(remaining / trendPerSnapshot);
    // Assume roughly 24 snapshots/day as a rough heuristic
    return Math.max(1, Math.round(snapshotsToBreachEstimate / 24));
  }

  private buildRecommendation(
    status: DriftStatusDto,
    trend: number,
    projectedBreachDays: number | null,
  ): string {
    if (status.status === 'critical') {
      return 'Immediate rebalancing required — one or more assets have exceeded the critical drift threshold.';
    }
    if (status.status === 'warning') {
      return projectedBreachDays !== null
        ? `Rebalancing recommended soon — at the current drift rate, critical threshold may be reached in ~${projectedBreachDays} day(s).`
        : 'Rebalancing recommended — portfolio drift is approaching critical levels.';
    }
    if (trend > 0.005) {
      return 'Portfolio is healthy but drift is increasing. Monitor closely and consider pre-emptive rebalancing.';
    }
    return 'Portfolio drift is within acceptable bounds. No action required.';
  }

  private toConfigResponse(entry: DriftConfigStore): DriftConfigResponseDto {
    return {
      portfolioId: entry.portfolioId,
      warningThreshold: entry.warningThreshold,
      criticalThreshold: entry.criticalThreshold,
      webhookUrl: entry.webhookUrl,
      enabled: entry.enabled,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}
