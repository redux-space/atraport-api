import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bull';
import { QueueService } from './services/queue.service';
import { QueueController } from './controllers/queue.controller';
import { JobProcessor } from './processors/job.processor';
import { QueueMetricsService } from './services/queue-metrics.service';
import { DeadLetterProcessor } from './processors/dead-letter.processor';

@Module({
  imports: [
    BullModule.forRoot({
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT) || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
      },
    }),
    BullModule.registerQueue(
      { name: 'default-queue' },
      { name: 'high-priority-queue' },
      { name: 'low-priority-queue' },
      { name: 'dead-letter-queue' },
    ),
  ],
  providers: [
    QueueService,
    QueueMetricsService,
    JobProcessor,
    DeadLetterProcessor,
  ],
  controllers: [QueueController],
  exports: [QueueService],
})
export class QueueModule {}
