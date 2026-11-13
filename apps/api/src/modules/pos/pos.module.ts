import { Module } from '@nestjs/common';
import { PosController } from './pos.controller';
import { ClientsModule } from '../clients/clients.module';
import { CreditModule } from '../credit/credit.module';

@Module({
  imports: [ClientsModule, CreditModule],
  controllers: [PosController],
})
export class PosModule {}
