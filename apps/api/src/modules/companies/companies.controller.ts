import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Body,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { Company } from '../../database/entities/company.entity';
import { UserRole } from '../../common/enums';

@Controller('companies')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  async findAll(): Promise<Company[]> {
    return this.companiesService.findAll();
  }

  @Get('merchants')
  async findMerchants(): Promise<Company[]> {
    return this.companiesService.findMerchants();
  }

  @Get('employers')
  async findEmployers(): Promise<Company[]> {
    return this.companiesService.findEmployers();
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<Company> {
    return this.companiesService.findOne(id);
  }

  @Post()
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async create(
    @Body() dto: CreateCompanyDto,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<Company> {
    return this.companiesService.create(dto, user.username);
  }

  @Put(':id')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateCompanyDto,
  ): Promise<Company> {
    return this.companiesService.update(id, dto);
  }

  @Patch(':id/status')
  @Roles(UserRole.SUPER_ADMIN, UserRole.CREDIT_MANAGER)
  async toggleStatus(@Param('id') id: string): Promise<Company> {
    return this.companiesService.toggleStatus(id);
  }
}
