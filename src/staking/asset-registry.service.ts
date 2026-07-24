import { Injectable } from '@nestjs/common';
import { AssetInfo, AssetRate } from './dtos';

@Injectable()
export class AssetRegistryService {
  private supportedAssets: AssetInfo[] = [
    { assetId: 'ASTR', displayName: 'Astra Token', minStake: 10, maxStake: 100000 },
    { assetId: 'USDC', displayName: 'USD Coin', minStake: 50, maxStake: 500000 },
    { assetId: 'ETH', displayName: 'Ethereum', minStake: 0.1, maxStake: 1000 }
  ];

  private assetRates: AssetRate[] = [
    { assetId: 'ASTR', yieldRate: 0.065, termDays: 30 },
    { assetId: 'USDC', yieldRate: 0.045, termDays: 30 },
    { assetId: 'ETH', yieldRate: 0.055, termDays: 45 }
  ];

  getAssets(): AssetInfo[] {
    return this.supportedAssets;
  }

  getRatesByAssetId(assetId: string): AssetRate | undefined {
    return this.assetRates.find((rate) => rate.assetId === assetId);
  }

  getAllRates(): AssetRate[] {
    return this.assetRates;
  }
}
