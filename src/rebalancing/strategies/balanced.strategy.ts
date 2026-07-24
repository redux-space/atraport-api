import { Injectable } from '@nestjs/common';
import { RebalancingAssetDto, RebalancingTradeDto } from '../dto/rebalancing.dto';

@Injectable()
export class BalancedStrategy {
  public readonly id = 'balanced';

  buildTrade(asset: RebalancingAssetDto, amount: number): RebalancingTradeDto {
    const delta = asset.targetAmount - asset.currentAmount;
    return {
      symbol: asset.symbol,
      direction: delta > 0 ? 'buy' : 'sell',
      amount: Math.abs(delta),
      cost: Number((amount * 0.011 + asset.volatility * 10).toFixed(4)),
      estimatedSlippage: Number(Math.min(0.07, (Math.abs(delta) / Math.max(asset.liquidity, 1)) * 0.011).toFixed(4))
    };
  }
}
