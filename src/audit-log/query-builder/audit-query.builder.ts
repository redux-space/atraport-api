import { Repository } from 'typeorm';
import { AuditLog } from '../audit-log.entity';
import { AuditLogFilterDto } from '../dto/audit-log-filter.dto';
import { applyOffsetPagination, applySorting } from '../../pagination/helpers/pagination-query-builder.helper';

const AUDIT_LOG_ALIAS = 'audit_log';

export class AuditQueryBuilder {
  constructor(private readonly repository: Repository<AuditLog>) {}

  buildQuery(filter: AuditLogFilterDto, userId: string) {
    const queryBuilder = this.repository.createQueryBuilder(AUDIT_LOG_ALIAS)
      .where(`${AUDIT_LOG_ALIAS}.userId = :userId`, { userId });

    if (filter.startDate) {
      queryBuilder.andWhere(`${AUDIT_LOG_ALIAS}.createdAt >= :startDate`, { startDate: filter.startDate });
    }

    if (filter.endDate) {
      queryBuilder.andWhere(`${AUDIT_LOG_ALIAS}.createdAt <= :endDate`, { endDate: filter.endDate });
    }

    if (filter.eventType) {
      queryBuilder.andWhere(`${AUDIT_LOG_ALIAS}.eventType = :eventType`, { eventType: filter.eventType });
    }

    if (filter.portfolioId) {
      queryBuilder.andWhere(`${AUDIT_LOG_ALIAS}.portfolioId = :portfolioId`, { portfolioId: filter.portfolioId });
    }

    if (filter.userAction) {
      queryBuilder.andWhere(`${AUDIT_LOG_ALIAS}.userAction = :userAction`, { userAction: filter.userAction });
    }

    applySorting(queryBuilder, filter.sortBy, filter.sortOrder, AUDIT_LOG_ALIAS);
    applyOffsetPagination(queryBuilder, filter.page, filter.limit);

    return queryBuilder;
  }
}
