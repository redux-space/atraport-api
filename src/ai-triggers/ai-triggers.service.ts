import { Injectable } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { TriggerConfigDto } from "./dto/trigger-config.dto";
import { AITrigger } from "./entities/ai-trigger.entity";
import { WebhookService } from "../webhook/webhook.service";
import { AIService } from "../ai/ai.service";
import { AIAnalysis } from "../ai-analysis/entities/ai-analysis.entity";

@Injectable()
export class AITriggersService {
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

  findAll(): Promise<AITrigger[]> {
    return this.aiTriggerRepository.find();
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
