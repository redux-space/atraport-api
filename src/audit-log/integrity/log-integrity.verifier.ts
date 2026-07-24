import * as crypto from 'crypto';
import { AuditLog } from '../audit-log.entity';

export class LogIntegrityVerifier {
  private generateChecksum(log: AuditLog, previousChecksum: string = ''): string {
    const data = `${log.id}${log.userId}${log.eventType}${log.portfolioId || ''}${log.userAction}${JSON.stringify(log.details)}${log.createdAt.toISOString()}${previousChecksum}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  verifyLogs(logs: AuditLog[]): { valid: boolean; invalidLogIds: string[] } {
    const invalidLogIds: string[] = [];
    let previousChecksum = '';

    for (const log of logs.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())) {
      const expectedChecksum = this.generateChecksum(log, previousChecksum);
      if (log.checksum !== expectedChecksum) {
        invalidLogIds.push(log.id);
      }
      previousChecksum = log.checksum;
    }

    return {
      valid: invalidLogIds.length === 0,
      invalidLogIds
    };
  }

  getGenerateChecksum() {
    return this.generateChecksum.bind(this);
  }
}