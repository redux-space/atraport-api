import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { QueueController } from './queue.controller';
import { QueueService } from '../services/queue.service';
import { GlobalExceptionFilter } from '../../../logging/filters/global-exception.filter';
import { ConflictError, ResourceNotFoundError } from '../../../logging/errors/app.errors';

/**
 * Integration-style tests for QueueController.
 *
 * Verifies that the typed errors raised by QueueService.cancelJob() are mapped to
 * the correct HTTP status codes by the app's GlobalExceptionFilter — i.e. that a
 * client sees 409/404 rather than the raw 500 the issue reported.
 */
describe('QueueController (cancel status mapping)', () => {
  let app: INestApplication;
  let queueService: { cancelJob: jest.Mock };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    verbose: jest.fn(),
    http: jest.fn(),
    logError: jest.fn(),
    logPerformance: jest.fn(),
  };

  const mockErrorTracking = {
    captureException: jest.fn(),
    captureMessage: jest.fn(),
    flush: jest.fn(),
  };

  beforeAll(async () => {
    queueService = {
      cancelJob: jest.fn(),
    };

    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [QueueController],
      providers: [{ provide: QueueService, useValue: queueService }],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(
      new GlobalExceptionFilter(mockLogger as any, mockErrorTracking as any),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 200 with { success: true } when a waiting job is cancelled', async () => {
    queueService.cancelJob.mockResolvedValue(true);

    const response = await request(app.getHttpServer())
      .delete('/queue/jobs/job-123')
      .expect(200);

    expect(response.body).toEqual({ success: true });
  });

  it('maps an active job to 409 instead of 500', async () => {
    queueService.cancelJob.mockRejectedValue(
      new ConflictError('cannot cancel job that is currently being processed'),
    );

    const response = await request(app.getHttpServer())
      .delete('/queue/jobs/job-123')
      .expect(409);

    expect(response.body.statusCode).toBe(409);
    expect(response.body.message).toBe(
      'cannot cancel job that is currently being processed',
    );
    expect(response.body.message).not.toContain('locked by a worker');
  });

  it('maps a completed job to 409 instead of 500', async () => {
    queueService.cancelJob.mockRejectedValue(
      new ConflictError('cannot cancel job that has already completed'),
    );

    const response = await request(app.getHttpServer())
      .delete('/queue/jobs/job-123')
      .expect(409);

    expect(response.body.statusCode).toBe(409);
  });

  it('maps an unknown job id to 404', async () => {
    queueService.cancelJob.mockRejectedValue(
      new ResourceNotFoundError('Job', 'missing-id'),
    );

    const response = await request(app.getHttpServer())
      .delete('/queue/jobs/missing-id')
      .expect(404);

    expect(response.body.statusCode).toBe(404);
    expect(response.body.message).toBe("Job with id 'missing-id' was not found");
  });
});
