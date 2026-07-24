import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { EmergencyUnstakeService } from './emergency-unstake.service';
import { EmergencyUnstake } from './entities/emergency-unstake.entity';
import { ContractsService } from '../contracts/contracts.service';

describe('EmergencyUnstakeService', () => {
  let service: EmergencyUnstakeService;

  const mockRepository = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    save: jest.fn(),
    createQueryBuilder: jest.fn(() => ({
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(1),
      getMany: jest.fn().mockResolvedValue([]),
    })),
  };

  const mockContractsService = {
    getStakingPosition: jest.fn(),
    processEmergencyWithdrawal: jest.fn(),
    addStakingPosition: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmergencyUnstakeService,
        {
          provide: getRepositoryToken(EmergencyUnstake),
          useValue: mockRepository,
        },
        {
          provide: ContractsService,
          useValue: mockContractsService,
        },
      ],
    }).compile();

    service = module.get<EmergencyUnstakeService>(EmergencyUnstakeService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate penalty correctly', () => {
    const now = new Date();
    const unlockDate = new Date();
    unlockDate.setDate(now.getDate() + 90);
    
    const penalty = service.calculatePenalty(now, unlockDate);
    expect(penalty).toBeGreaterThan(0);
    expect(penalty).toBeLessThanOrEqual(0.25);
  });

  it('should return 0 penalty when lockup has expired', () => {
    const now = new Date();
    const unlockDate = new Date();
    unlockDate.setDate(now.getDate() - 1);
    
    const penalty = service.calculatePenalty(now, unlockDate);
    expect(penalty).toBe(0);
  });
});