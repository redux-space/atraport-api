import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';

export class AuditQueryBuilder {
  constructor(private readonly repository: Repository<AuditLog>) {}

  buildQuery(filter: AuditLogFilterDto, userId: string) {
    const queryBuilder = this.repository.createQueryBuilder('audit_log')
      .where('audit_log.userId = :userId', { userId });

    if (filter.startDate) {
      queryBuilder.andWhere('audit_log.createdAt >= :startDate', { startDate: filter.startDate });
    }

    if (filter.endDate) {
      queryBuilder.andWhere('audit_log.createdAt <= :endDate', { endDate: filter.endDate });
    }

    if (filter.eventType) {
      queryBuilder.andWhere('audit_log.eventType = :eventType', { eventType: filter.eventType });
    }

    if (filter.portfolioId) {
      queryBuilder.andWhere('audit_log.portfolioId = :portfolioId', { portfolioId: filter.portfolioId });
    }

    if (filter.userAction) {
      queryBuilder.andWhere('audit_log.userAction = :userAction', { userAction: filter.userAction });
    }

    const sortField = `audit_log.${filter.sortBy}`;
    queryBuilder.orderBy(sortField, filter.sortOrder);

    if (filter.page && filter.limit) {
      const skip = (filter.page - 1) * filter.limit;
      queryBuilder.skip(skip).take(filter.limit);
    }

    return queryBuilder;
  }
}