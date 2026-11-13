import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ClientsService, ClientProfileResponse } from './clients.service';
import { CreateClientDto, UpdateClientDto, UpdateClientStatusDto } from './dto/client.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole, CreditStatus } from '../../common/enums';

@Controller('clients')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ClientsController {
  constructor(private readonly clientsService: ClientsService) {}

  @Get()
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async findAll(
    @CurrentUser() user: AuthenticatedUser,
    @Query('search') search?: string,
    @Query('employerCompanyId') employerCompanyId?: string,
    @Query('jobTitle') jobTitle?: string,
    @Query('gradeLevel') gradeLevel?: string,
    @Query('classification') classification?: string,
    @Query('creditStatus') creditStatus?: CreditStatus,
  ): Promise<ClientProfileResponse[]> {
    return this.clientsService.findAll(user.role, {
      search,
      employerCompanyId,
      jobTitle,
      gradeLevel,
      classification,
      creditStatus,
    });
  }

  @Get('scan/:query')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async scan(
    @Param('query') query: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.findByScanQuery(query, user.role);
  }

  @Get(':id')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async findOne(
    @Param('id') id: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.findOne(id, user.role);
  }

  @Post()
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async create(
    @Body() dto: CreateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.create(dto, user.userId);
  }

  @Put(':id')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.update(id, dto, user.userId);
  }

  @Patch(':id/status')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  async updateStatus(
    @Param('id') id: string,
    @Body() dto: UpdateClientStatusDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.updateStatus(id, dto, user.userId);
  }
}

