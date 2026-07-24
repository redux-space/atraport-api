import { Injectable } from '@nestjs/common';
import { RebalancingAssetDto, RebalancingTradeDto } from '../dto/rebalancing.dto';

@Injectable()
export class MinCostStrategy {
  public readonly id = 'min-cost';

  buildTrade(asset: RebalancingAssetDto, amount: number): RebalancingTradeDto {
    const delta = asset.targetAmount - asset.currentAmount;
    return {
      symbol: asset.symbol,
      direction: delta > 0 ? 'buy' : 'sell',
      amount: Math.abs(delta),
      cost: Number((amount * 0.0095 + asset.volatility * 10).toFixed(4)),
      estimatedSlippage: Number(Math.min(0.06, (Math.abs(delta) / Math.max(asset.liquidity, 1)) * 0.01).toFixed(4))
    };
  }
}
