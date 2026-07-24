import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmergencyUnstakeController } from './emergency-unstake.controller';
import { EmergencyUnstakeService } from './emergency-unstake.service';
import { EmergencyUnstake } from './entities/emergency-unstake.entity';
import { ContractsModule } from '../contracts/contracts.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([EmergencyUnstake]),
    ContractsModule
  ],
  controllers: [EmergencyUnstakeController],
  providers: [EmergencyUnstakeService],
  exports: [EmergencyUnstakeService]
})
export class StakingModule {}