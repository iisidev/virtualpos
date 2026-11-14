import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  CreditRequestReviewResponse,
  CreditRequestsService,
} from './credit-requests.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole, IncreaseRequestStatus } from '../../common/enums';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';
import {
  CreateCreditRequestDto,
  ReviewCreditRequestDto,
} from './dto/credit-request.dto';

@Controller('credit-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditRequestsController {
  constructor(private readonly service: CreditRequestsService) {}

  @Get()
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN, UserRole.AUDITOR)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('status') status?: IncreaseRequestStatus,
    @Query('employerCompanyId') employerCompanyId?: string,
    @Query('search') search?: string,
  ): Promise<CreditIncreaseRequest[]> {
    return this.service.findAll({
      status,
      employerCompanyId,
      search,
      actorRole: user.role,
      actorCompanyId: user.companyId,
    });
  }

  @Post()
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async create(
    @Body() dto: CreateCreditRequestDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CreditIncreaseRequest> {
    return this.service.createRequest(dto, user.userId, user.role, user.companyId);
  }

  @Patch(':id/review')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async review(
    @Param('id') id: string,
    @Body() dto: ReviewCreditRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<CreditRequestReviewResponse> {
    const ip = req.ip || req.socket.remoteAddress;
    return this.service.reviewRequest(
      id,
      dto.action,
      user.userId,
      dto.review_notes,
      dto.approved_limit,
      user.role,
      user.companyId,
      ip,
    );
  }
}

