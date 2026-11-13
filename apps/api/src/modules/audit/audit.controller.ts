import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums';
import { AuditLog } from '../../database/entities/audit-log.entity';

@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(UserRole.AUDITOR, UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async getLogs(@Query('limit') limit = 100): Promise<AuditLog[]> {
    return this.auditService.findAll(Number(limit));
  }
}
