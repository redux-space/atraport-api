import { Injectable } from '@nestjs/common';
import { RebalancingAssetDto, FeeEstimateRequestDto, FeeEstimateResponseDto } from './dto/rebalancing.dto';
import { RebalancingPlannerService } from './rebalancing-planner.service';

@Injectable()
export class FeeCalculatorService {
  constructor(private readonly planner: RebalancingPlannerService) {}

  estimateFees(request: FeeEstimateRequestDto): FeeEstimateResponseDto {
    const strategy = this.planner['selectStrategy'](request.strategy, request.assets);
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
      recommendation: strategy === 'min-cost' ? 'Route through deepest liquidity pools' : 'Use a faster execution venue'
    };
  }

  private calculateTradeCost(asset: RebalancingAssetDto, amount: number, strategy: string): number {
    const baseFee = amount * 0.01;
    const strategyMultiplier = strategy === 'min-time' ? 1.2 : strategy === 'balanced' ? 1.1 : 0.95;
    return Number((baseFee * strategyMultiplier + asset.volatility * 10).toFixed(4));
  }
}
