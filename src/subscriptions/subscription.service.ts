import { Injectable, NotFoundException } from '@nestjs/common';
import { v4 as uuidv4 } from 'uuid';

import { DeliveryMode, EventFilterDto, EventSeverity } from './dto/event-filter.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { ValidateFilterResponseDto } from './dto/validate-filter.dto';
import { AcknowledgeResponseDto } from './dto/acknowledge.dto';
import { SubscriptionDto } from './dto/subscription.dto';
import { DeliveryOutcome, DeliveryRecordDto, DeliveryStatusDto } from './dto/delivery-status.dto';
import { SubscriptionEntity } from './entities/subscription.entity';
import { DeliveryRecordEntity } from './entities/delivery-record.entity';
import { PaginationQueryDto } from '../pagination/dto/pagination-query.dto';
import { createOffsetPaginatedResponse } from '../pagination/helpers/pagination.helper';

const AVAILABLE_EVENT_TYPES: string[] = [
  'portfolio.created',
  'portfolio.updated',
  'portfolio.deleted',
  'asset.price_change',
  'asset.added',
  'asset.removed',
  'risk.score_updated',
  'risk.threshold_breached',
  'contract.deployed',
  'contract.executed',
  'contract.failed',
  'transaction.confirmed',
  'transaction.failed',
];

const SEVERITY_RANK: Record<EventSeverity, number> = {
  [EventSeverity.LOW]: 0,
  [EventSeverity.MEDIUM]: 1,
  [EventSeverity.HIGH]: 2,
  [EventSeverity.CRITICAL]: 3,
};

const BASE_RETRY_DELAY_MS = 1_000;
const MAX_RETRY_ATTEMPTS = 5;

@Injectable()
export class SubscriptionService {
  private subscriptions = new Map<string, SubscriptionEntity>();
  private deliveryRecords = new Map<string, DeliveryRecordEntity>();

  createSubscription(userId: string, dto: CreateSubscriptionDto): SubscriptionDto {
    const entity: SubscriptionEntity = {
      id: uuidv4(),
      userId,
      name: dto.name,
      filter: dto.filter,
      deliveryMode: dto.deliveryMode ?? DeliveryMode.IMMEDIATE,
      batchIntervalSeconds: dto.batchIntervalSeconds ?? 0,
      callbackUrl: dto.callbackUrl ?? null,
      active: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.subscriptions.set(entity.id, entity);
    return this.toDto(entity);
  }

  listSubscriptions(userId: string, pagination?: PaginationQueryDto) {
    const allResults: SubscriptionDto[] = [];
    for (const sub of this.subscriptions.values()) {
      if (sub.userId === userId) {
        allResults.push(this.toDto(sub));
      }
    }

    if (!pagination) {
      return { data: allResults, meta: { total: allResults.length, page: 1, limit: allResults.length, totalPages: 1, hasNext: false, hasPrevious: false } };
    }

    const { page = 1, limit = 10, sortBy = 'createdAt', sortOrder = 'DESC' } = pagination;

    allResults.sort((a, b) => {
      const aVal = (a as any)[sortBy] ?? '';
      const bVal = (b as any)[sortBy] ?? '';
      const cmp = String(aVal).localeCompare(String(bVal));
      return sortOrder === 'ASC' ? cmp : -cmp;
    });

    const total = allResults.length;
    const start = (page - 1) * limit;
    const data = allResults.slice(start, start + limit);

    return createOffsetPaginatedResponse(data, total, page, limit);
  }

  listAllSubscriptions(): SubscriptionDto[] {
    return [...this.subscriptions.values()].map((sub) => this.toDto(sub));
  }

  listActiveSubscriptions(): SubscriptionDto[] {
    return this.listAllSubscriptions().filter((sub) => sub.active);
  }

  getSubscriptionById(subscriptionId: string): SubscriptionDto {
    const entity = this.subscriptions.get(subscriptionId);
    if (!entity) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }

    return this.toDto(entity);
  }

  getSubscription(userId: string, subscriptionId: string): SubscriptionDto {
    const entity = this.findOrThrow(userId, subscriptionId);
    return this.toDto(entity);
  }

