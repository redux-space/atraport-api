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
} from '@nestjs/common';

import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ValidateFilterDto } from './dto/validate-filter.dto';
import { AcknowledgeDto } from './dto/acknowledge.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

/**
 * SubscriptionController — manages the event subscription lifecycle.
 *
 * All routes live under /api/subscriptions (or /api/event-types for the
 * event-types catalogue).
 */
@Controller('api')
export class SubscriptionController {
  constructor(private readonly subscriptionService: SubscriptionService) {}

  // ------------------------------------------------------------------
  // 1. List available event types  GET /api/event-types
  // ------------------------------------------------------------------

  @Get('event-types')
  getEventTypes() {
    return this.subscriptionService.getEventTypes();
  }

  // ------------------------------------------------------------------
  // 2. Create a subscription  POST /api/subscriptions
  // ------------------------------------------------------------------

  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(
    @CurrentUser() user: { id: string },
    @Body() dto: CreateSubscriptionDto,
  ) {
    return this.subscriptionService.createSubscription(user.id, dto);
  }

  // ------------------------------------------------------------------
  // 3. List subscriptions  GET /api/subscriptions
  // ------------------------------------------------------------------

  @Get('subscriptions')
  listSubscriptions(@CurrentUser() user: { id: string }) {
    return this.subscriptionService.listSubscriptions(user.id);
  }

  // ------------------------------------------------------------------
  // 4. Validate a filter  POST /api/subscriptions/validate-filter
  // ------------------------------------------------------------------

  @Post('subscriptions/validate-filter')
  @HttpCode(HttpStatus.OK)
  validateFilter(@Body() dto: ValidateFilterDto) {
    return this.subscriptionService.validateFilter(dto.filter);
  }

  // ------------------------------------------------------------------
  // 5. Update a subscription  PUT /api/subscriptions/:subscription_id
  // ------------------------------------------------------------------

  @Put('subscriptions/:subscription_id')
  updateSubscription(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    return this.subscriptionService.updateSubscription(user.id, subscriptionId, dto);
  }

  // ------------------------------------------------------------------
  // 6. Delete a subscription  DELETE /api/subscriptions/:subscription_id
  // ------------------------------------------------------------------

  @Delete('subscriptions/:subscription_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubscription(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
  ) {
    this.subscriptionService.deleteSubscription(user.id, subscriptionId);
  }

  // ------------------------------------------------------------------
  // 7. Delivery status  GET /api/subscriptions/:subscription_id/delivery-status
  // ------------------------------------------------------------------

  @Get('subscriptions/:subscription_id/delivery-status')
  getDeliveryStatus(
    @CurrentUser() user: { id: string },
    @Param('subscription_id') subscriptionId: string,
  ) {
    return this.subscriptionService.getDeliveryStatus(user.id, subscriptionId);
  }

  // ------------------------------------------------------------------
  // 8. Acknowledge events  POST /api/subscriptions/:subscription_id/acknowledge
  // ------------------------------------------------------------------

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
