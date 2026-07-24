import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RiskModule } from './risk/risk.module';
import { ContractsModule } from './contracts/contracts.module';
import { StakingModule } from './staking/staking.module';
import { EmergencyUnstake } from './staking/entities/emergency-unstake.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: 'localhost',
      port: 5432,
      username: 'postgres',
      password: 'password',
      database: 'astraport',
      entities: [EmergencyUnstake],
      synchronize: true,
    }),
    AuthModule, 
    PortfolioModule, 
    RiskModule, 
    ContractsModule,
    StakingModule
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}