  updateSubscription(
    userId: string,
    subscriptionId: string,
    dto: UpdateSubscriptionDto,
  ): SubscriptionDto {
    const entity = this.findOrThrow(userId, subscriptionId);

    if (dto.name !== undefined) entity.name = dto.name;
    if (dto.filter !== undefined) entity.filter = dto.filter;
    if (dto.deliveryMode !== undefined) entity.deliveryMode = dto.deliveryMode;
    if (dto.batchIntervalSeconds !== undefined) entity.batchIntervalSeconds = dto.batchIntervalSeconds;
    if (dto.callbackUrl !== undefined) entity.callbackUrl = dto.callbackUrl;
    if (dto.active !== undefined) entity.active = dto.active;
    entity.updatedAt = new Date();

    this.subscriptions.set(entity.id, entity);
    return this.toDto(entity);
  }

  deleteSubscription(userId: string, subscriptionId: string): void {
    this.findOrThrow(userId, subscriptionId);
    this.subscriptions.delete(subscriptionId);
    for (const [key, record] of this.deliveryRecords.entries()) {
      if (record.subscriptionId === subscriptionId) {
        this.deliveryRecords.delete(key);
      }
    }
  }

  getEventTypes(): { eventTypes: string[] } {
    return { eventTypes: [...AVAILABLE_EVENT_TYPES] };
  }

  validateFilter(filter: EventFilterDto): ValidateFilterResponseDto {
    const errors: string[] = [];

    if (!filter.eventTypes || filter.eventTypes.length === 0) {
      errors.push('filter.eventTypes must contain at least one event type');
    } else {
      const unknown = filter.eventTypes.filter(
        (t) => !AVAILABLE_EVENT_TYPES.includes(t),
      );
      if (unknown.length > 0) {
        errors.push(`Unknown event types: ${unknown.join(', ')}`);
      }
    }

    if (
      filter.minSeverity !== undefined &&
      !Object.values(EventSeverity).includes(filter.minSeverity)
    ) {
      errors.push(
        `Invalid minSeverity "${filter.minSeverity}". Must be one of: ${Object.values(EventSeverity).join(', ')}`,
      );
    }

    if (errors.length > 0) {
      return { valid: false, errors };
    }

    const compiledSummary = this.compileFilterSummary(filter);
    return { valid: true, compiledSummary };
  }

  private compileFilterSummary(filter: EventFilterDto): string {
    const parts: string[] = [];
    parts.push(`Event types: [${filter.eventTypes.join(', ')}]`);

    if (filter.minSeverity) {
      parts.push(`Minimum severity: ${filter.minSeverity}`);
    }

    if (filter.customPredicates && Object.keys(filter.customPredicates).length > 0) {
      const predicateStr = Object.entries(filter.customPredicates)
        .map(([k, v]) => `${k}=${v}`)
        .join(', ');
      parts.push(`Custom predicates: {${predicateStr}}`);
    }

    return parts.join(' | ');
  }

  matchesFilter(
    filter: EventFilterDto,
    event: { type: string; severity?: EventSeverity; metadata?: Record<string, string> },
  ): boolean {
    if (!filter.eventTypes.includes(event.type)) {
      return false;
    }

    if (filter.minSeverity && event.severity) {
      const minRank = SEVERITY_RANK[filter.minSeverity];
      const eventRank = SEVERITY_RANK[event.severity];
      if (eventRank < minRank) {
        return false;
      }
    }

    if (filter.customPredicates) {
      for (const [key, value] of Object.entries(filter.customPredicates)) {
        if (!event.metadata || event.metadata[key] !== value) {
          return false;
        }
      }
    }

    return true;
  }

