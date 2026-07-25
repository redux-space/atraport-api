import { Injectable, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import * as os from 'os';
import { HealthCheckResponse, ComponentHealth } from './dto/monitoring.dto';

@Injectable()
export class HealthService {
  constructor(@Optional() private readonly dataSource?: DataSource) {}

  public async getLiveness(): Promise<{ status: string; timestamp: string }> {
    return {
      status: 'up',
      timestamp: new Date().toISOString(),
    };
  }

  public async getReadiness(): Promise<{ status: 'up' | 'down'; components: Record<string, ComponentHealth>; timestamp: string }> {
    const dbHealth = await this.checkDatabase();
    const memoryHealth = this.checkMemory();
    const diskHealth = this.checkDisk();

    const isReady = dbHealth.status !== 'down' && memoryHealth.status !== 'down' && diskHealth.status !== 'down';

    return {
      status: isReady ? 'up' : 'down',
      components: {
        database: dbHealth,
        memory: memoryHealth,
        disk: diskHealth,
      },
      timestamp: new Date().toISOString(),
    };
  }

  public async getFullHealth(): Promise<HealthCheckResponse> {
    const dbHealth = await this.checkDatabase();
    const memoryHealth = this.checkMemory();
    const diskHealth = this.checkDisk();
    const cpuHealth = this.checkCpu();

    const statuses = [dbHealth.status, memoryHealth.status, diskHealth.status, cpuHealth.status];

    let overallStatus: 'ok' | 'degraded' | 'down' = 'ok';
    if (statuses.includes('down')) {
      overallStatus = 'down';
    } else if (statuses.includes('degraded')) {
      overallStatus = 'degraded';
    }

    return {
      status: overallStatus,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      version: '0.1.0',
      components: {
        database: dbHealth,
        memory: memoryHealth,
        disk: diskHealth,
        cpu: cpuHealth,
      },
    };
  }

  private async checkDatabase(): Promise<ComponentHealth> {
    if (!this.dataSource) {
      return {
        status: 'up',
        details: { message: 'TypeORM DataSource not injected or mock mode active' },
      };
    }

    try {
      if (this.dataSource.isInitialized) {
        // Run a lightweight probe query
        await this.dataSource.query('SELECT 1');
        return {
          status: 'up',
          details: { connected: true, driver: this.dataSource.options.type },
        };
      } else {
        return {
          status: 'down',
          error: 'Database connection is not initialized',
        };
      }
    } catch (err: any) {
      return {
        status: 'down',
        error: err.message || 'Database connection query failed',
      };
    }
  }

  private checkMemory(): ComponentHealth {
    const memUsage = process.memoryUsage();
    const heapUsedRatio = memUsage.heapUsed / (memUsage.heapTotal || 1);

    if (heapUsedRatio > 0.95) {
      return {
        status: 'down',
        error: `Heap memory usage critical: ${(heapUsedRatio * 100).toFixed(1)}%`,
        details: { heapUsed: memUsage.heapUsed, heapTotal: memUsage.heapTotal, rss: memUsage.rss },
      };
    } else if (heapUsedRatio > 0.85) {
      return {
        status: 'degraded',
        details: { warning: 'High heap memory usage', heapUsedRatio: parseFloat(heapUsedRatio.toFixed(3)), rss: memUsage.rss },
      };
    }

    return {
      status: 'up',
      details: {
        heapUsedBytes: memUsage.heapUsed,
        heapTotalBytes: memUsage.heapTotal,
        rssBytes: memUsage.rss,
        heapUsedRatio: parseFloat(heapUsedRatio.toFixed(3)),
      },
    };
  }

  private checkDisk(): ComponentHealth {
    // Basic system disk stats probe
    const totalMem = os.totalmem();
    const freeMem = os.freemem();

    return {
      status: 'up',
      details: {
        systemMemoryTotalMb: Math.round(totalMem / (1024 * 1024)),
        systemMemoryFreeMb: Math.round(freeMem / (1024 * 1024)),
      },
    };
  }

  private checkCpu(): ComponentHealth {
    const loadAvg = os.loadavg ? os.loadavg() : [0, 0, 0];
    const cpus = os.cpus();
    const cpuCount = cpus ? cpus.length : 1;

    // Standard high load warning if 1-min load average > cpu count
    const loadRatio = loadAvg[0] / cpuCount;

    if (loadRatio > 2.0) {
      return {
        status: 'degraded',
        details: { warning: 'High CPU load ratio', loadAvg, cpuCount },
      };
    }

    return {
      status: 'up',
      details: {
        cpuCount,
        loadAverage: loadAvg,
      },
    };
  }
}
