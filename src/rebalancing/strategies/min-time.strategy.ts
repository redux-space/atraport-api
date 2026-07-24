import { Injectable } from '@nestjs/common';
import { RebalancingAssetDto, RebalancingTradeDto } from '../dto/rebalancing.dto';

@Injectable()
export class MinTimeStrategy {
  public readonly id = 'min-time';

  buildTrade(asset: RebalancingAssetDto, amount: number): RebalancingTradeDto {
    const delta = asset.targetAmount - asset.currentAmount;
    return {
      symbol: asset.symbol,
      direction: delta > 0 ? 'buy' : 'sell',
      amount: Math.abs(delta),
      cost: Number((amount * 0.012 + asset.volatility * 10).toFixed(4)),
      estimatedSlippage: Number(Math.min(0.08, (Math.abs(delta) / Math.max(asset.liquidity, 1)) * 0.012).toFixed(4))
    };
  }
}
