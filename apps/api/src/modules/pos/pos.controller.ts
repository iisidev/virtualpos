import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { Request } from 'express';
import { ClientsService, ClientProfileResponse } from '../clients/clients.service';
import { CreditLedgerService, VoucherDetails } from '../credit/credit-ledger.service';
import { ChargeRequestDto } from '../credit/dto/charge-request.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';

export interface AvailabilityTicket {
  ticket_type: 'CONSULTA_DISPONIBILIDAD';
  printed_at: Date;
  client: {
    full_name: string;
    masked_national_id: string;
    employee_code: string;
    employer_name: string;
  };
  approved_limit: string;
  used_balance: string;
  available_balance: string;
  credit_status: string;
  currency: string;
}

@Controller('pos')
@UseGuards(JwtAuthGuard, RolesGuard)
export class PosController {
  constructor(
    private readonly clientsService: ClientsService,
    private readonly creditLedgerService: CreditLedgerService,
  ) {}

  @Get('scan/:query')
  @Roles(UserRole.CASHIER, UserRole.SUPER_ADMIN)
  async scanClient(
    @Param('query') query: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ClientProfileResponse> {
    return this.clientsService.findByScanQuery(query, user.role);
  }

  @Get('availability-ticket/:clientId')
  @Roles(UserRole.CASHIER, UserRole.SUPER_ADMIN)
  async getAvailabilityTicket(
    @Param('clientId') clientId: string,
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<AvailabilityTicket> {
    const client = await this.clientsService.findOne(clientId, user.role);

    return {
      ticket_type: 'CONSULTA_DISPONIBILIDAD',
      printed_at: new Date(),
      client: {
        full_name: client.full_name,
        masked_national_id: client.national_id.substring(0, 4) + '******' + client.national_id.substring(client.national_id.length - 4),
        employee_code: client.employee_code,
        employer_name: client.employer_name,
      },
      approved_limit: client.approved_limit,
      used_balance: client.used_balance,
      available_balance: client.available_balance,
      credit_status: client.credit_status,
      currency: 'C$',
    };
  }

  @Post('checkout')
  @Roles(UserRole.CASHIER, UserRole.SUPER_ADMIN)
  async checkout(
    @Body() dto: ChargeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<VoucherDetails> {
    const ip = req.ip || req.socket.remoteAddress;
    return this.creditLedgerService.executeCharge(dto, user.userId, ip);
  }
}

