import { Module } from '@nestjs/common';
import { MultiAssetRebalancingController } from './multi-asset-rebalancing.controller';
import { FeeCalculatorService } from './fee-calculator.service';
import { RebalancingPlannerService } from './rebalancing-planner.service';
import { RebalancingService } from './rebalancing.service';
import { BalancedStrategy } from './strategies/balanced.strategy';
import { MinCostStrategy } from './strategies/min-cost.strategy';
import { MinTimeStrategy } from './strategies/min-time.strategy';
import { DriftDetectionController } from './drift-detection.controller';
import { DriftCalculatorService } from './drift-calculator.service';
import { WebhookModule } from '../webhook/webhook.module';

@Module({
  imports: [WebhookModule],
  controllers: [MultiAssetRebalancingController, DriftDetectionController],
  providers: [
    RebalancingService,
    RebalancingPlannerService,
    FeeCalculatorService,
    MinCostStrategy,
    MinTimeStrategy,
    BalancedStrategy,
    DriftCalculatorService,
  ],
  exports: [RebalancingService, DriftCalculatorService],
})
export class RebalancingModule {}
