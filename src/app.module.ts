import { Module } from "@nestjs/common";
import { APP_INTERCEPTOR } from "@nestjs/core";
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
import { FilesModule } from "./files/files.module";
import { SubscriptionModule } from "./subscriptions/subscription.module";
import { AuditLogModule } from "./audit-log/audit-log.module";
import { MonitoringModule } from "./monitoring/monitoring.module";
import { MetricsInterceptor } from "./monitoring/interceptors/metrics.interceptor";
import { TypeOrmModule } from "@nestjs/typeorm";
import { LoggingModule } from "./logging/logging.module";
import { DocumentationModule } from "./docs/documentation.module";

@Module({
  imports: [
    // LoggingModule MUST come first so the global logger + filter are ready
    // before any other module's providers are initialised.
    LoggingModule,
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
    // AuthModule registers global JWT + Roles guards via APP_GUARD
    AuthModule,
    PortfolioModule,
    RiskModule,
    ContractsModule,
    AITriggersModule,
    AIAnalysisModule,
    WebhookModule,
    SubscriptionModule,
    AIModule,
    RebalancingModule,
    FilesModule,
    SubscriptionModule,
    AuditLogModule,
    MonitoringModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
