import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { ClientsService } from './clients.service';
import { ClientsController } from './clients.controller';
import { CryptoService } from '../../common/crypto/crypto.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCreditProfile, Company, AuditLog])],
  controllers: [ClientsController],
  providers: [ClientsService, CryptoService],
  exports: [ClientsService],
})
export class ClientsModule {}

