import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from './audit-log.entity';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { AuditLogEntryDto } from './dto/audit-log-entry.dto';
import { AuditStatisticsDto } from './dto/audit-statistics.dto';
import { AuditQueryBuilder } from './query-builder/audit-query.builder';
import { JsonExporter } from './exporters/json.exporter';
import { CsvExporter } from './exporters/csv.exporter';
import { LogIntegrityVerifier } from './integrity/log-integrity.verifier';
import { Cache, CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { createOffsetPaginatedResponse } from '../pagination/helpers/pagination.helper';

@Injectable()
export class AuditLogService {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepository: Repository<AuditLog>,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  async findAll(filter: AuditLogFilterDto, userId: string) {
    const queryBuilder = new AuditQueryBuilder(this.auditLogRepository);
    const query = queryBuilder.buildQuery(filter, userId);
    
    const [logs, total] = await query.getManyAndCount();
    
    const logDtos = logs.map(log => this.mapToDto(log));
    
    return createOffsetPaginatedResponse(logDtos, total, filter.page, filter.limit);
  }

  async findOne(logId: string, userId: string): Promise<AuditLogEntryDto> {
    const log = await this.auditLogRepository.findOne({
      where: { id: logId, userId }
    });

    if (!log) {
      throw new NotFoundException('Audit log entry not found');
    }

    return this.mapToDto(log);
  }

  async export(format: 'json' | 'csv', filter: AuditLogFilterDto, userId: string) {
    const queryBuilder = new AuditQueryBuilder(this.auditLogRepository);
    const query = queryBuilder.buildQuery({ ...filter, limit: 10000 }, userId);
    const logs = await query.getMany();
    const logDtos = logs.map(log => this.mapToDto(log));

    const exporter = format === 'json' ? new JsonExporter() : new CsvExporter();
    return {
      content: exporter.export(logDtos),
      contentType: exporter.getContentType(),
      fileName: exporter.getFileName()
    };
  }

  async getStatistics(userId: string): Promise<AuditStatisticsDto> {
    const cacheKey = `audit-stats-${userId}`;
    const cachedStats = await this.cacheManager.get<AuditStatisticsDto>(cacheKey);
    
    if (cachedStats) {
      return cachedStats;
    }

    const logs = await this.auditLogRepository.find({ where: { userId } });
    
    const logsByEventType: Record<string, number> = {};
    const logsByUserAction: Record<string, number> = {};
    const logsByDay: Record<string, number> = {};
    const portfolios = new Set<string>();

    logs.forEach(log => {
      logsByEventType[log.eventType] = (logsByEventType[log.eventType] || 0) + 1;
      logsByUserAction[log.userAction] = (logsByUserAction[log.userAction] || 0) + 1;
      const day = log.createdAt.toISOString().split('T')[0];
      logsByDay[day] = (logsByDay[day] || 0) + 1;
      if (log.portfolioId) {
        portfolios.add(log.portfolioId);
      }
    });

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);
    const recentActivity = logs.filter(log => log.createdAt > oneDayAgo).length;

    const stats: AuditStatisticsDto = {
      totalLogs: logs.length,
      logsByEventType,
      logsByUserAction,
      logsByDay,
      recentActivity,
      uniquePortfolios: portfolios.size
    };

    await this.cacheManager.set(cacheKey, stats, 3600000);
    return stats;
  }

  async verifyIntegrity(userId: string) {
    const logs = await this.auditLogRepository.find({ where: { userId } });
    const verifier = new LogIntegrityVerifier();
    return verifier.verifyLogs(logs);
  }

  private mapToDto(log: AuditLog): AuditLogEntryDto {
    return {
      id: log.id,
      userId: log.userId,
      eventType: log.eventType,
      portfolioId: log.portfolioId,
      userAction: log.userAction,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt
    };
  }
}
