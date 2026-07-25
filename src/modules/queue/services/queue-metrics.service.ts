import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bull';
import { Queue } from 'bull';

@Injectable()
export class QueueMetricsService implements OnModuleInit {
  private readonly logger = new Logger(QueueMetricsService.name);

  constructor(
    @InjectQueue('default-queue') private defaultQueue: Queue,
    @InjectQueue('high-priority-queue') private highPriorityQueue: Queue,
    @InjectQueue('low-priority-queue') private lowPriorityQueue: Queue,
  ) {}

  onModuleInit() {
    // Start periodic metrics logging
    setInterval(() => this.logMetrics(), 60000); // Every minute
  }

  async logMetrics(): Promise<void> {
    const metrics = await this.collectMetrics();
    this.logger.log(`Queue Metrics: ${JSON.stringify(metrics)}`);
  }

  async collectMetrics(): Promise<any> {
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
        total: await config.queue.getJobCounts(),
      };
    }

    return metrics;
  }

  async getJobCounts(queueName: string): Promise<any> {
    const queue = this.getQueueByName(queueName);
    if (!queue) {
      throw new Error(`Queue ${queueName} not found`);
    }
    return queue.getJobCounts();
  }

  private getQueueByName(name: string): Queue | null {
    switch (name) {
      case 'default':
        return this.defaultQueue;
      case 'high-priority':
        return this.highPriorityQueue;
      case 'low-priority':
        return this.lowPriorityQueue;
      default:
        return null;
    }
  }
}
