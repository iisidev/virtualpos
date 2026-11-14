import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import { IsOptional, IsUUID } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import {
  BulkJob,
  SendResult,
  WhatsAppNotificationsService,
} from './whatsapp-notifications.service';

class BulkWelcomeDto {
  @IsOptional()
  @IsUUID('4')
  employer_company_id?: string;
}

@Controller('notifications/whatsapp')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
export class WhatsAppNotificationsController {
  constructor(private readonly service: WhatsAppNotificationsService) {}

  @Get('welcome/preview')
  preview(): { message: string } {
    return this.service.getPreview();
  }

  @Post('welcome/client/:id')
  sendToClient(
    @Param('id', new ParseUUIDPipe()) id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SendResult> {
    return this.service.sendToClient(id, user.userId);
  }

  @Post('welcome/bulk')
  sendBulk(
    @Body() body: BulkWelcomeDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<BulkJob> {
    return this.service.startBulk(user.userId, body.employer_company_id);
  }

  @Get('jobs/:id')
  getJob(@Param('id', new ParseUUIDPipe()) id: string): BulkJob {
    return this.service.getJob(id);
  }
}

