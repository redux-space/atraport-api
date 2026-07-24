import { Injectable, NotFoundException } from '@nestjs/common';

interface StakingPosition {
  id: string;
  stakerId: string;
  amount: number;
  unlockDate: Date;
}

@Injectable()
export class ContractsService {
  private stakingPositions: Map<string, StakingPosition> = new Map();

  getStatus() {
    return { module: 'contracts', status: 'ok' };
  }

  async getStakingPosition(stakingPositionId: string): Promise<StakingPosition | undefined> {
    return this.stakingPositions.get(stakingPositionId);
  }

  async processEmergencyWithdrawal(
    stakingPositionId: string, 
    amount: number, 
    penaltyAmount: number
  ): Promise<boolean> {
    const position = this.stakingPositions.get(stakingPositionId);
    if (!position) {
      throw new NotFoundException('Staking position not found');
    }

    if (position.amount < amount) {
      throw new Error('Insufficient balance for withdrawal');
    }

    position.amount -= amount;
    this.stakingPositions.set(stakingPositionId, position);
    
    console.log(`Processed emergency withdrawal: position ${stakingPositionId}, amount ${amount}, penalty ${penaltyAmount}`);
    return true;
  }

  async addStakingPosition(position: StakingPosition): Promise<void> {
    this.stakingPositions.set(position.id, position);
  }
}