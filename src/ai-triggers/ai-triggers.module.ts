import { Module } from "@nestjs/common";
import { AITriggerController } from "./ai-triggers.controller";
import { AITriggersService } from "./ai-triggers.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AITrigger } from "./entities/ai-trigger.entity";
import { WebhookModule } from "../webhook/webhook.module";
import { AIModule } from "../ai/ai.module";
import { AIAnalysis } from "../ai-analysis/entities/ai-analysis.entity";

@Module({
  imports: [
    TypeOrmModule.forFeature([AITrigger, AIAnalysis]),
    WebhookModule,
    AIModule,
  ],
  controllers: [AITriggerController],
  providers: [AITriggersService],
})
export class AITriggersModule {}
