import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CreditTransaction } from '../../database/entities/credit-transaction.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CryptoService } from '../../common/crypto/crypto.service';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([ClientCreditProfile, Company, AuditLog, CreditTransaction]),
    NotificationsModule,
  ],
  controllers: [ClientsController],
  providers: [ClientsService, CryptoService],
  exports: [ClientsService],
})
export class ClientsModule {}

