import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClientCreditProfile,
  Company,
  ImportBatchLog,
  CreditTransaction,
  AuditLog,
} from '../../database/entities';
import { ImportExportService } from './import-export.service';
import { ImportExportController } from './import-export.controller';
import { CryptoService } from '../../common/crypto/crypto.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientCreditProfile,
      Company,
      ImportBatchLog,
      CreditTransaction,
      AuditLog,
    ]),
  ],
  controllers: [ImportExportController],
  providers: [ImportExportService, CryptoService],
  exports: [ImportExportService],
})
export class ImportExportModule {}

