import { BadRequestException } from '@nestjs/common';
import { RebalancingScheduleService } from './rebalancing.service';
import { RebalancingSchedule } from './dto/rebalancing.dto';

describe('RebalancingScheduleService', () => {
  let service: RebalancingScheduleService;

  beforeEach(() => {
    service = new RebalancingScheduleService();
  });

  it('creates and retrieves a valid schedule', () => {
    const schedule: RebalancingSchedule = {
      portfolioId: 'portfolio-1',
      enabled: true,
      intervalMinutes: 30,
      startAt: '2026-07-23T10:00:00.000Z',
      timezone: 'UTC',
    };

    const created = service.createSchedule(schedule);
    const fetched = service.getSchedule('portfolio-1');

    expect(created.portfolioId).toBe('portfolio-1');
    expect(fetched?.enabled).toBe(true);
    expect(fetched?.intervalMinutes).toBe(30);
  });

  it('rejects invalid schedules', () => {
    expect(() => service.createSchedule({
      portfolioId: 'portfolio-2',
      enabled: true,
      intervalMinutes: 0,
      startAt: '2026-07-23T10:00:00.000Z',
      timezone: 'UTC',
    })).toThrow(BadRequestException);
  });

  it('stores manual execution history without removing scheduled runs', () => {
    service.createSchedule({
      portfolioId: 'portfolio-3',
      enabled: true,
      intervalMinutes: 60,
      startAt: '2026-07-23T10:00:00.000Z',
      timezone: 'UTC',
    });

    const execution = service.executeNow('portfolio-3', 'manual');

    expect(execution.success).toBe(true);
    expect(execution.history.length).toBe(1);
    expect(service.getExecutionHistory('portfolio-3').length).toBe(1);
    expect(service.getSchedule('portfolio-3')?.enabled).toBe(true);
  });

  it('calculates the next execution time from the configured interval', () => {
    const schedule = service.createSchedule({
      portfolioId: 'portfolio-4',
      enabled: true,
      intervalMinutes: 15,
      startAt: '2026-07-23T10:00:00.000Z',
      timezone: 'UTC',
    });

    const nextRun = service.getNextExecution('portfolio-4');

    expect(nextRun?.portfolioId).toBe('portfolio-4');
    expect(nextRun?.nextExecutionAt).toBeDefined();
    expect(new Date(nextRun!.nextExecutionAt).getTime()).toBeGreaterThan(new Date(schedule.startAt).getTime());
  });
});
