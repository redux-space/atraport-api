import { Controller, Get, Param } from "@nestjs/common";
import { AIAnalysisService } from "./ai-analysis.service";
import { AnalysisResultDto } from "./dto/analysis-result.dto";
import { RecommendationDto } from "./dto/recommendation.dto";

@Controller("api/ai-analysis")
export class AIAnalysisController {
  constructor(private readonly aiAnalysisService: AIAnalysisService) {}

  @Get("results/:analysis_id")
  async getAnalysisResults(
    @Param("analysis_id") analysisId: string,
  ): Promise<AnalysisResultDto> {
    const analysis =
      await this.aiAnalysisService.getAnalysisResults(analysisId);
    return {
      analysisId: analysis.analysisId,
      results: analysis.results,
    };
  }

  @Get("recommendations/:portfolio_id")
  getRecommendations(
    @Param("portfolio_id") portfolioId: string,
  ): RecommendationDto {
    return this.aiAnalysisService.getRecommendations(portfolioId);
  }
}
