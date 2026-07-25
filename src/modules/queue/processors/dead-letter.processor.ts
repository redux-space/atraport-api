import { Processor, Process } from '@nestjs/bull';
import { Job } from 'bull';
import { Logger } from '@nestjs/common';
import { JobData } from '../interfaces/job.interface';

@Processor('dead-letter-queue')
export class DeadLetterProcessor {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  @Process('*')
  async handleDeadLetterJob(job: Job<JobData>): Promise<void> {
    this.logger.error(`Dead letter job ${job.id}: ${job.data.type}`);

    // Log the failed job
    this.logger.error(`Job data: ${JSON.stringify(job.data)}`);
    this.logger.error(`Job attempts: ${job.attemptsMade}`);

    // Store in database for manual review
    await this.storeDeadLetter(job);

    // Send alert notification
    await this.sendAlert(job);
  }

  private async storeDeadLetter(job: Job<JobData>): Promise<void> {
    // Store in database for manual review
    this.logger.log(`Storing dead letter job ${job.id} in database`);
    // Simulate database storage
  }

  private async sendAlert(job: Job<JobData>): Promise<void> {
    // Send alert to admin
    this.logger.warn(`Alert: Job ${job.id} moved to dead letter queue`);
    // Simulate alert sending
  }
}
