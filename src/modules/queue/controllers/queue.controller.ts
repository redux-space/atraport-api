import { Controller, Post, Get, Body, Param, Delete, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { QueueService } from '../services/queue.service';
import { CreateJobDto, ScheduleJobDto, JobResponseDto, QueueMetricsDto } from '../dto';

@ApiTags('queue')
@Controller('queue')
export class QueueController {
  constructor(private readonly queueService: QueueService) {}

  @Post('jobs')
  @ApiOperation({ summary: 'Add a job to the queue' })
  @ApiResponse({ status: 201, description: 'Job added successfully' })
  async addJob(@Body() createJobDto: CreateJobDto): Promise<{ jobId: string }> {
    const jobId = await this.queueService.addJob(
      createJobDto.type,
      createJobDto.payload,
      {
        priority: createJobDto.priority,
        maxRetries: createJobDto.maxRetries,
        timeout: createJobDto.timeout,
        delay: createJobDto.delay,
        metadata: createJobDto.metadata,
      },
    );
    return { jobId };
  }

  @Post('jobs/schedule')
  @ApiOperation({ summary: 'Schedule a job with cron expression' })
  @ApiResponse({ status: 201, description: 'Job scheduled successfully' })
  async scheduleJob(@Body() scheduleJobDto: ScheduleJobDto): Promise<{ jobId: string }> {
    const jobId = await this.queueService.scheduleJob(
      scheduleJobDto.type,
      scheduleJobDto.payload,
      scheduleJobDto.cronExpression,
      {
        priority: scheduleJobDto.priority,
        maxRetries: scheduleJobDto.maxRetries,
        timeout: scheduleJobDto.timeout,
        metadata: scheduleJobDto.metadata,
      },
    );
    return { jobId };
  }

  @Get('jobs/:id/status')
  @ApiOperation({ summary: 'Get job status' })
  @ApiResponse({ status: 200, description: 'Job status retrieved' })
  async getJobStatus(@Param('id') id: string): Promise<{ status: string }> {
    const status = await this.queueService.getJobStatus(id);
    return { status };
  }

  @Get('jobs/:id/history')
  @ApiOperation({ summary: 'Get job execution history' })
  @ApiResponse({ status: 200, description: 'Job history retrieved' })
  async getJobHistory(@Param('id') id: string): Promise<any[]> {
    return this.queueService.getJobHistory(id);
  }

  @Delete('jobs/:id')
  @ApiOperation({ summary: 'Cancel a job' })
  @ApiResponse({ status: 200, description: 'Job cancelled successfully' })
  async cancelJob(@Param('id') id: string): Promise<{ success: boolean }> {
    const success = await this.queueService.cancelJob(id);
    return { success };
  }

  @Get('metrics')
  @ApiOperation({ summary: 'Get queue metrics' })
  @ApiResponse({ status: 200, description: 'Queue metrics retrieved' })
  async getMetrics(): Promise<any> {
    return this.queueService.getQueueMetrics();
  }
}
