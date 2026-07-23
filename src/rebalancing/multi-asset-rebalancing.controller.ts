import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import {
  FeeEstimateRequest,
  RebalancingPlanRequest,
  RebalancingService,
  SlippageEstimateRequest
} from './rebalancing.service';

@Controller('api/rebalancing')
export class MultiAssetRebalancingController {
  constructor(private readonly rebalancingService: RebalancingService) {}

  @Post('plan')
  plan(@Body() body: RebalancingPlanRequest) {
    return this.rebalancingService.plan(body);
  }

  @Get('strategies')
  strategies() {
    return {
      strategies: [
        { id: 'min-cost', description: 'Optimize for lower fees' },
        { id: 'min-time', description: 'Favor quicker execution' },
        { id: 'balanced', description: 'Balance cost and speed' }
      ]
    };
  }

  @Post('estimate-fees')
  estimateFees(@Body() body: FeeEstimateRequest) {
    return this.rebalancingService.estimateFees(body);
  }

  @Post('execute')
  execute(@Body() body: RebalancingPlanRequest) {
    return this.rebalancingService.execute(body);
  }

  @Get('trades/:rebalanceId')
  getTrades(@Param('rebalanceId') rebalanceId: string) {
    return { rebalanceId, trades: this.rebalancingService.getTrades(rebalanceId) };
  }

  @Get('slippage-estimate')
  getSlippageEstimate(@Body() body: SlippageEstimateRequest) {
    return this.rebalancingService.getSlippageEstimate(body);
  }

  @Get('execution-log/:portfolioId')
  getExecutionLog(@Param('portfolioId') portfolioId: string) {
    return this.rebalancingService.getExecutionLog(portfolioId);
  }

  @Post('dry-run')
  dryRun(@Body() body: RebalancingPlanRequest) {
    return this.rebalancingService.dryRun(body);
  }
}
