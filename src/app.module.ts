import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PortfolioModule } from './portfolio/portfolio.module';
import { RiskModule } from './risk/risk.module';
import { ContractsModule } from './contracts/contracts.module';
import { RebalancingModule } from './rebalancing/rebalancing.module';

@Module({
  imports: [AuthModule, PortfolioModule, RiskModule, ContractsModule, RebalancingModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
