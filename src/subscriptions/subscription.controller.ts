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
  Req,
} from '@nestjs/common';
import { Request } from 'express';

import { SubscriptionService } from './subscription.service';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ValidateFilterDto } from './dto/validate-filter.dto';
import { AcknowledgeDto } from './dto/acknowledge.dto';

/**
 * Resolves the caller's user-id from the request.
 * In the current scaffold there is no auth middleware, so we fall back to a
 * header (`x-user-id`) that integration tests can set, or the string "anonymous".
 */
function resolveUserId(req: Request): string {
  const header = req.headers['x-user-id'];
  if (typeof header === 'string' && header.length > 0) return header;
  return 'anonymous';
}

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

  /**
   * Returns the catalogue of known event type identifiers that a
   * subscription filter may reference.
   */
  @Get('event-types')
  getEventTypes() {
    return this.subscriptionService.getEventTypes();
  }

  // ------------------------------------------------------------------
  // 2. Create a subscription  POST /api/subscriptions
  // ------------------------------------------------------------------

  /**
   * Creates a new subscription for the requesting user.
   * Returns the created subscription object with its assigned id.
   */
  @Post('subscriptions')
  @HttpCode(HttpStatus.CREATED)
  createSubscription(@Req() req: Request, @Body() dto: CreateSubscriptionDto) {
    const userId = resolveUserId(req);
    return this.subscriptionService.createSubscription(userId, dto);
  }

  // ------------------------------------------------------------------
  // 3. List subscriptions  GET /api/subscriptions
  // ------------------------------------------------------------------

  /**
   * Returns all subscriptions belonging to the requesting user.
   */
  @Get('subscriptions')
  listSubscriptions(@Req() req: Request) {
    const userId = resolveUserId(req);
    return this.subscriptionService.listSubscriptions(userId);
  }

  // ------------------------------------------------------------------
  // 4. Validate a filter  POST /api/subscriptions/validate-filter
  //    (declared BEFORE :subscription_id routes to prevent routing clash)
  // ------------------------------------------------------------------

  /**
   * Validates an EventFilterDto and returns a compiled summary on success,
   * or a list of validation errors on failure.
   */
  @Post('subscriptions/validate-filter')
  @HttpCode(HttpStatus.OK)
  validateFilter(@Body() dto: ValidateFilterDto) {
    return this.subscriptionService.validateFilter(dto.filter);
  }

  // ------------------------------------------------------------------
  // 5. Update a subscription  PUT /api/subscriptions/:subscription_id
  // ------------------------------------------------------------------

  /**
   * Partially updates subscription preferences for the given id.
   * Only fields present in the request body are modified.
   */
  @Put('subscriptions/:subscription_id')
  updateSubscription(
    @Req() req: Request,
    @Param('subscription_id') subscriptionId: string,
    @Body() dto: UpdateSubscriptionDto,
  ) {
    const userId = resolveUserId(req);
    return this.subscriptionService.updateSubscription(userId, subscriptionId, dto);
  }

  // ------------------------------------------------------------------
  // 6. Delete a subscription  DELETE /api/subscriptions/:subscription_id
  // ------------------------------------------------------------------

  /**
   * Removes the subscription and all associated delivery records.
   */
  @Delete('subscriptions/:subscription_id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteSubscription(
    @Req() req: Request,
    @Param('subscription_id') subscriptionId: string,
  ) {
    const userId = resolveUserId(req);
    this.subscriptionService.deleteSubscription(userId, subscriptionId);
  }

  // ------------------------------------------------------------------
  // 7. Delivery status  GET /api/subscriptions/:subscription_id/delivery-status
  // ------------------------------------------------------------------

  /**
   * Returns aggregated delivery statistics and individual delivery records
   * for the given subscription.
   */
  @Get('subscriptions/:subscription_id/delivery-status')
  getDeliveryStatus(
    @Req() req: Request,
    @Param('subscription_id') subscriptionId: string,
  ) {
    const userId = resolveUserId(req);
    return this.subscriptionService.getDeliveryStatus(userId, subscriptionId);
  }

  // ------------------------------------------------------------------
  // 8. Acknowledge events  POST /api/subscriptions/:subscription_id/acknowledge
  // ------------------------------------------------------------------

  /**
   * Marks one or more delivered events as acknowledged, stopping further
   * retry attempts for those event IDs.
   */
  @Post('subscriptions/:subscription_id/acknowledge')
  @HttpCode(HttpStatus.OK)
  acknowledge(
    @Req() req: Request,
    @Param('subscription_id') subscriptionId: string,
    @Body() dto: AcknowledgeDto,
  ) {
    const userId = resolveUserId(req);
    return this.subscriptionService.acknowledgeEvents(userId, subscriptionId, dto.eventIds);
  }
}
