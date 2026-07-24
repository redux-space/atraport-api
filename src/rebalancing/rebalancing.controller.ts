import { Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { RebalancingScheduleService } from './rebalancing.service';
import { ExecutionHistory, NextExecutionResponse, RebalancingSchedule, RebalancingScheduleResponse, ValidationResult } from './dto/rebalancing.dto';

@Controller('api/rebalancing')
export class RebalancingScheduleController {
  constructor(private readonly rebalancingService: RebalancingScheduleService) {}

  @Post('schedule')
  createSchedule(@Body() schedule: RebalancingSchedule): RebalancingScheduleResponse {
    return this.rebalancingService.createSchedule(schedule);
  }

  @Get('schedule/:portfolioId')
  getSchedule(@Param('portfolioId') portfolioId: string): RebalancingScheduleResponse | undefined {
    return this.rebalancingService.getSchedule(portfolioId);
  }

  @Put('schedule/:portfolioId')
  updateSchedule(@Param('portfolioId') portfolioId: string, @Body() update: Partial<RebalancingSchedule>): RebalancingScheduleResponse {
    return this.rebalancingService.updateSchedule(portfolioId, update);
  }

  @Delete('schedule/:portfolioId')
  deleteSchedule(@Param('portfolioId') portfolioId: string): { success: boolean } {
    return { success: this.rebalancingService.deleteSchedule(portfolioId) };
  }

  @Get('execution-history/:portfolioId')
  getExecutionHistory(@Param('portfolioId') portfolioId: string): ExecutionHistory[] {
    return this.rebalancingService.getExecutionHistory(portfolioId);
  }

  @Get('next-execution/:portfolioId')
  getNextExecution(@Param('portfolioId') portfolioId: string): NextExecutionResponse | undefined {
    return this.rebalancingService.getNextExecution(portfolioId);
  }

  @Post('execute-now')
  executeNow(@Body() body: { portfolioId: string }): { success: boolean; history: ExecutionHistory[] } {
    return this.rebalancingService.executeNow(body.portfolioId, 'manual');
  }

  @Post('validate-schedule')
  validateSchedule(@Body() schedule: Partial<RebalancingSchedule>): ValidationResult {
    return this.rebalancingService.validateSchedule(schedule);
  }
}
