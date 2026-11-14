import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { CashRegisterStatus, UserRole } from '../../common/enums';
import { CashRegister } from '../../database/entities/cash-register.entity';
import {
  CreateCashRegisterDto,
  UpdateCashRegisterDto,
  UpdateCashRegisterStatusDto,
} from './dto/cash-register.dto';

@Controller('cash-registers')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CashRegistersController {
  constructor(private readonly service: CashRegistersService) {}

  @Get()
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('companyId') companyId?: string,
    @Query('status') status?: CashRegisterStatus,
    @Query('onlyActiveCompanies') onlyActiveCompanies?: string,
  ): Promise<CashRegister[]> {
    const scopedCompanyId =
      user.role === UserRole.CASHIER && user.companyId ? user.companyId : companyId;

    return this.service.findAll({
      companyId: scopedCompanyId,
      status,
      onlyActiveCompanies: onlyActiveCompanies === 'true',
    });
  }

  @Get(':id')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashRegister> {
    const cr = await this.service.findOne(id);
    if (user.role === UserRole.CASHIER && user.companyId && cr.company_id !== user.companyId) {
      throw new ForbiddenException('No tiene permiso para acceder a una caja de otro comercio');
    }
    return cr;
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async create(
    @Body() dto: CreateCashRegisterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashRegister> {
    return this.service.create(dto, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCashRegisterDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashRegister> {
    return this.service.update(id, dto, user.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.CASHIER, UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateCashRegisterStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<CashRegister> {
    return this.service.updateStatus(id, dto.status, {
      userId: user.userId,
      role: user.role,
      companyId: user.companyId,
    });
  }
}

