import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import {
  MultiAssetStakeRequest,
  MultiAssetWithdrawRequest
} from './dtos';

@Controller('api/staking')
export class MultiAssetStakingController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Post('stake-multi')
  stakeMulti(@Body() request: MultiAssetStakeRequest) {
    return this.portfolioService.stakeMulti(request);
  }

  @Post('withdraw-multi')
  withdrawMulti(@Body() request: MultiAssetWithdrawRequest) {
    return this.portfolioService.withdrawMulti(request);
  }

  @Get('portfolio')
  getPortfolio(@Query('stakerId') stakerId: string) {
    return this.portfolioService.getPortfolioView(stakerId);
  }

  @Get('positions/:stakerId')
  getPositions(@Param('stakerId') stakerId: string) {
    return this.portfolioService.getPositionsByStaker(stakerId);
  }

  @Get('yields/aggregated')
  getAggregatedYield(@Query('stakerId') stakerId: string) {
    return this.portfolioService.getAggregatedYield(stakerId);
  }

  @Get('assets')
  getAssets() {
    return this.portfolioService.getAssetList();
  }

  @Get('asset/:assetId/rates')
  getAssetRates(@Param('assetId') assetId: string) {
    return this.portfolioService.getAssetRates(assetId);
  }

  @Post('portfolio/optimize')
  optimizePortfolio(@Body('stakerId') stakerId: string) {
    return this.portfolioService.getPortfolioView(stakerId).then((view) => view.optimizedAllocation);
  }
}
