import { Module } from '@nestjs/common';
import { MultiAssetRebalancingController } from './multi-asset-rebalancing.controller';
import { RebalancingService } from './rebalancing.service';

@Module({
  controllers: [MultiAssetRebalancingController],
  providers: [RebalancingService],
  exports: [RebalancingService]
})
export class RebalancingModule {}
