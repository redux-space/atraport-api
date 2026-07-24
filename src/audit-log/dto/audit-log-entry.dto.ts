export class AuditLogEntryDto {
  id: string;
  userId: string;
  eventType: string;
  portfolioId?: string;
  userAction: string;
  details: Record<string, any>;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}