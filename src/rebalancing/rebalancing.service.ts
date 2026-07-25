import { Injectable } from '@nestjs/common';
import {
  ExecutionHistory,
  FeeEstimateRequestDto,
  NextExecutionResponse,
  RebalancingPlanRequestDto,
  RebalancingPlanResponseDto,
  RebalancingSchedule,
  RebalancingScheduleResponse,
  SlippageEstimateRequestDto,
  SlippageEstimateResponseDto,
  TradeExecutionResultDto,
  ValidationResult,
} from './dto/rebalancing.dto';
import { FeeCalculatorService } from './fee-calculator.service';
import { RebalancingPlannerService } from './rebalancing-planner.service';

@Injectable()
export class RebalancingService {
  private readonly history: TradeExecutionResultDto[] = [];
  private readonly schedules = new Map<string, RebalancingScheduleResponse>();
  private readonly executionHistory: ExecutionHistory[] = [];

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

  // ─── Schedule management ──────────────────────────────────────────────────

  createSchedule(schedule: RebalancingSchedule): RebalancingScheduleResponse {
    const now = new Date().toISOString();
    const id = `sched-${Date.now()}`;
    const response: RebalancingScheduleResponse = { ...schedule, id, createdAt: now, updatedAt: now };
    this.schedules.set(schedule.portfolioId, response);
    return response;
  }

  getSchedule(portfolioId: string): RebalancingScheduleResponse | undefined {
    return this.schedules.get(portfolioId);
  }

  updateSchedule(portfolioId: string, update: Partial<RebalancingSchedule>): RebalancingScheduleResponse {
    const existing = this.schedules.get(portfolioId);
    if (!existing) {
      throw new Error(`Schedule not found for portfolio ${portfolioId}`);
    }
    const updated: RebalancingScheduleResponse = {
      ...existing,
      ...update,
      updatedAt: new Date().toISOString(),
    };
    this.schedules.set(portfolioId, updated);
    return updated;
  }

  deleteSchedule(portfolioId: string): boolean {
    return this.schedules.delete(portfolioId);
  }

  getExecutionHistory(portfolioId: string): ExecutionHistory[] {
    return this.executionHistory.filter((h) => h.portfolioId === portfolioId);
  }

  getNextExecution(portfolioId: string): NextExecutionResponse | undefined {
    const schedule = this.schedules.get(portfolioId);
    if (!schedule || !schedule.enabled) return undefined;
    const base = schedule.startAt ? new Date(schedule.startAt) : new Date();
    const next = new Date(base.getTime() + schedule.intervalMinutes * 60_000);
    return { portfolioId, nextExecutionAt: next.toISOString() };
  }

  executeNow(portfolioId: string, trigger: string): { success: boolean; history: ExecutionHistory[] } {
    const entry: ExecutionHistory = {
      id: `exec-${Date.now()}`,
      portfolioId,
      executedAt: new Date().toISOString(),
      trigger,
      status: 'success',
    };
    this.executionHistory.push(entry);
    return { success: true, history: this.getExecutionHistory(portfolioId) };
  }

  validateSchedule(schedule: Partial<RebalancingSchedule>): ValidationResult {
    const errors: string[] = [];
    if (!schedule.portfolioId) errors.push('portfolioId is required');
    if (schedule.intervalMinutes !== undefined && schedule.intervalMinutes < 1) {
      errors.push('intervalMinutes must be at least 1');
    }
    return { valid: errors.length === 0, errors };
  }
}
