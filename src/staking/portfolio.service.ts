import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AssetRegistryService } from './asset-registry.service';
import {
  AggregatedYield,
  AssetRate,
  PortfolioOptimizationSuggestion,
  PortfolioView,
  StakingPosition,
  MultiAssetStakeRequest,
  MultiAssetWithdrawRequest
} from './dtos';

interface CachedEntry<T> {
  value: T;
  expiresAt: number;
}

interface InternalPosition extends StakingPosition {
  assetId: string;
}

interface PortfolioData {
  [stakerId: string]: InternalPosition[];
}

@Injectable()
export class PortfolioService {
  private readonly portfolioData: PortfolioData = {};
  private readonly cache: Map<string, CachedEntry<any>> = new Map();
  private readonly cacheTtlMs = 300 * 1000;

  constructor(private readonly assetRegistry: AssetRegistryService) {}

  async stakeMulti(request: MultiAssetStakeRequest) {
    this.validateStakeRequest(request);

    const positions = request.assets.map((asset) => {
      const assetRate = this.assetRegistry.getRatesByAssetId(asset.assetId);
      const unlockedAt = new Date(Date.now() + asset.termDays * 24 * 60 * 60 * 1000).toISOString();

      return {
        assetId: asset.assetId,
        stakedAmount: asset.amount,
        yieldRate: assetRate?.yieldRate ?? 0,
        termDays: asset.termDays,
        unlockedAt,
        accruedYield: this.calculateYield(asset.amount, assetRate?.yieldRate ?? 0, asset.termDays)
      };
    });

    this.portfolioData[request.stakerId] = [...(this.portfolioData[request.stakerId] || []), ...positions];
    this.invalidateCache(request.stakerId);

    return { stakerId: request.stakerId, positions };
  }

  async withdrawMulti(request: MultiAssetWithdrawRequest) {
    const positions = this.portfolioData[request.stakerId];
    if (!positions || positions.length === 0) {
      throw new NotFoundException('No staking positions found for staker');
    }

    const now = new Date();
    const withdrawals: { assetId: string; amount: number; unlocked: boolean }[] = [];

    request.assets.forEach((asset) => {
      const position = positions.find((pos) => pos.assetId === asset.assetId && pos.stakedAmount >= asset.amount);
      if (!position) {
        withdrawals.push({ assetId: asset.assetId, amount: asset.amount, unlocked: false });
        return;
      }

      const unlocked = new Date(position.unlockedAt) <= now;
      if (!unlocked) {
        withdrawals.push({ assetId: asset.assetId, amount: asset.amount, unlocked: false });
        return;
      }

      position.stakedAmount -= asset.amount;
      if (position.stakedAmount === 0) {
        const index = positions.indexOf(position);
        positions.splice(index, 1);
      }
      withdrawals.push({ assetId: asset.assetId, amount: asset.amount, unlocked: true });
    });

    this.invalidateCache(request.stakerId);
    return { stakerId: request.stakerId, withdrawals };
  }

  async getPortfolioView(stakerId: string): Promise<PortfolioView> {
    const cached = this.getCache<PortfolioView>(`portfolio:${stakerId}`);
    if (cached) {
      return cached;
    }

    const positions = this.portfolioData[stakerId];
    if (!positions) {
      throw new NotFoundException('Staker not found');
    }

    const totalValue = positions.reduce((sum, pos) => sum + pos.stakedAmount, 0);
    const totalYield = positions.reduce((sum, pos) => sum + pos.accruedYield, 0);
    const suggestion = this.optimizePortfolio(positions);

    const view: PortfolioView = {
      stakerId,
      totalValue,
      totalYield,
      positions: positions.map((pos) => ({ ...pos })),
      optimizedAllocation: suggestion
    };

    this.setCache(`portfolio:${stakerId}`, view);
    return view;
  }

  async getPositionsByStaker(stakerId: string): Promise<StakingPosition[]> {
    const positions = this.portfolioData[stakerId];
    if (!positions) {
      throw new NotFoundException('Staker not found');
    }
    return positions.map((pos) => ({ ...pos }));
  }

  async getAggregatedYield(stakerId: string): Promise<AggregatedYield> {
    const cached = this.getCache<AggregatedYield>(`aggregated-yield:${stakerId}`);
    if (cached) {
      return cached;
    }

    const positions = this.portfolioData[stakerId];
    if (!positions) {
      throw new NotFoundException('Staker not found');
    }

    const assets = positions.map((pos) => ({ assetId: pos.assetId, yield: pos.accruedYield }));
    const totalYield = assets.reduce((sum, asset) => sum + asset.yield, 0);

    const aggregated: AggregatedYield = { stakerId, totalYield, assets };
    this.setCache(`aggregated-yield:${stakerId}`, aggregated);
    return aggregated;
  }

  getAssetList(): ReturnType<AssetRegistryService['getAssets']> {
    return this.assetRegistry.getAssets();
  }

  getAssetRates(assetId: string): AssetRate {
    const rate = this.assetRegistry.getRatesByAssetId(assetId);
    if (!rate) {
      throw new NotFoundException('Asset not supported');
    }
    return rate;
  }

  validateStakeRequest(request: MultiAssetStakeRequest) {
    if (!request.stakerId || !Array.isArray(request.assets) || request.assets.length === 0) {
      throw new BadRequestException('Invalid stake request payload');
    }

    request.assets.forEach((asset) => {
      const assetRate = this.assetRegistry.getRatesByAssetId(asset.assetId);
      if (!assetRate) {
        throw new BadRequestException(`Unsupported asset ${asset.assetId}`);
      }
      if (asset.amount <= 0 || asset.termDays <= 0) {
        throw new BadRequestException('Asset amount and term must be greater than zero');
      }
    });
  }

  private calculateYield(amount: number, yieldRate: number, termDays: number): number {
    return parseFloat((amount * yieldRate * (termDays / 365)).toFixed(8));
  }

  private optimizePortfolio(positions: InternalPosition[]): PortfolioOptimizationSuggestion {
    const totalValue = positions.reduce((sum, pos) => sum + pos.stakedAmount, 0);
    const allocations = positions.reduce((acc, pos) => {
      acc[pos.assetId] = (acc[pos.assetId] || 0) + pos.stakedAmount;
      return acc;
    }, {} as Record<string, number>);

    const recommended = Object.entries(allocations).map(([assetId, amount]) => ({
      assetId,
      currentAllocation: parseFloat(((amount / totalValue) * 100).toFixed(2)),
      targetAllocation: parseFloat(((1 / Object.keys(allocations).length) * 100).toFixed(2))
    }));

    return {
      recommendedRebalance: recommended,
      suggestionText: 'Rebalance across supported assets to equal-weight allocations for stable returns and diversified exposure.'
    };
  }

  private getCache<T>(key: string): T | undefined {
    const entry = this.cache.get(key);
    if (!entry || entry.expiresAt < Date.now()) {
      this.cache.delete(key);
      return undefined;
    }
    return entry.value;
  }

  private setCache<T>(key: string, value: T) {
    this.cache.set(key, { value, expiresAt: Date.now() + this.cacheTtlMs });
  }

  private invalidateCache(stakerId: string) {
    this.cache.delete(`portfolio:${stakerId}`);
    this.cache.delete(`aggregated-yield:${stakerId}`);
  }
}
