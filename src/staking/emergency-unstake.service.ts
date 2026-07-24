import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { EmergencyUnstake } from './entities/emergency-unstake.entity';
import { 
  InitiateEmergencyUnstakeDto, 
  EmergencyUnstakePreviewDto,
  EmergencyUnstakeHistoryFilterDto,
  PenaltyConfigDto 
} from './dto/emergency-unstake.dto';
import { ContractsService } from '../contracts/contracts.service';

@Injectable()
export class EmergencyUnstakeService {
  private penaltyConfig: PenaltyConfigDto = {
    maxPenaltyRate: 0.25, // 25% maximum penalty
    minPenaltyRate: 0.05, // 5% minimum penalty
    rateLimitDays: 7,
    lockupPeriodDays: 180
  };

  constructor(
    @InjectRepository(EmergencyUnstake)
    private readonly emergencyUnstakeRepository: Repository<EmergencyUnstake>,
    private readonly contractsService: ContractsService
  ) {}

  getPenaltyConfig(): PenaltyConfigDto {
    return { ...this.penaltyConfig };
  }

  calculatePenalty(currentDate: Date, unlockDate: Date): number {
    const now = currentDate.getTime();
    const unlock = unlockDate.getTime();
    const totalLockupPeriod = this.penaltyConfig.lockupPeriodDays * 24 * 60 * 60 * 1000;
    const timeRemaining = unlock - now;
    
    if (timeRemaining <= 0) {
      return 0; // No penalty if lockup has expired
    }

    const timeRemainingRatio = timeRemaining / totalLockupPeriod;
    const penaltyRange = this.penaltyConfig.maxPenaltyRate - this.penaltyConfig.minPenaltyRate;
    const penalty = this.penaltyConfig.minPenaltyRate + (penaltyRange * timeRemainingRatio);
    
    return Math.min(penalty, this.penaltyConfig.maxPenaltyRate);
  }

  async previewPenalty(previewDto: EmergencyUnstakePreviewDto) {
    const currentDate = new Date();
    const penalty = this.calculatePenalty(currentDate, previewDto.currentUnlockDate);
    const penaltyAmount = previewDto.amount * penalty;
    
    return {
      preview: {
        originalAmount: previewDto.amount,
        penaltyRate: penalty,
        penaltyAmount: penaltyAmount,
        netAmount: previewDto.amount - penaltyAmount,
        unlockDate: previewDto.currentUnlockDate,
        daysRemaining: Math.ceil((previewDto.currentUnlockDate.getTime() - currentDate.getTime()) / (1000 * 60 * 60 * 24))
      }
    };
  }

  async checkRateLimit(stakerId: string): Promise<boolean> {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - this.penaltyConfig.rateLimitDays);
    
    const recentUnstake = await this.emergencyUnstakeRepository.findOne({
      where: {
        stakerId,
        createdAt: MoreThan(sevenDaysAgo)
      },
      order: { createdAt: 'DESC' }
    });

    return !recentUnstake;
  }

  async initiateEmergencyUnstake(dto: InitiateEmergencyUnstakeDto) {
    const canUnstake = await this.checkRateLimit(dto.stakerId);
    if (!canUnstake) {
      throw new BadRequestException('Emergency unstake is limited to once every 7 days per staker');
    }

    const stakingPosition = await this.contractsService.getStakingPosition(dto.stakingPositionId);
    if (!stakingPosition) {
      throw new NotFoundException('Staking position not found');
    }

    if (stakingPosition.stakerId !== dto.stakerId) {
      throw new BadRequestException('Staker ID does not match position owner');
    }

    if (dto.amount > stakingPosition.amount) {
      throw new BadRequestException('Requested amount exceeds staked balance');
    }

    const currentDate = new Date();
    const penalty = this.calculatePenalty(currentDate, stakingPosition.unlockDate);
    const penaltyAmount = dto.amount * penalty;

    const emergencyUnstake = this.emergencyUnstakeRepository.create({
      stakerId: dto.stakerId,
      amount: dto.amount,
      penalty: penaltyAmount,
      penaltyRate: penalty,
      originalUnlockDate: stakingPosition.unlockDate,
      status: 'pending',
      auditLog: [{
        timestamp: currentDate,
        action: 'INITIATED',
        details: `Emergency unstake initiated for amount ${dto.amount}`
      }]
    });

    await this.emergencyUnstakeRepository.save(emergencyUnstake);

    await this.contractsService.processEmergencyWithdrawal(dto.stakingPositionId, dto.amount, penaltyAmount);

    return {
      success: true,
      transactionId: emergencyUnstake.id,
      status: emergencyUnstake.status,
      penalty: {
        rate: penalty,
        amount: penaltyAmount,
        netAmount: dto.amount - penaltyAmount
      },
      message: 'Emergency unstake initiated successfully'
    };
  }

  async getUnstakeStatus(stakerId: string, unstakeId?: string) {
    const query = unstakeId 
      ? { id: unstakeId, stakerId }
      : { stakerId };
      
    const unstakes = await this.emergencyUnstakeRepository.find({
      where: query,
      order: { createdAt: 'DESC' }
    });

    if (unstakes.length === 0) {
      throw new NotFoundException('No emergency unstake records found');
    }

    return {
      records: unstakes.map(record => ({
        id: record.id,
        status: record.status,
        amount: record.amount,
        penalty: record.penalty,
        createdAt: record.createdAt,
        processedAt: record.processedAt
      }))
    };
  }

  async getEmergencyHistory(stakerId: string, filters: EmergencyUnstakeHistoryFilterDto) {
    const queryBuilder = this.emergencyUnstakeRepository.createQueryBuilder('emergency_unstake')
      .where('emergency_unstake.stakerId = :stakerId', { stakerId });

    if (filters.status) {
      queryBuilder.andWhere('emergency_unstake.status = :status', { status: filters.status });
    }

    if (filters.startDate) {
      queryBuilder.andWhere('emergency_unstake.createdAt >= :startDate', { startDate: filters.startDate });
    }

    if (filters.endDate) {
      queryBuilder.andWhere('emergency_unstake.createdAt <= :endDate', { endDate: filters.endDate });
    }

    const total = await queryBuilder.getCount();
    const records = await queryBuilder
      .orderBy('emergency_unstake.createdAt', 'DESC')
      .skip((filters.page - 1) * filters.limit)
      .take(filters.limit)
      .getMany();

    return {
      data: records,
      pagination: {
        page: filters.page,
        limit: filters.limit,
        total,
        pages: Math.ceil(total / filters.limit)
      }
    };
  }
}