export class RebalancingSchedule {
  portfolioId: string;
  enabled: boolean;
  intervalMinutes: number;
  startAt: string;
  timezone: string;
}

export class RebalancingScheduleResponse extends RebalancingSchedule {
  id: string;
  createdAt: string;
  updatedAt: string;
}

export class ExecutionHistory {
  id: string;
  portfolioId: string;
  executedAt: string;
  trigger: 'scheduled' | 'manual';
  status: 'success' | 'failed';
  details?: string;
}

export class ValidationResult {
  valid: boolean;
  message: string;
}

export class NextExecutionResponse {
  portfolioId: string;
  nextExecutionAt: string;
  intervalMinutes: number;
}
