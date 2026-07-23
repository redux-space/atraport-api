import { Injectable } from '@nestjs/common';

export interface RebalancingAssetInput {
  symbol: string;
  currentAmount: number;
  targetAmount: number;
  liquidity: number;
  volatility: number;
}

export interface RebalancingPlanRequest {
  portfolioId: string;
  strategy: string;
  currentAllocation: Record<string, number>;
  targetAllocation: Record<string, number>;
  assets: RebalancingAssetInput[];
  tolerance: number;
}

export interface FeeEstimateRequest {
  portfolioId: string;
  strategy: string;
  assets: RebalancingAssetInput[];
}

export interface SlippageEstimateRequest {
  portfolioId: string;
  strategy: string;
  asset: string;
  tradeSize: number;
  tolerance: number;
  liquidity: number;
}

export interface RebalancingTrade {
  symbol: string;
  direction: 'buy' | 'sell';
  amount: number;
  cost: number;
  estimatedSlippage: number;
}

export interface RebalancingPlanResponse {
  rebalanceId: string;
  portfolioId: string;
  recommendedStrategy: string;
  tolerance: number;
  trades: RebalancingTrade[];
  estimatedTotalFee: number;
  executionTimeMs: number;
}

export interface FeeEstimateResponse {
  portfolioId: string;
  strategy: string;
  totalFee: number;
  perAssetFees: Array<{ symbol: string; fee: number }>;
  recommendation: string;
}

export interface SlippageEstimateResponse {
  portfolioId: string;
  strategy: string;
  asset: string;
  estimatedSlippage: number;
  tolerance: number;
  blocked: boolean;
  reason: string;
}

export interface ExecutionResult {
  rebalanceId: string;
  portfolioId: string;
  strategy: string;
  status: 'completed' | 'simulated';
  trades: RebalancingTrade[];
  totalFees: number;
  slippageEvents: number;
  executedAt: string;
}

@Injectable()
export class RebalancingService {
  private readonly history: ExecutionResult[] = [];

  plan(request: RebalancingPlanRequest): RebalancingPlanResponse {
    const strategy = this.selectStrategy(request.strategy, request.assets);
    const trades = request.assets.map((asset) => {
      const delta = asset.targetAmount - asset.currentAmount;
      const direction: 'buy' | 'sell' = delta > 0 ? 'buy' : 'sell';
      const amount = Math.abs(delta);
      const estimatedSlippage = this.estimateSlippage(asset.liquidity, amount);

      return {
        symbol: asset.symbol,
        direction,
        amount,
        cost: this.calculateTradeCost(asset, amount, strategy),
        estimatedSlippage
      };
    });

    return {
      rebalanceId: `rebalance-${Date.now()}`,
      portfolioId: request.portfolioId,
      recommendedStrategy: strategy,
      tolerance: request.tolerance,
      trades,
      estimatedTotalFee: trades.reduce((sum, trade) => sum + trade.cost, 0),
      executionTimeMs: 650
    };
  }

  estimateFees(request: FeeEstimateRequest): FeeEstimateResponse {
    const strategy = this.selectStrategy(request.strategy, request.assets);
    const perAssetFees = request.assets.map((asset) => {
      const delta = asset.targetAmount - asset.currentAmount;
      const amount = Math.abs(delta);
      return {
        symbol: asset.symbol,
        fee: this.calculateTradeCost(asset, amount, strategy)
      };
    });

    const totalFee = perAssetFees.reduce((sum, entry) => sum + entry.fee, 0);

    return {
      portfolioId: request.portfolioId,
      strategy,
      totalFee,
      perAssetFees,
      recommendation: strategy === 'min-cost' ? 'Route through the deepest liquidity pool' : 'Use faster execution venue'
    };
  }

  execute(request: RebalancingPlanRequest): ExecutionResult {
    const plan = this.plan(request);
    const totalFees = plan.trades.reduce((sum, trade) => sum + trade.cost, 0);
    const slippageEvents = plan.trades.filter((trade) => trade.estimatedSlippage > request.tolerance).length;
    const status: ExecutionResult['status'] = 'completed';
    const result: ExecutionResult = {
      rebalanceId: plan.rebalanceId,
      portfolioId: request.portfolioId,
      strategy: plan.recommendedStrategy,
      status,
      trades: plan.trades,
      totalFees,
      slippageEvents,
      executedAt: new Date().toISOString()
    };

    this.history.push(result);
    return result;
  }

  getTrades(rebalanceId: string) {
    const found = this.history.find((entry) => entry.rebalanceId === rebalanceId);
    return found ? found.trades : [];
  }

  getSlippageEstimate(request: SlippageEstimateRequest): SlippageEstimateResponse {
    const estimate = this.estimateSlippage(request.liquidity, request.tradeSize);
    const blocked = estimate > request.tolerance;
    return {
      portfolioId: request.portfolioId,
      strategy: request.strategy,
      asset: request.asset,
      estimatedSlippage: estimate,
      tolerance: request.tolerance,
      blocked,
      reason: blocked ? 'Projected slippage exceeds tolerance' : 'Slippage remains within tolerance'
    };
  }

  getExecutionLog(portfolioId: string): ExecutionResult[] {
    return this.history.filter((entry) => entry.portfolioId === portfolioId);
  }

  dryRun(request: RebalancingPlanRequest): ExecutionResult {
    const plan = this.plan(request);
    const result: ExecutionResult = {
      rebalanceId: plan.rebalanceId,
      portfolioId: request.portfolioId,
      strategy: plan.recommendedStrategy,
      status: 'simulated',
      trades: plan.trades,
      totalFees: plan.trades.reduce((sum, trade) => sum + trade.cost, 0),
      slippageEvents: plan.trades.filter((trade) => trade.estimatedSlippage > request.tolerance).length,
      executedAt: new Date().toISOString()
    };

    return result;
  }

  private selectStrategy(strategy: string, assets: RebalancingAssetInput[]): string {
    if (strategy === 'min-cost' || strategy === 'min-time' || strategy === 'balanced') {
      return strategy;
    }

    const avgLiquidity = assets.reduce((sum, asset) => sum + asset.liquidity, 0) / assets.length;
    return avgLiquidity > 3 ? 'min-cost' : 'balanced';
  }

  private calculateTradeCost(asset: RebalancingAssetInput, amount: number, strategy: string): number {
    const baseFee = amount * 0.01;
    const strategyMultiplier = strategy === 'min-time' ? 1.2 : strategy === 'balanced' ? 1.1 : 0.95;
    return Number((baseFee * strategyMultiplier + asset.volatility * 10).toFixed(4));
  }

  private estimateSlippage(liquidity: number, amount: number): number {
    const normalized = amount / Math.max(liquidity, 1);
    return Number(Math.min(0.08, normalized * 0.01).toFixed(4));
  }
}
