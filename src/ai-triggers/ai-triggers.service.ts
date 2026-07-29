import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TriggerConfigDto } from "./dto/trigger-config.dto";
import { AITrigger } from "./entities/ai-trigger.entity";
import { WebhookService } from "../webhook/webhook.service";
import { AIService } from "../ai/ai.service";
import { AIAnalysis } from "../ai-analysis/entities/ai-analysis.entity";
import { PaginationQueryDto } from "../pagination/dto/pagination-query.dto";
import { applyOffsetPagination, applySorting, applyCursorPagination } from "../pagination/helpers/pagination-query-builder.helper";
import { createOffsetPaginatedResponse, createCursorPaginatedResponse } from "../pagination/helpers/pagination.helper";
import { CursorPaginationQueryDto } from "../pagination/dto/cursor-pagination-query.dto";

@Injectable()
export class AITriggersService {
  private readonly ALIAS = 'aiTrigger';

  constructor(
    @InjectRepository(AITrigger)
    private readonly aiTriggerRepository: Repository<AITrigger>,
    @InjectRepository(AIAnalysis)
    private readonly aiAnalysisRepository: Repository<AIAnalysis>,
    private readonly webhookService: WebhookService,
    private readonly aiService: AIService,
  ) {}

  async createTrigger(triggerConfig: TriggerConfigDto): Promise<AITrigger> {
    const newTrigger = this.aiTriggerRepository.create(triggerConfig);
    const savedTrigger = await this.aiTriggerRepository.save(newTrigger);
    await this.webhookService.sendWebhook(savedTrigger.target, savedTrigger);
    return savedTrigger;
  }

  async handleWebhook(data: any) {
    const analysis = await this.aiService.analyze(data);
    const newAnalysis = this.aiAnalysisRepository.create(analysis);
    return this.aiAnalysisRepository.save(newAnalysis);
  }

  async findAll(pagination: PaginationQueryDto) {
    const queryBuilder = this.aiTriggerRepository.createQueryBuilder(this.ALIAS);
    applySorting(queryBuilder, pagination.sortBy, pagination.sortOrder, this.ALIAS);
    applyOffsetPagination(queryBuilder, pagination.page, pagination.limit);

    const [items, total] = await queryBuilder.getManyAndCount();
    return createOffsetPaginatedResponse(items, total, pagination.page, pagination.limit);
  }

  async findAllCursor(pagination: CursorPaginationQueryDto) {
    const queryBuilder = this.aiTriggerRepository.createQueryBuilder(this.ALIAS);

    if (pagination.cursor) {
      applyCursorPagination(
        queryBuilder, pagination.cursor, pagination.sortField, pagination.sortOrder,
        pagination.limit, this.ALIAS, 'id',
      );
    } else {
      applySorting(queryBuilder, pagination.sortField, pagination.sortOrder, this.ALIAS);
      queryBuilder.take(pagination.limit + 1);
    }

    const results = await queryBuilder.getMany();
    const hasMore = results.length > pagination.limit;
    if (hasMore) {
      results.pop();
    }

    return createCursorPaginatedResponse(
      results, pagination.limit, pagination.sortField, hasMore,
      pagination.sortOrder === 'ASC',
    );
  }

  update(id: number, triggerConfig: TriggerConfigDto) {
    return this.aiTriggerRepository.update(id, triggerConfig);
  }

  remove(id: number) {
    return this.aiTriggerRepository.delete(id);
  }

  validateWebhookSignature(signature: string, data: any): boolean {
    return this.webhookService.validateSignature(signature, data);
  }
}
