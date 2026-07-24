import { Module } from '@nestjs/common';
import { MultiAssetStakingController } from './staking.controller';
import { PortfolioService } from './portfolio.service';
import { AssetRegistryService } from './asset-registry.service';

@Module({
  controllers: [MultiAssetStakingController],
  providers: [PortfolioService, AssetRegistryService]
})
export class StakingModule {}
