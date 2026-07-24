export class AuditLogFilterDto {
  startDate?: Date;
  endDate?: Date;
  eventType?: string;
  portfolioId?: string;
  userAction?: string;
  page?: number = 1;
  limit?: number = 10;
  sortBy?: string = 'createdAt';
  sortOrder?: 'ASC' | 'DESC' = 'DESC';
}