import { Injectable, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';
import { JobData, JobPriority, JobStatus, JobResult } from '../interfaces/job.interface';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('default-queue') private defaultQueue: Queue,
    @InjectQueue('high-priority-queue') private highPriorityQueue: Queue,
    @InjectQueue('low-priority-queue') private lowPriorityQueue: Queue,
    @InjectQueue('dead-letter-queue') private deadLetterQueue: Queue,
  ) {}

  /**
   * Add a job to the queue
   */
  async addJob(
    type: string,
    payload: any,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      timeout?: number;
      delay?: number;
      scheduledAt?: Date;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<string> {
    const jobId = uuidv4();

    const jobData: JobData = {
      id: jobId,
      type,
      payload,
      priority: options.priority || JobPriority.MEDIUM,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      scheduledAt: options.scheduledAt,
      metadata: options.metadata,
    };

    // Determine which queue to use based on priority
    const queue = this.getQueueForPriority(options.priority || JobPriority.MEDIUM);

    const bullJob = await queue.add(type, jobData, {
      jobId,
      priority: this.getBullPriority(options.priority || JobPriority.MEDIUM),
      attempts: options.maxRetries || 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      timeout: options.timeout || 30000,
      delay: options.delay || 0,
    });

    this.logger.log(`Job ${jobId} added to queue: ${type}`);
    return jobId;
  }

  /**
   * Schedule a job with cron expression
   */
  async scheduleJob(
    type: string,
    payload: any,
    cronExpression: string,
    options: {
      priority?: JobPriority;
      maxRetries?: number;
      timeout?: number;
      metadata?: Record<string, any>;
    } = {},
  ): Promise<string> {
    const jobId = uuidv4();

    const jobData: JobData = {
      id: jobId,
      type,
      payload,
      priority: options.priority || JobPriority.MEDIUM,
      retryCount: 0,
      maxRetries: options.maxRetries || 3,
      timeout: options.timeout || 30000,
      metadata: options.metadata,
    };

    // Add job with cron expression
    // Note: Bull doesn't natively support cron, we'll use a separate scheduler
    // For this implementation, we'll store the cron expression and use a cron job to trigger it
    const queue = this.getQueueForPriority(options.priority || JobPriority.MEDIUM);

    const bullJob = await queue.add(type, {
      ...jobData,
      scheduled: true,
      cronExpression,
    }, {
      jobId,
      priority: this.getBullPriority(options.priority || JobPriority.MEDIUM),
      attempts: options.maxRetries || 3,
      backoff: {
        type: 'exponential',
        delay: 1000,
      },
      timeout: options.timeout || 30000,
    });

    this.logger.log(`Scheduled job ${jobId} with cron: ${cronExpression}`);
    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<JobStatus | null> {
    const queues = [this.defaultQueue, this.highPriorityQueue, this.lowPriorityQueue];

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        const state = await job.getState();
        switch (state) {
          case 'waiting':
          case 'delayed':
            return JobStatus.PENDING;
          case 'active':
            return JobStatus.PROCESSING;
          case 'completed':
            return JobStatus.COMPLETED;
          case 'failed':
            return JobStatus.FAILED;
          default:
            return JobStatus.PENDING;
        }
      }
    }

    return null;
  }

  /**
   * Cancel a job
   */
  async cancelJob(jobId: string): Promise<boolean> {
    const queues = [this.defaultQueue, this.highPriorityQueue, this.lowPriorityQueue];

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        await job.remove();
        this.logger.log(`Job ${jobId} cancelled`);
        return true;
      }
    }

    return false;
  }

  /**
   * Get job execution history
   */
  async getJobHistory(jobId: string): Promise<any[]> {
    const queues = [this.defaultQueue, this.highPriorityQueue, this.lowPriorityQueue];

    for (const queue of queues) {
      const job = await queue.getJob(jobId);
      if (job) {
        const { logs } = await queue.getJobLogs(jobId);
        return logs.map((log) => ({
          timestamp: new Date(),
          message: log,
        }));
      }
    }

    return [];
  }

  /**
   * Get queue metrics
   */
  async getQueueMetrics(): Promise<any> {
    const metrics = {};

    const queueConfigs = [
      { name: 'default', queue: this.defaultQueue },
      { name: 'high-priority', queue: this.highPriorityQueue },
      { name: 'low-priority', queue: this.lowPriorityQueue },
    ];

    for (const config of queueConfigs) {
      metrics[config.name] = {
        waiting: await config.queue.getWaitingCount(),
        active: await config.queue.getActiveCount(),
        completed: await config.queue.getCompletedCount(),
        failed: await config.queue.getFailedCount(),
        delayed: await config.queue.getDelayedCount(),
      };
    }

    return metrics;
  }

  /**
   * Get queue for priority
   */
  private getQueueForPriority(priority: JobPriority): Queue {
    if (priority === JobPriority.HIGH) {
      return this.highPriorityQueue;
    } else if (priority === JobPriority.LOW) {
      return this.lowPriorityQueue;
    }
    return this.defaultQueue;
  }

  /**
   * Convert JobPriority to Bull priority
   */
  private getBullPriority(priority: JobPriority): number {
    switch (priority) {
      case JobPriority.HIGH:
        return 1;
      case JobPriority.MEDIUM:
        return 3;
      case JobPriority.LOW:
        return 5;
      default:
        return 3;
    }
  }
}
