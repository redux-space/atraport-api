import {
  ArrayMinSize,
  IsArray,
  IsInt,
  IsNumber,
  IsPositive,
  IsString,
  Min,
  ValidateNested
} from 'class-validator';
import { Type } from 'class-transformer';

export class StakingAssetRequest {
  @IsString()
  assetId: string;

  @IsNumber()
  @Min(0.00000001)
  amount: number;

  @IsInt()
  @Min(1)
  termDays: number;
}

export class MultiAssetStakeRequest {
  @IsString()
  stakerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => StakingAssetRequest)
  assets: StakingAssetRequest[];
}

export class WithdrawAssetRequest {
  @IsString()
  assetId: string;

  @IsNumber()
  @Min(0.00000001)
  amount: number;
}

export class MultiAssetWithdrawRequest {
  @IsString()
  stakerId: string;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WithdrawAssetRequest)
  assets: WithdrawAssetRequest[];
}

export class PortfolioView {
  stakerId: string;
  totalValue: number;
  totalYield: number;
  positions: StakingPosition[];
  optimizedAllocation: PortfolioOptimizationSuggestion;
}

export class StakingPosition {
  assetId: string;
  stakedAmount: number;
  yieldRate: number;
  termDays: number;
  unlockedAt: string;
  accruedYield: number;
}

export class AggregatedYield {
  stakerId: string;
  totalYield: number;
  assets: { assetId: string; yield: number }[];
}

export class AssetRate {
  assetId: string;
  yieldRate: number;
  termDays: number;
}

export class AssetInfo {
  assetId: string;
  displayName: string;
  minStake: number;
  maxStake: number;
}

export class PortfolioOptimizationSuggestion {
  recommendedRebalance: { assetId: string; targetAllocation: number; currentAllocation: number }[];
  suggestionText: string;
}
