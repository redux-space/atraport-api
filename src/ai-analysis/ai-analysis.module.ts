import { Module } from "@nestjs/common";
import { AIAnalysisController } from "./ai-analysis.controller";
import { AIAnalysisService } from "./ai-analysis.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { AIAnalysis } from "./entities/ai-analysis.entity";

@Module({
  imports: [TypeOrmModule.forFeature([AIAnalysis])],
  controllers: [AIAnalysisController],
  providers: [AIAnalysisService],
})
export class AIAnalysisModule {}
