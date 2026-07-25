import { Module } from "@nestjs/common";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";
import { AuthModule } from "./auth/auth.module";
import { PortfolioModule } from "./portfolio/portfolio.module";
import { RiskModule } from "./risk/risk.module";
import { ContractsModule } from "./contracts/contracts.module";
import { AITriggersModule } from "./ai-triggers/ai-triggers.module";
import { AIAnalysisModule } from "./ai-analysis/ai-analysis.module";
import { WebhookModule } from "./webhook/webhook.module";
import { AIModule } from "./ai/ai.module";
import { RebalancingModule } from "./rebalancing/rebalancing.module";
import { TypeOrmModule } from "@nestjs/typeorm";

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "postgres",
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT, 10),
      username: process.env.DB_USERNAME,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_DATABASE,
      entities: [__dirname + "/**/*.entity{.ts,.js}"],
      synchronize: true,
    }),
    AuthModule,
    PortfolioModule,
    RiskModule,
    ContractsModule,
    AITriggersModule,
    AIAnalysisModule,
    WebhookModule,
    AIModule,
    RebalancingModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}