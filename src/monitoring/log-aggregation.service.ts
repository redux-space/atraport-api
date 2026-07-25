import { Injectable } from '@nestjs/common';
import { LogEntry, LogQueryFilter } from './dto/monitoring.dto';

@Injectable()
export class LogAggregationService {
  private logBuffer: LogEntry[] = [];
  private readonly maxBufferSize = 5000;

  public addLog(entry: LogEntry) {
    this.logBuffer.unshift(entry);
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.pop();
    }
  }

  public queryLogs(filter: LogQueryFilter = {}): { total: number; logs: LogEntry[] } {
    let result = this.logBuffer;

    if (filter.level) {
      result = result.filter((l) => l.level === filter.level);
    }
    if (filter.context) {
      result = result.filter((l) => l.context && l.context.toLowerCase().includes(filter.context.toLowerCase()));
    }
    if (filter.traceId) {
      result = result.filter((l) => l.traceId === filter.traceId);
    }
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      result = result.filter(
        (l) =>
          l.message.toLowerCase().includes(searchLower) ||
          (l.context && l.context.toLowerCase().includes(searchLower)) ||
          (l.stack && l.stack.toLowerCase().includes(searchLower)),
      );
    }
    if (filter.startTime) {
      const startMs = new Date(filter.startTime).getTime();
      result = result.filter((l) => new Date(l.timestamp).getTime() >= startMs);
    }
    if (filter.endTime) {
      const endMs = new Date(filter.endTime).getTime();
      result = result.filter((l) => new Date(l.timestamp).getTime() <= endMs);
    }

    const limit = filter.limit && filter.limit > 0 ? filter.limit : 100;
    return {
      total: result.length,
      logs: result.slice(0, limit),
    };
  }

  public getLokiFormattedLogs(limit = 100) {
    const logs = this.logBuffer.slice(0, limit);
    const streams = logs.map((log) => {
      const timestampNano = `${new Date(log.timestamp).getTime()}000000`;
      return {
        stream: {
          app: 'astraport-api',
          level: log.level,
          context: log.context || 'Application',
          traceId: log.traceId || 'none',
        },
        values: [[timestampNano, JSON.stringify(log)]],
      };
    });

    return {
      streams,
    };
  }
}
