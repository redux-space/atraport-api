import { Injectable } from '@nestjs/common';
import {
  FeeEstimateRequestDto,
  RebalancingPlanRequestDto,
  RebalancingPlanResponseDto,
  SlippageEstimateRequestDto,
  SlippageEstimateResponseDto,
  TradeExecutionResultDto
} from './dto/rebalancing.dto';
import { FeeCalculatorService } from './fee-calculator.service';
import { RebalancingPlannerService } from './rebalancing-planner.service';

@Injectable()
export class RebalancingService {
  private readonly history: TradeExecutionResultDto[] = [];

  constructor(
    private readonly planner: RebalancingPlannerService,
    private readonly feeCalculator: FeeCalculatorService
  ) {}

  plan(request: RebalancingPlanRequestDto): RebalancingPlanResponseDto {
    return this.planner.plan(request);
  }

  estimateFees(request: FeeEstimateRequestDto) {
    return this.feeCalculator.estimateFees(request);
  }

  execute(request: RebalancingPlanRequestDto): TradeExecutionResultDto {
    const plan = this.plan(request);
    const totalFees = plan.trades.reduce((sum, trade) => sum + trade.cost, 0);
    const slippageEvents = plan.trades.filter((trade) => trade.estimatedSlippage > request.tolerance).length;
    const result: TradeExecutionResultDto = {
      rebalanceId: plan.rebalanceId,
      portfolioId: request.portfolioId,
      strategy: plan.recommendedStrategy,
      status: 'completed',
      trades: plan.trades,
      totalFees,
      slippageEvents,
      executedAt: new Date().toISOString()
    };

    this.history.push(result);
    return result;
  }

  getTrades(rebalanceId: string) {
    const found = this.history.find((entry) => entry.rebalanceId === rebalanceId);
    return found ? found.trades : [];
  }

  getSlippageEstimate(request: SlippageEstimateRequestDto): SlippageEstimateResponseDto {
    const estimate = this.estimateSlippage(request.liquidity, request.tradeSize);
    const blocked = estimate > request.tolerance;
    return {
      portfolioId: request.portfolioId,
      strategy: request.strategy,
      asset: request.asset,
      estimatedSlippage: estimate,
      tolerance: request.tolerance,
      blocked,
      reason: blocked ? 'Projected slippage exceeds tolerance' : 'Slippage remains within tolerance'
    };
  }

  getExecutionLog(portfolioId: string): TradeExecutionResultDto[] {
    return this.history.filter((entry) => entry.portfolioId === portfolioId);
  }

  dryRun(request: RebalancingPlanRequestDto): TradeExecutionResultDto {
    const plan = this.plan(request);
    return {
      rebalanceId: plan.rebalanceId,
      portfolioId: request.portfolioId,
      strategy: plan.recommendedStrategy,
      status: 'simulated',
      trades: plan.trades,
      totalFees: plan.trades.reduce((sum, trade) => sum + trade.cost, 0),
      slippageEvents: plan.trades.filter((trade) => trade.estimatedSlippage > request.tolerance).length,
      executedAt: new Date().toISOString()
    };
  }

  private estimateSlippage(liquidity: number, amount: number): number {
    const normalized = amount / Math.max(liquidity, 1);
    return Number(Math.min(0.08, normalized * 0.01).toFixed(4));
  }
}
