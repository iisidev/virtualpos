import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { CompaniesService } from './companies.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { Company } from '../../database/entities/company.entity';

@Controller('companies')
@UseGuards(JwtAuthGuard)
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
}
