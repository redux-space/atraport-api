import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { DriftCalculatorService } from './drift-calculator.service';
import {
  AcknowledgeAlertDto,
  DriftConfigRequestDto,
  DriftStatusRequestDto,
  DriftWebhookRegistrationDto,
} from './dto/drift.dto';

/**
 * DriftDetectionController
 *
 * Exposes all drift monitoring endpoints under /api/rebalancing.
 *
 * Endpoints:
 *   GET    /drift-status/:portfolio_id      — current drift metrics
 *   POST   /drift-config                   — create drift threshold config
 *   PUT    /drift-config/:portfolio_id     — update drift threshold config
 *   GET    /drift-history/:portfolio_id    — historical drift snapshots
 *   GET    /drift-alerts                   — active drift alerts (optional ?portfolioId filter)
 *   POST   /drift-alerts/:alert_id/acknowledge — acknowledge a drift alert
 *   GET    /drift-analysis                 — detailed drift analysis (requires ?portfolioId + body assets)
 *   POST   /drift-webhooks                 — register webhook for drift notifications
 */
@Controller('api/rebalancing')
export class DriftDetectionController {
  constructor(private readonly driftService: DriftCalculatorService) {}

  /**
   * GET /api/rebalancing/drift-status/:portfolio_id
   *
   * Returns current drift metrics for the given portfolio.
   * Accepts asset snapshot data as a JSON body alongside the route param.
   * In a production system the assets would be fetched from the portfolio service;
   * here the caller provides the snapshot so the endpoint remains stateless.
   */
  @Get('drift-status/:portfolio_id')
  getDriftStatus(
    @Param('portfolio_id') portfolioId: string,
    @Body() body: DriftStatusRequestDto,
  ) {
    return this.driftService.calculateDrift(portfolioId, body.assets ?? []);
  }

  /**
   * POST /api/rebalancing/drift-config
   *
   * Creates drift threshold configuration for a portfolio.
   */
  @Post('drift-config')
  createDriftConfig(@Body() dto: DriftConfigRequestDto) {
    return this.driftService.createConfig(dto);
  }

  /**
   * PUT /api/rebalancing/drift-config/:portfolio_id
   *
   * Updates drift threshold configuration for a portfolio.
   */
  @Put('drift-config/:portfolio_id')
  updateDriftConfig(
    @Param('portfolio_id') portfolioId: string,
    @Body() dto: Partial<DriftConfigRequestDto>,
  ) {
    return this.driftService.updateConfig(portfolioId, dto);
  }

  /**
   * GET /api/rebalancing/drift-history/:portfolio_id
   *
   * Returns historical drift snapshots.
   * Optional query param: limit (default 100)
   */
  @Get('drift-history/:portfolio_id')
  getDriftHistory(
    @Param('portfolio_id') portfolioId: string,
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    return {
      portfolioId,
      history: this.driftService.getHistory(portfolioId, parsedLimit),
    };
  }

  /**
   * GET /api/rebalancing/drift-alerts
   *
   * Returns all active (unacknowledged) drift alerts.
   * Optional query param: portfolioId — filter by portfolio
   */
  @Get('drift-alerts')
  getDriftAlerts(@Query('portfolioId') portfolioId?: string) {
    const alerts = this.driftService.getActiveAlerts(portfolioId);
    return {
      count: alerts.length,
      alerts,
    };
  }

  /**
   * POST /api/rebalancing/drift-alerts/:alert_id/acknowledge
   *
   * Acknowledges a drift alert, removing it from active alert lists.
   */
  @Post('drift-alerts/:alert_id/acknowledge')
  acknowledgeAlert(
    @Param('alert_id') alertId: string,
    @Body() dto: AcknowledgeAlertDto,
  ) {
    return this.driftService.acknowledgeAlert(alertId, dto);
  }

  /**
   * GET /api/rebalancing/drift-analysis
   *
   * Returns detailed drift analysis including trend, projections, and recommendations.
   * Required query params: portfolioId
   * Optional query param: periodDays (default 30)
   * Accepts asset snapshot in request body.
   */
  @Get('drift-analysis')
  getDriftAnalysis(
    @Query('portfolioId') portfolioId: string,
    @Query('periodDays') periodDays: string,
    @Body() body: DriftStatusRequestDto,
  ) {
    const days = periodDays ? parseInt(periodDays, 10) : 30;
    return this.driftService.analysePortfolio(
      portfolioId ?? body.portfolioId,
      body.assets ?? [],
      days,
    );
  }

  /**
   * POST /api/rebalancing/drift-webhooks
   *
   * Registers a webhook URL to receive drift event notifications.
   */
  @Post('drift-webhooks')
  registerDriftWebhook(@Body() dto: DriftWebhookRegistrationDto) {
    return this.driftService.registerWebhook(dto);
  }
}
