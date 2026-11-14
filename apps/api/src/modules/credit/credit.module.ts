import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  CreditTransaction,
  ClientCreditProfile,
  Company,
  CashRegister,
  AuditLog,
  User,
} from '../../database/entities';
import { CreditLedgerService } from './credit-ledger.service';
import { CreditController } from './credit.controller';
import { RedisLockService } from './redis-lock.service';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      CreditTransaction,
      ClientCreditProfile,
      Company,
      CashRegister,
      AuditLog,
      User,
    ]),
    NotificationsModule,
  ],
  controllers: [CreditController],
  providers: [CreditLedgerService, RedisLockService, CryptoService],
  exports: [CreditLedgerService, RedisLockService, CryptoService],
})
export class CreditModule {}

