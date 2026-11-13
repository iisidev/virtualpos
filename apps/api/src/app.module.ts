import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { CashRegistersModule } from './modules/cash-registers/cash-registers.module';
import { ClientsModule } from './modules/clients/clients.module';
import { CreditModule } from './modules/credit/credit.module';
import { PosModule } from './modules/pos/pos.module';
import { KioskModule } from './modules/kiosk/kiosk.module';
import { ImportExportModule } from './modules/import-export/import-export.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';
import { CreditRequestsModule } from './modules/credit-requests/credit-requests.module';
import { AuditModule } from './modules/audit/audit.module';
import { CatalogsModule } from './modules/catalogs/catalogs.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ['.env', '.env.local'],
    }),
    DatabaseModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    CashRegistersModule,
    CatalogsModule,
    ClientsModule,
    CreditModule,
    PosModule,
    KioskModule,
    ImportExportModule,
    WhatsAppModule,
    CreditRequestsModule,
    AuditModule,
  ],
})
export class AppModule {}
