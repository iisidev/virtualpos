import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CreditRequestsService } from './credit-requests.service';
import { CreditRequestsController } from './credit-requests.controller';
import { CreditModule } from '../credit/credit.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([CreditIncreaseRequest, ClientCreditProfile, Company, AuditLog]),
    CreditModule,
    NotificationsModule,
  ],
  controllers: [CreditRequestsController],
  providers: [CreditRequestsService],
  exports: [CreditRequestsService],
})
export class CreditRequestsModule {}

