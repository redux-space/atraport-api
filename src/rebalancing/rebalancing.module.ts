import { Module } from '@nestjs/common';
import { RebalancingScheduleController } from './rebalancing.controller';
import { RebalancingScheduleService } from './rebalancing.service';

@Module({
  controllers: [RebalancingScheduleController],
  providers: [RebalancingScheduleService],
  exports: [RebalancingScheduleService],
})
export class RebalancingModule {}
