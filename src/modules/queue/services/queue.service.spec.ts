import { QueueService } from './queue.service';
import { ConflictError, ResourceNotFoundError } from '../../../logging/errors/app.errors';

describe('QueueService', () => {
  let service: QueueService;

  // Mock Bull Queue instances
  const mockDefaultQueue = {
    getJob: jest.fn(),
    getJobLogs: jest.fn(),
  };

  const mockHighPriorityQueue = {
    getJob: jest.fn(),
    getJobLogs: jest.fn(),
  };

  const mockLowPriorityQueue = {
    getJob: jest.fn(),
    getJobLogs: jest.fn(),
  };

  const mockDeadLetterQueue = {
    getJob: jest.fn(),
    getJobLogs: jest.fn(),
  };

  const mockLogger = {
    log: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
  };

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();

    // Create a new instance for each test
    service = new QueueService(
      mockDefaultQueue as any,
      mockHighPriorityQueue as any,
      mockLowPriorityQueue as any,
      mockDeadLetterQueue as any,
      mockLogger as any,
    );
  });

  describe('cancelJob', () => {
    it('should remove waiting/delayed job and return true', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: jest.fn().mockResolvedValue(undefined),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      const result = await service.cancelJob('test-job-id');

      expect(result).toBe(true);
      expect(mockDefaultQueue.getJob).toHaveBeenCalledWith('test-job-id');
      expect(mockJob.getState).toHaveBeenCalled();
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should throw ConflictError for active job', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
        remove: jest.fn(),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.cancelJob('test-job-id')).rejects.toThrow(ConflictError);
    });

    it('should throw ConflictError for active job with proper message', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('active'),
        remove: jest.fn(),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.cancelJob('test-job-id')).rejects.toThrow(ConflictError);
      await expect(service.cancelJob('test-job-id')).rejects.toThrow('cannot cancel job that is currently being processed');
    });

    it('should throw ConflictError for completed job with proper message', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('completed'),
        remove: jest.fn(),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.cancelJob('test-job-id')).rejects.toThrow(ConflictError);
      await expect(service.cancelJob('test-job-id')).rejects.toThrow('cannot cancel job that has already completed');
    });

    it('should throw ResourceNotFoundError for unknown job id', async () => {
      mockDefaultQueue.getJob.mockResolvedValue(null);

      await expect(service.cancelJob('unknown-job-id')).rejects.toThrow(ResourceNotFoundError);
      await expect(service.cancelJob('unknown-job-id')).rejects.toThrow('Job with id \'unknown-job-id\' was not found');
    });

    it('should throw ConflictError when job.remove() throws "locked by a worker"', async () => {
      const mockJob = {
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: jest.fn().mockRejectedValue(new Error('Job could not be removed because it is locked by a worker')),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      try {
        await service.cancelJob('test-job-id');
        expect(true).toBe(false); // Should not reach here
      } catch (error) {
        expect(error).toBeInstanceOf(ConflictError);
        expect(error.message).not.toContain('locked by a worker');
      }
    });

    it('should translate a Bull "Cannot remove completed job" error into ConflictError', async () => {
      // getState() must not report a terminal state here, otherwise the pre-check
      // short-circuits before job.remove() is ever called and the fallback is untested.
      const mockJob = {
        getState: jest.fn().mockResolvedValue('waiting'),
        remove: jest.fn().mockRejectedValue(new Error('Cannot remove completed job')),
      };

      mockDefaultQueue.getJob.mockResolvedValue(mockJob);

      await expect(service.cancelJob('test-job-id')).rejects.toThrow(ConflictError);
      await expect(service.cancelJob('test-job-id')).rejects.not.toThrow('Cannot remove completed job');
      expect(mockJob.remove).toHaveBeenCalled();
    });

    it('should search all queues for unknown job id', async () => {
      mockDefaultQueue.getJob.mockResolvedValue(null);
      mockHighPriorityQueue.getJob.mockResolvedValue(null);
      mockLowPriorityQueue.getJob.mockResolvedValue(null);

      await expect(service.cancelJob('unknown-job-id')).rejects.toThrow(ResourceNotFoundError);
      expect(mockDefaultQueue.getJob).toHaveBeenCalledWith('unknown-job-id');
      expect(mockHighPriorityQueue.getJob).toHaveBeenCalledWith('unknown-job-id');
      expect(mockLowPriorityQueue.getJob).toHaveBeenCalledWith('unknown-job-id');
    });
  });
});
