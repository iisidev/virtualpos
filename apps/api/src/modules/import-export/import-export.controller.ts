import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Res,
  UseGuards,
  Query,
} from '@nestjs/common';
import { Response } from 'express';
import { ImportExportService, DryRunValidationResult } from './import-export.service';
import { ImportType, UserRole } from '../../common/enums';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ImportBatchLog } from '../../database/entities';

@Controller('import-export')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ImportExportController {
  constructor(
    private readonly service: ImportExportService,
    @InjectRepository(ImportBatchLog)
    private readonly batchLogRepository: Repository<ImportBatchLog>,
  ) {}

  @Get('templates/:type')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async downloadTemplate(
    @Param('type') type: ImportType,
    @Res() res: Response,
  ): Promise<void> {
    const buffer = await this.service.generateTemplate(type);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="plantilla_${type.toLowerCase()}.xlsx"`,
    );
    res.send(buffer);
  }

  @Post('dry-run')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async dryRun(
    @Body('type') type: ImportType,
    @Body('rows') rows: Array<Record<string, string | number>>,
  ): Promise<DryRunValidationResult> {
    return this.service.dryRunValidate(type, rows);
  }

  @Post('commit')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async commit(
    @Body('type') type: ImportType,
    @Body('file_name') fileName: string,
    @Body('rows') rows: Array<Record<string, string | number>>,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ImportBatchLog> {
    return this.service.commitImport(type, fileName || 'import.xlsx', rows, user.userId);
  }

  @Get('logs')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async getLogs(): Promise<ImportBatchLog[]> {
    return this.batchLogRepository.find({
      order: { created_at: 'DESC' },
      take: 50,
      relations: { executed_by: true },
    });
  }
}
