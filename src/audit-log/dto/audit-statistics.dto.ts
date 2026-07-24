export class AuditStatisticsDto {
  totalLogs: number;
  logsByEventType: Record<string, number>;
  logsByUserAction: Record<string, number>;
  logsByDay: Record<string, number>;
  recentActivity: number;
  uniquePortfolios: number;
}