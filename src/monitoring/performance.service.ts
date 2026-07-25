import { Injectable } from '@nestjs/common';
import { ApmPerformanceSummary } from './dto/monitoring.dto';

@Injectable()
export class PerformanceService {
  private latenciesBuffer: number[] = [];
  private readonly maxBufferSize = 5000;

  private totalRequestsCount = 0;
  private errorRequestsCount = 0;
  private activeRequestsCount = 0;

  private requestTimestamps: number[] = [];

  public recordRequest(durationMs: number, statusCode: number) {
    this.totalRequestsCount++;
    if (statusCode >= 400) {
      this.errorRequestsCount++;
    }

    this.latenciesBuffer.push(durationMs);
    if (this.latenciesBuffer.length > this.maxBufferSize) {
      this.latenciesBuffer.shift();
    }

    const now = Date.now();
    this.requestTimestamps.push(now);
    // Keep timestamps from last 60 seconds
    const cutoff = now - 60000;
    while (this.requestTimestamps.length > 0 && this.requestTimestamps[0] < cutoff) {
      this.requestTimestamps.shift();
    }
  }

  public incrementActiveRequests() {
    this.activeRequestsCount++;
  }

  public decrementActiveRequests() {
    this.activeRequestsCount = Math.max(0, this.activeRequestsCount - 1);
  }

  public getSummary(): ApmPerformanceSummary {
    const sorted = [...this.latenciesBuffer].sort((a, b) => a - b);
    const count = sorted.length;

    let p50 = 0;
    let p90 = 0;
    let p95 = 0;
    let p99 = 0;
    let min = 0;
    let max = 0;
    let avg = 0;

    if (count > 0) {
      min = sorted[0];
      max = sorted[count - 1];
      const sum = sorted.reduce((acc, curr) => acc + curr, 0);
      avg = Math.round((sum / count) * 100) / 100;

      p50 = this.getPercentile(sorted, 50);
      p90 = this.getPercentile(sorted, 90);
      p95 = this.getPercentile(sorted, 95);
      p99 = this.getPercentile(sorted, 99);
    }

    const requestsInLastMinute = this.requestTimestamps.length;
    const rps = Math.round((requestsInLastMinute / 60) * 100) / 100;

    const errorRatePercentage = this.totalRequestsCount > 0
      ? Math.round((this.errorRequestsCount / this.totalRequestsCount) * 10000) / 100
      : 0;

    return {
      rps,
      totalRequests: this.totalRequestsCount,
      errorCount: this.errorRequestsCount,
      errorRatePercentage,
      latencyMs: {
        p50,
        p90,
        p95,
        p99,
        avg,
        min,
        max,
      },
      activeRequests: this.activeRequestsCount,
    };
  }

  private getPercentile(sorted: number[], percentile: number): number {
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    const clampedIndex = Math.max(0, Math.min(index, sorted.length - 1));
    return Math.round(sorted[clampedIndex] * 100) / 100;
  }
}
