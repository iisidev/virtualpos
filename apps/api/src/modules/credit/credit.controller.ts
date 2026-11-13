import {
  Controller,
  Post,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Get,
  Query,
} from '@nestjs/common';
import { Request } from 'express';
import { CreditLedgerService, VoucherDetails } from './credit-ledger.service';
import { ChargeRequestDto } from './dto/charge-request.dto';
import { PaymentRequestDto, VoidRequestDto, AdjustLimitDto } from './dto/other-requests.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { UserRole } from '../../common/enums';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditTransaction } from '../../database/entities';

@Controller('credit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class CreditController {
  constructor(
    private readonly creditLedgerService: CreditLedgerService,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
  ) {}

  @Post('charge')
  @Roles(UserRole.CASHIER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async charge(
    @Body() dto: ChargeRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ): Promise<VoucherDetails> {
    const ip = req.ip || req.socket.remoteAddress;
    return this.creditLedgerService.executeCharge(dto, user.userId, ip);
  }

  @Post('payment')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async payment(
    @Body() dto: PaymentRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.creditLedgerService.executePayment(dto, user.userId, ip);
  }

  @Post('transactions/:id/void')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async voidTransaction(
    @Param('id') id: string,
    @Body() dto: VoidRequestDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.creditLedgerService.executeVoid(id, dto, user.userId, ip);
  }

  @Post('adjust-limit')
  @Roles(UserRole.CREDIT_MANAGER, UserRole.SUPER_ADMIN)
  @HttpCode(HttpStatus.OK)
  async adjustLimit(
    @Body() dto: AdjustLimitDto,
    @CurrentUser() user: AuthenticatedUser,
    @Req() req: Request,
  ) {
    const ip = req.ip || req.socket.remoteAddress;
    return this.creditLedgerService.adjustLimit(dto, user.userId, ip);
  }

  @Get('transactions')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async getTransactions(
    @Query('clientId') clientId?: string,
    @Query('cashRegisterId') cashRegisterId?: string,
    @Query('limit') limit = 50,
  ) {
    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.client', 'client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .leftJoinAndSelect('tx.merchant_company', 'merchant')
      .leftJoinAndSelect('tx.cash_register', 'register')
      .leftJoinAndSelect('tx.cashier_user', 'cashier')
      .orderBy('tx.created_at', 'DESC')
      .take(Math.min(100, Number(limit)));

    if (clientId) {
      qb.andWhere('tx.client_id = :clientId', { clientId });
    }
    if (cashRegisterId) {
      qb.andWhere('tx.cash_register_id = :cashRegisterId', { cashRegisterId });
    }

    return qb.getMany();
  }

  @Get('transactions/:id/voucher')
  @Roles(UserRole.CASHIER, UserRole.CREDIT_MANAGER, UserRole.AUDITOR, UserRole.SUPER_ADMIN)
  async getVoucher(@Param('id') id: string): Promise<VoucherDetails> {
    const tx = await this.transactionRepository.findOneOrFail({
      where: { id },
      relations: {
        client: { employer_company: true },
        merchant_company: true,
        cash_register: true,
        cashier_user: true,
      },
    });
    return this.creditLedgerService.mapToVoucherDetails(tx);
  }
}
