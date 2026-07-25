import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { JobData, JobResult, JobStatus } from '../interfaces/job.interface';

@Processor('default-queue')
export class JobProcessor {
  private readonly logger = new Logger(JobProcessor.name);

  @Process('*')
  async handleJob(job: Job<JobData>): Promise<JobResult> {
    const startTime = Date.now();

    try {
      this.logger.log(`Processing job ${job.id}: ${job.data.type}`);

      // Process the job based on type
      const result = await this.processJob(job.data);

      this.logger.log(`Job ${job.id} completed successfully`);

      return {
        success: true,
        data: result,
        processedAt: new Date(),
        processingTime: Date.now() - startTime,
      };
    } catch (error) {
      this.logger.error(`Job ${job.id} failed: ${error.message}`);
      throw error;
    }
  }

  private async processJob(data: JobData): Promise<any> {
    // Simulate different job types
    switch (data.type) {
      case 'email':
        return this.processEmailJob(data.payload);
      case 'webhook':
        return this.processWebhookJob(data.payload);
      case 'report':
        return this.processReportJob(data.payload);
      case 'sync':
        return this.processSyncJob(data.payload);
      default:
        throw new Error(`Unknown job type: ${data.type}`);
    }
  }

  private async processEmailJob(payload: any): Promise<any> {
    this.logger.log(`Sending email to ${payload.to}`);
    // Simulate email sending
    await this.sleep(1000);
    return { sent: true, to: payload.to };
  }

  private async processWebhookJob(payload: any): Promise<any> {
    this.logger.log(`Sending webhook to ${payload.url}`);
    // Simulate webhook delivery
    await this.sleep(500);
    return { delivered: true, url: payload.url };
  }

  private async processReportJob(payload: any): Promise<any> {
    this.logger.log(`Generating report: ${payload.reportType}`);
    // Simulate report generation
    await this.sleep(2000);
    return { generated: true, reportId: 'rep_' + Date.now() };
  }

  private async processSyncJob(payload: any): Promise<any> {
    this.logger.log(`Syncing data for ${payload.source}`);
    // Simulate data sync
    await this.sleep(1500);
    return { synced: true, records: payload.records || 0 };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

@Processor('high-priority-queue')
export class HighPriorityJobProcessor extends JobProcessor {}

@Processor('low-priority-queue')
export class LowPriorityJobProcessor extends JobProcessor {}
