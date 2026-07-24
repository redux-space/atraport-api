import { Module } from '@nestjs/common';
import { MultiAssetRebalancingController } from './multi-asset-rebalancing.controller';
import { FeeCalculatorService } from './fee-calculator.service';
import { RebalancingPlannerService } from './rebalancing-planner.service';
import { RebalancingService } from './rebalancing.service';
import { BalancedStrategy } from './strategies/balanced.strategy';
import { MinCostStrategy } from './strategies/min-cost.strategy';
import { MinTimeStrategy } from './strategies/min-time.strategy';

@Module({
  controllers: [MultiAssetRebalancingController],
  providers: [
    RebalancingService,
    RebalancingPlannerService,
    FeeCalculatorService,
    MinCostStrategy,
    MinTimeStrategy,
    BalancedStrategy
  ],
  exports: [RebalancingService]
})
export class RebalancingModule {}
