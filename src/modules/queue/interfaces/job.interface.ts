/**
 * Job priority levels
 */
export enum JobPriority {
  HIGH = 1,
  MEDIUM = 3,
  LOW = 5,
}

/**
 * Job status
 */
export enum JobStatus {
  PENDING = 'pending',
  PROCESSING = 'processing',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  RETRYING = 'retrying',
  DEAD_LETTERED = 'dead_lettered',
}

/**
 * Job data interface
 */
export interface JobData {
  id: string;
  type: string;
  payload: any;
  priority: JobPriority;
  retryCount: number;
  maxRetries: number;
  timeout: number;
  scheduledAt?: Date;
  metadata?: Record<string, any>;
}

/**
 * Job result interface
 */
export interface JobResult {
  success: boolean;
  data?: any;
  error?: string;
  processedAt: Date;
  processingTime: number;
}
