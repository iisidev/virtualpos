import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { CreditTransaction } from '../../database/entities/credit-transaction.entity';
import { KioskService } from './kiosk.service';
import { KioskController } from './kiosk.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCreditProfile, CreditTransaction])],
  controllers: [KioskController],
  providers: [KioskService],
  exports: [KioskService],
})
export class KioskModule {}
