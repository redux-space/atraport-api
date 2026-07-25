// ─── Request DTOs ─────────────────────────────────────────────────────────────

export class AssetAllocationDto {
  /** Asset symbol, e.g. "BTC" */
  symbol: string;
  /** Current portfolio weight as a decimal (e.g. 0.35 for 35%) */
  currentWeight: number;
  /** Target portfolio weight as a decimal */
  targetWeight: number;
  /** Current market value in base currency */
  currentValue: number;
}

export class DriftConfigRequestDto {
  portfolioId: string;
  /** Maximum allowed absolute drift before a warning alert is raised (e.g. 0.05 = 5%) */
  warningThreshold: number;
  /** Maximum allowed absolute drift before a critical alert is raised (e.g. 0.10 = 10%) */
  criticalThreshold: number;
  /** Optional URL to receive webhook notifications when thresholds are breached */
  webhookUrl?: string;
  /** Whether drift monitoring is active for this portfolio */
  enabled: boolean;
}

export class DriftStatusRequestDto {
  portfolioId: string;
  assets: AssetAllocationDto[];
}

export class DriftWebhookRegistrationDto {
  portfolioId: string;
  webhookUrl: string;
  /** Events to subscribe to: 'warning' | 'critical' | 'resolved' */
  events: Array<'warning' | 'critical' | 'resolved'>;
  /** Optional HMAC secret override; uses global WEBHOOK_SECRET if omitted */
  secret?: string;
}

// ─── Response DTOs ─────────────────────────────────────────────────────────────

export class AssetDriftDto {
  symbol: string;
  currentWeight: number;
  targetWeight: number;
  /** Absolute drift: |current - target| */
  absoluteDrift: number;
  /** Relative drift: |current - target| / target */
  relativeDrift: number;
  /** Dollar value that needs to be traded to restore target weight */
  driftValue: number;
  status: 'on-target' | 'warning' | 'critical';
}

export class DriftStatusDto {
  portfolioId: string;
  /** Timestamp of this snapshot */
  timestamp: string;
  /** Mean absolute deviation across all assets */
  overallDrift: number;
  /** Highest single-asset drift */
  maxDrift: number;
  /** Portfolio-level status derived from thresholds */
  status: 'healthy' | 'warning' | 'critical';
  assets: AssetDriftDto[];
  /** Current configured thresholds (null if not configured) */
  thresholds: { warning: number; critical: number } | null;
  /** Whether any rebalancing is recommended */
  rebalancingRecommended: boolean;
}

export class DriftConfigResponseDto {
  portfolioId: string;
  warningThreshold: number;
  criticalThreshold: number;
  webhookUrl?: string;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export class DriftAlertDto {
  alertId: string;
  portfolioId: string;
  severity: 'warning' | 'critical';
  /** Symbol of the asset that breached the threshold (null for portfolio-level) */
  affectedAsset: string | null;
  currentDrift: number;
  threshold: number;
  message: string;
  triggeredAt: string;
  acknowledged: boolean;
  acknowledgedAt?: string;
  acknowledgedBy?: string;
}

export class DriftHistoryEntryDto {
  snapshotId: string;
  portfolioId: string;
  timestamp: string;
  overallDrift: number;
  maxDrift: number;
  status: 'healthy' | 'warning' | 'critical';
  assetCount: number;
  assetsInBreach: number;
}

export class DriftAnalysisDto {
  portfolioId: string;
  analysisTimestamp: string;
  /** Period in days over which trend is calculated */
  analysisPeriodDays: number;
  currentStatus: DriftStatusDto;
  /** Average drift over the history period */
  averageDrift: number;
  /** Peak drift observed over the history period */
  peakDrift: number;
  /** Drift trend: positive = drifting further, negative = converging */
  driftTrend: number;
  /** Asset with the largest drift currently */
  mostDriftedAsset: string | null;
  /** ISO timestamp of last rebalancing event (null if none recorded) */
  lastRebalancedAt: string | null;
  /** Projected days until critical threshold breach, null if already breached or unknown */
  projectedBreachDays: number | null;
  recommendation: string;
  history: DriftHistoryEntryDto[];
}

export class AcknowledgeAlertDto {
  acknowledgedBy?: string;
}

export class DriftWebhookResponseDto {
  webhookId: string;
  portfolioId: string;
  webhookUrl: string;
  events: Array<'warning' | 'critical' | 'resolved'>;
  registeredAt: string;
}
