import { Injectable, Logger } from '@nestjs/common';
import { WhatsAppProviderInterface } from '../interfaces/whatsapp-provider.interface';
import { VoucherDetails } from '../../credit/credit-ledger.service';

@Injectable()
export class MockWhatsAppProvider implements WhatsAppProviderInterface {
  readonly providerName = 'MOCK';
  private readonly logger = new Logger(MockWhatsAppProvider.name);
  public readonly sentMessages: Array<{ to: string; text: string; date: Date }> = [];

  async sendMessage(to: string, message: string): Promise<boolean> {
    this.logger.log(`[WhatsApp Mock Provider] => A: ${to} | Mensaje:\n${message}`);
    this.sentMessages.push({ to, text: message, date: new Date() });
    return true;
  }

  async sendVoucher(to: string, voucher: VoucherDetails): Promise<boolean> {
    const text = `🧾 [VOUCHER VIRTUAL] Compra por C$ ${voucher.amount} en ${voucher.merchant.name}. Auth: ${voucher.authorization_code}. Nuevo disponible: C$ ${voucher.new_available_balance}`;
    return this.sendMessage(to, text);
  }

  async sendInteractiveMenu(to: string, clientName: string): Promise<boolean> {
    const text = `¡Hola, ${clientName}! Menú: 1. Aprobado, 2. Disponible, 3. Última Factura, 4. Historial, 5. Solicitar Aumento`;
    return this.sendMessage(to, text);
  }
}
