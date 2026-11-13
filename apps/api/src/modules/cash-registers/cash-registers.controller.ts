import { Controller, Get, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { CashRegistersService } from './cash-registers.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CashRegisterStatus } from '../../common/enums';
import { CashRegister } from '../../database/entities/cash-register.entity';

@Controller('cash-registers')
@UseGuards(JwtAuthGuard)
export class CashRegistersController {
  constructor(private readonly service: CashRegistersService) {}

  @Get()
  async findAll(@Query('companyId') companyId?: string): Promise<CashRegister[]> {
    return this.service.findAll(companyId);
  }

  @Get(':id')
  async findOne(@Param('id') id: string): Promise<CashRegister> {
    return this.service.findOne(id);
  }

  @Patch(':id/status')
  async updateStatus(
    @Param('id') id: string,
    @Body('status') status: CashRegisterStatus,
  ): Promise<CashRegister> {
    return this.service.updateStatus(id, status);
  }
}

