import { Injectable } from '@nestjs/common';
import {
  RebalancingAssetDto,
  RebalancingPlanRequestDto,
  RebalancingPlanResponseDto,
  RebalancingTradeDto
} from './dto/rebalancing.dto';

@Injectable()
export class RebalancingPlannerService {
  plan(request: RebalancingPlanRequestDto): RebalancingPlanResponseDto {
    const strategy = this.selectStrategy(request.strategy, request.assets);
    const trades = request.assets.map((asset) => this.buildTrade(asset, strategy));

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

  private buildTrade(asset: RebalancingAssetDto, strategy: string): RebalancingTradeDto {
    const delta = asset.targetAmount - asset.currentAmount;
    const direction: 'buy' | 'sell' = delta > 0 ? 'buy' : 'sell';
    const amount = Math.abs(delta);
    const estimatedSlippage = this.estimateSlippage(asset.liquidity, amount);
    const cost = this.calculateTradeCost(asset, amount, strategy);

    return {
      symbol: asset.symbol,
      direction,
      amount,
      cost,
      estimatedSlippage
    };
  }

  private selectStrategy(strategy: string, assets: RebalancingAssetDto[]): string {
    if (strategy === 'min-cost' || strategy === 'min-time' || strategy === 'balanced') {
      return strategy;
    }

    const avgLiquidity = assets.reduce((sum, asset) => sum + asset.liquidity, 0) / assets.length;
    return avgLiquidity > 3 ? 'min-cost' : 'balanced';
  }

  private calculateTradeCost(asset: RebalancingAssetDto, amount: number, strategy: string): number {
    const baseFee = amount * 0.01;
    const strategyMultiplier = strategy === 'min-time' ? 1.2 : strategy === 'balanced' ? 1.1 : 0.95;
    return Number((baseFee * strategyMultiplier + asset.volatility * 10).toFixed(4));
  }

  private estimateSlippage(liquidity: number, amount: number): number {
    const normalized = amount / Math.max(liquidity, 1);
    return Number(Math.min(0.08, normalized * 0.01).toFixed(4));
  }
}
