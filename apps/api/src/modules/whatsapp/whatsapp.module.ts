import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import {
  ClientCreditProfile,
  CreditTransaction,
  CreditIncreaseRequest,
} from '../../database/entities';
import { WhatsAppService } from './whatsapp.service';
import { WhatsAppController } from './whatsapp.controller';
import { OpenClawProvider } from './providers/openclaw.provider';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientCreditProfile,
      CreditTransaction,
      CreditIncreaseRequest,
    ]),
  ],
  controllers: [WhatsAppController],
  providers: [WhatsAppService, OpenClawProvider],
  exports: [WhatsAppService, OpenClawProvider],
})
export class WhatsAppModule {}
