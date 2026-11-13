import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CreditRequestsService } from './credit-requests.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole, IncreaseRequestStatus } from '../../common/enums';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';

@Controller('credit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditRequestsController {
  constructor(private readonly service: CreditRequestsService) {}

  @Get()
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR)
  async findAll(@Query('status') status?: IncreaseRequestStatus): Promise<CreditIncreaseRequest[]> {
    return this.service.findAll(status);
  }

  @Patch(':id/review')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async review(
    @Param('id') id: string,
    @Body('action') action: 'APPROVE' | 'REJECT',
    @Body('review_notes') notes: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreditIncreaseRequest> {
    return this.service.reviewRequest(id, action, user.userId, notes);
  }
}
