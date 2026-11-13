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
import { MetaCloudProvider } from './providers/meta-cloud.provider';
import { MockWhatsAppProvider } from './providers/mock.provider';
import { OllamaService } from '../ai/ollama.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClientCreditProfile,
      CreditTransaction,
      CreditIncreaseRequest,
    ]),
  ],
  controllers: [WhatsAppController],
  providers: [
    WhatsAppService,
    OpenClawProvider,
    MetaCloudProvider,
    MockWhatsAppProvider,
    OllamaService,
  ],
  exports: [WhatsAppService, OpenClawProvider, MockWhatsAppProvider],
})
export class WhatsAppModule {}
