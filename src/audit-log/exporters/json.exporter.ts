import { AuditLogEntryDto } from '../dto/audit-log-entry.dto';

export class JsonExporter {
  export(logs: AuditLogEntryDto[]): string {
    return JSON.stringify(logs, null, 2);
  }

  getContentType(): string {
    return 'application/json';
  }

  getFileName(): string {
    const date = new Date().toISOString().split('T')[0];
    return `audit-logs-${date}.json`;
  }
}