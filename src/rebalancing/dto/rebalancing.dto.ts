export class RebalancingAssetDto {
  symbol: string;
  currentAmount: number;
  targetAmount: number;
  liquidity: number;
  volatility: number;
}

export class RebalancingPlanRequestDto {
  portfolioId: string;
  strategy: string;
  currentAllocation: Record<string, number>;
  targetAllocation: Record<string, number>;
  assets: RebalancingAssetDto[];
  tolerance: number;
}

export class FeeEstimateRequestDto {
  portfolioId: string;
  strategy: string;
  assets: RebalancingAssetDto[];
}

export class SlippageEstimateRequestDto {
  portfolioId: string;
  strategy: string;
  asset: string;
  tradeSize: number;
  tolerance: number;
  liquidity: number;
}

export class RebalancingTradeDto {
  symbol: string;
  direction: 'buy' | 'sell';
  amount: number;
  cost: number;
  estimatedSlippage: number;
}

export class RebalancingPlanResponseDto {
  rebalanceId: string;
  portfolioId: string;
  recommendedStrategy: string;
  tolerance: number;
  trades: RebalancingTradeDto[];
  estimatedTotalFee: number;
  executionTimeMs: number;
}

export class FeeEstimateResponseDto {
  portfolioId: string;
  strategy: string;
  totalFee: number;
  perAssetFees: Array<{ symbol: string; fee: number }>;
  recommendation: string;
}

export class SlippageEstimateResponseDto {
  portfolioId: string;
  strategy: string;
  asset: string;
  estimatedSlippage: number;
  tolerance: number;
  blocked: boolean;
  reason: string;
}

export class TradeExecutionResultDto {
  rebalanceId: string;
  portfolioId: string;
  strategy: string;
  status: 'completed' | 'simulated';
  trades: RebalancingTradeDto[];
  totalFees: number;
  slippageEvents: number;
  executedAt: string;
}

// ─── Schedule-based rebalancing types ─────────────────────────────────────────

export interface RebalancingSchedule {
  portfolioId: string;
  enabled: boolean;
  intervalMinutes: number;
  startAt?: string;
  timezone?: string;
}

export interface RebalancingScheduleResponse extends RebalancingSchedule {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export interface ExecutionHistory {
  id: string;
  portfolioId: string;
  executedAt: string;
  trigger: string;
  status: 'success' | 'failed';
}

export interface NextExecutionResponse {
  portfolioId: string;
  nextExecutionAt: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}
