import { 
  Controller, Get, Query, Param, ParseUUIDPipe, Res, BadRequestException, UseGuards
} from '@nestjs/common';
import { Response } from 'express';
import { AuditLogService } from './audit-log.service';
import { AuditLogFilterDto } from './dto/audit-log-filter.dto';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { Roles } from '../auth/decorators/roles.decorator';
import { UserRole } from '../auth/entities/user.entity';
import { RolesGuard } from '../auth/guards/roles.guard';

@Controller('api/audit-logs')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  async getAuditLogs(
    @Query() filter: AuditLogFilterDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.auditLogService.findAll(filter, user.id);
  }

  @Get(':log_id')
  async getAuditLogById(
    @Param('log_id', ParseUUIDPipe) logId: string,
    @CurrentUser() user: { id: string },
  ) {
    return this.auditLogService.findOne(logId, user.id);
  }

  @Get('export')
  async exportAuditLogs(
    @Query('format') format: 'json' | 'csv',
    @Query() filter: AuditLogFilterDto,
    @Res() res: Response,
    @CurrentUser() user: { id: string },
  ) {
    if (!['json', 'csv'].includes(format)) {
      throw new BadRequestException('Invalid format. Supported formats: json, csv');
    }

    const exportResult = await this.auditLogService.export(format, filter, user.id);

    res.setHeader('Content-Type', exportResult.contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${exportResult.fileName}"`);
    return res.send(exportResult.content);
  }

  @Get('statistics')
  async getStatistics(@CurrentUser() user: { id: string }) {
    return this.auditLogService.getStatistics(user.id);
  }

  @Get('verify-integrity')
  async verifyIntegrity(@CurrentUser() user: { id: string }) {
    return this.auditLogService.verifyIntegrity(user.id);
  }
}