  getDeliveryStatus(userId: string, subscriptionId: string): DeliveryStatusDto {
    this.findOrThrow(userId, subscriptionId);

    const records: DeliveryRecordEntity[] = [];
    for (const record of this.deliveryRecords.values()) {
      if (record.subscriptionId === subscriptionId) {
        records.push(record);
      }
    }

    records.sort((a, b) => {
      const ta = a.lastAttemptAt ?? a.firstAttemptAt ?? '';
      const tb = b.lastAttemptAt ?? b.firstAttemptAt ?? '';
      return tb.localeCompare(ta);
    });

    const summary = {
      pending: 0,
      delivered: 0,
      acknowledged: 0,
      failed: 0,
      retrying: 0,
    };
    for (const r of records) {
      if (r.outcome in summary) {
        (summary as Record<string, number>)[r.outcome]++;
      }
    }

    return {
      subscriptionId,
      summary,
      records: records.map(this.toDeliveryRecordDto),
    };
  }

  listDeliveryRecords(): DeliveryRecordDto[] {
    return [...this.deliveryRecords.values()].map(this.toDeliveryRecordDto);
  }

  recordDeliveryAttempt(
    subscriptionId: string,
    eventId: string,
    outcome: DeliveryOutcome,
  ): DeliveryRecordEntity {
    const key = `${subscriptionId}:${eventId}`;
    const now = new Date().toISOString();

    let record = this.deliveryRecords.get(key);
    if (!record) {
      record = {
        id: uuidv4(),
        subscriptionId,
        eventId,
        outcome,
        firstAttemptAt: now,
        lastAttemptAt: now,
        attemptCount: 1,
        nextRetryAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    } else {
      record.attemptCount += 1;
      record.lastAttemptAt = now;
      record.outcome = outcome;
      record.updatedAt = new Date();
    }

    if (outcome === DeliveryOutcome.RETRYING && record.attemptCount <= MAX_RETRY_ATTEMPTS) {
      const delayMs = BASE_RETRY_DELAY_MS * Math.pow(2, record.attemptCount - 1);
      record.nextRetryAt = new Date(Date.now() + delayMs).toISOString();
    } else {
      record.nextRetryAt = null;
    }

    if (outcome === DeliveryOutcome.RETRYING && record.attemptCount > MAX_RETRY_ATTEMPTS) {
      record.outcome = DeliveryOutcome.FAILED;
    }

    this.deliveryRecords.set(key, record);
    return record;
  }

  acknowledgeEvents(
    userId: string,
    subscriptionId: string,
    eventIds: string[],
  ): AcknowledgeResponseDto {
    this.findOrThrow(userId, subscriptionId);

    let acknowledgedCount = 0;
    const skippedIds: string[] = [];

    for (const eventId of eventIds) {
      const key = `${subscriptionId}:${eventId}`;
      const record = this.deliveryRecords.get(key);

      if (!record || record.outcome === DeliveryOutcome.ACKNOWLEDGED) {
        skippedIds.push(eventId);
        continue;
      }

      record.outcome = DeliveryOutcome.ACKNOWLEDGED;
      record.nextRetryAt = null;
      record.updatedAt = new Date();
      this.deliveryRecords.set(key, record);
      acknowledgedCount++;
    }

    return { acknowledgedCount, skippedIds };
  }

  private findOrThrow(userId: string, subscriptionId: string): SubscriptionEntity {
    const entity = this.subscriptions.get(subscriptionId);
    if (!entity || entity.userId !== userId) {
      throw new NotFoundException(`Subscription ${subscriptionId} not found`);
    }
    return entity;
  }

  private toDto(entity: SubscriptionEntity): SubscriptionDto {
    return {
      id: entity.id,
      userId: entity.userId,
      name: entity.name,
      filter: entity.filter,
      deliveryMode: entity.deliveryMode,
      batchIntervalSeconds: entity.batchIntervalSeconds,
      callbackUrl: entity.callbackUrl,
      active: entity.active,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
  }

  private toDeliveryRecordDto(record: DeliveryRecordEntity): DeliveryRecordDto {
    return {
      id: record.id,
      eventId: record.eventId,
      subscriptionId: record.subscriptionId,
      outcome: record.outcome,
      firstAttemptAt: record.firstAttemptAt ?? '',
      lastAttemptAt: record.lastAttemptAt ?? '',
      attemptCount: record.attemptCount,
      nextRetryAt: record.nextRetryAt,
    };
  }
}
