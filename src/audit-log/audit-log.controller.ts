import { 
  Controller, Get, Query, Param, ParseUUIDPipe, Res, Req, BadRequestException 
} from '@nestjs/common';
import { Response, Request } from 'express';
import { AuditLogService } from './audit-log.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';

@Controller('api/audit-logs')
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAuditLogs(
    @Query() filter: AuditLogFilterDto,
    @Req() req: Request
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.auditLogService.findAll(filter, userId);
  }

  @Get(':log_id')
  async getAuditLogById(
    @Param('log_id', ParseUUIDPipe) logId: string,
    @Req() req: Request
  ) {
    const userId = this.getUserIdFromRequest(req);
    return this.auditLogService.findOne(logId, userId);
  }

  @Get('export')
  async exportAuditLogs(
    @Query('format') format: 'json' | 'csv',
    @Query() filter: AuditLogFilterDto,
    @Res() res: Response,
    @Req() req: Request
  ) {
    if (!['json', 'csv'].includes(format)) {
      throw new BadRequestException('Invalid format. Supported formats: json, csv');
    }

    const userId = this.getUserIdFromRequest(req);
    const exportResult = await this.auditLogService.export(format, filter, userId);

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    return res.send(exportResult.content);
  }

  @Get('statistics')
  async getStatistics(@Req() req: Request) {
    const userId = this.getUserIdFromRequest(req);
    return this.auditLogService.getStatistics(userId);
  }

  @Get('verify-integrity')
  async verifyIntegrity(@Req() req: Request) {
    const userId = this.getUserIdFromRequest(req);
    return this.auditLogService.verifyIntegrity(userId);
  }

  private getUserIdFromRequest(req: Request): string {
    // In a real application, this would extract the user ID from the JWT token
    // For example: return req.user?.id;
    // This is a placeholder to demonstrate the security check
    const userId = req.headers['x-user-id'] as string;
    if (!userId) {
      throw new BadRequestException('User ID not found in request. Authentication required.');
    }
    return userId;
  }
}