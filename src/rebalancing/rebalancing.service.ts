import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ExecutionHistory, NextExecutionResponse, RebalancingSchedule, RebalancingScheduleResponse, ValidationResult } from './dto/rebalancing.dto';

@Injectable()
export class RebalancingScheduleService {
  private schedules = new Map<string, RebalancingScheduleResponse>();
  private executionHistory = new Map<string, ExecutionHistory[]>();

  createSchedule(schedule: RebalancingSchedule): RebalancingScheduleResponse {
    this.validateSchedule(schedule);

    const now = new Date().toISOString();
    const persisted: RebalancingScheduleResponse = {
      id: `${schedule.portfolioId}-schedule`,
      portfolioId: schedule.portfolioId,
      enabled: schedule.enabled,
      intervalMinutes: schedule.intervalMinutes,
      startAt: schedule.startAt,
      timezone: schedule.timezone,
      createdAt: now,
      updatedAt: now,
    };

    this.schedules.set(schedule.portfolioId, persisted);
    this.executionHistory.set(schedule.portfolioId, []);
    return persisted;
  }

  getSchedule(portfolioId: string): RebalancingScheduleResponse | undefined {
    return this.schedules.get(portfolioId);
  }

  updateSchedule(portfolioId: string, update: Partial<RebalancingSchedule>): RebalancingScheduleResponse {
    const existing = this.schedules.get(portfolioId);
    if (!existing) {
      throw new NotFoundException('Schedule not found');
    }

    const next = {
      ...existing,
      ...update,
      portfolioId,
      updatedAt: new Date().toISOString(),
    };

    this.validateSchedule(next);
    this.schedules.set(portfolioId, next);
    return next;
  }

  deleteSchedule(portfolioId: string): boolean {
    const deleted = this.schedules.delete(portfolioId);
    this.executionHistory.delete(portfolioId);
    return deleted;
  }

  getExecutionHistory(portfolioId: string): ExecutionHistory[] {
    return this.executionHistory.get(portfolioId) ?? [];
  }

  getNextExecution(portfolioId: string): NextExecutionResponse | undefined {
    const schedule = this.schedules.get(portfolioId);
    if (!schedule) {
      return undefined;
    }

    const baseTime = new Date(schedule.startAt);
    const nextTime = new Date(baseTime.getTime() + schedule.intervalMinutes * 60 * 1000);

    return {
      portfolioId,
      nextExecutionAt: nextTime.toISOString(),
      intervalMinutes: schedule.intervalMinutes,
    };
  }

  executeNow(portfolioId: string, trigger: 'scheduled' | 'manual' = 'manual'): { success: boolean; history: ExecutionHistory[] } {
    const schedule = this.schedules.get(portfolioId);
    if (!schedule) {
      throw new NotFoundException('Schedule not found');
    }

    const entry: ExecutionHistory = {
      id: `${portfolioId}-${Date.now()}`,
      portfolioId,
      executedAt: new Date().toISOString(),
      trigger,
      status: 'success',
      details: 'Rebalancing executed successfully',
    };

    const history = this.executionHistory.get(portfolioId) ?? [];
    history.push(entry);
    this.executionHistory.set(portfolioId, history);

    return { success: true, history };
  }

  validateSchedule(schedule: Partial<RebalancingSchedule>): ValidationResult {
    if (!schedule.portfolioId || !schedule.portfolioId.trim()) {
      throw new BadRequestException('portfolioId is required');
    }

    if (typeof schedule.intervalMinutes !== 'number' || schedule.intervalMinutes <= 0) {
      throw new BadRequestException('intervalMinutes must be a positive number');
    }

    if (!schedule.startAt) {
      throw new BadRequestException('startAt is required');
    }

    if (!schedule.timezone || !schedule.timezone.trim()) {
      throw new BadRequestException('timezone is required');
    }

    return { valid: true, message: 'Schedule is valid' };
  }
}
