import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuditLog, ClientCreditProfile } from '../../database/entities';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppNotificationsController } from './whatsapp-notifications.controller';
import { WhatsAppNotificationsService } from './whatsapp-notifications.service';

@Module({
  imports: [TypeOrmModule.forFeature([ClientCreditProfile, AuditLog]), WhatsAppModule],
  controllers: [WhatsAppNotificationsController],
  providers: [WhatsAppNotificationsService],
  exports: [WhatsAppNotificationsService],
})
export class NotificationsModule {}

