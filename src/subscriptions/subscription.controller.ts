import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
} from '@nestjs/common';

import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ValidateFilterDto } from './dto/validate-filter.dto';
import { AcknowledgeDto } from './dto/acknowledge.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { PaginationQueryDto } from '../pagination/dto/pagination-query.dto';

@Controller('api')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  @Get('event-types')
  getEventTypes() {
    return this.subscriptionService.getEventTypes();
  }

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(user.id, dto);
  }

  @Get('subscriptions')
  listSubscriptions(
    @CurrentUser() user: { id: string },
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.subscriptionService.listSubscriptions(user.id, pagination);
  }

  @Post('subscriptions/validate-filter')
  @HttpCode(HttpStatus.OK)
  validateFilter(@Body() dto: ValidateFilterDto) {
    return this.subscriptionService.validateFilter(dto.filter);
  }

  @Put('subscriptions/:subscription_id')
  updateSubscription(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(user.id, subscriptionId, dto);
  }

  @Delete('subscriptions/:subscription_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubscription(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
  ) {
    this.subscriptionService.deleteSubscription(user.id, subscriptionId);
  }

  @Get('subscriptions/:subscription_id/delivery-status')
  getDeliveryStatus(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
  ) {
    return this.subscriptionService.getDeliveryStatus(user.id, subscriptionId);
  }

  @Post('subscriptions/:subscription_id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
    @Body() dto: AcknowledgeDto,
  ) {
    return this.subscriptionService.acknowledgeEvents(user.id, subscriptionId, dto.eventIds);
  }
}
