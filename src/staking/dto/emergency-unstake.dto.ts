export class InitiateEmergencyUnstakeDto {
  stakerId: string;
  stakingPositionId: string;
  amount: number;
}

export class EmergencyUnstakePreviewDto {
  stakerId: string;
  stakingPositionId: string;
  amount: number;
  currentUnlockDate: Date;
}

export class EmergencyUnstakeHistoryFilterDto {
  page?: number = 1;
  limit?: number = 10;
  status?: 'pending' | 'processed' | 'failed';
  startDate?: Date;
  endDate?: Date;
}

export class PenaltyConfigDto {
  maxPenaltyRate: number;
  minPenaltyRate: number;
  rateLimitDays: number;
  lockupPeriodDays: number;
}