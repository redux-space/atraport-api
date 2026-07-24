import { AuditLogEntryDto } from '../dto/audit-log-entry.dto';

export class CsvExporter {
  export(logs: AuditLogEntryDto[]): string {
    const headers = ['id', 'userId', 'eventType', 'portfolioId', 'userAction', 'ipAddress', 'userAgent', 'createdAt', 'details'];
    const rows = logs.map(log => [
      log.id,
      log.userId,
      log.eventType,
      log.portfolioId || '',
      log.userAction,
      log.ipAddress,
      log.userAgent,
      log.createdAt.toISOString(),
      JSON.stringify(log.details).replace(/"/g, '""')
    ]);

    const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
    return csvContent;
  }

  getContentType(): string {
    return 'text/csv';
  }

  getFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return `audit-logs-${date}.csv`;
  }
}