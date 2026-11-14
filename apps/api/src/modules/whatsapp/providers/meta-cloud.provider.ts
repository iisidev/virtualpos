import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppProviderInterface } from '../interfaces/whatsapp-provider.interface';
import { VoucherDetails } from '../../credit/credit-ledger.service';

@Injectable()
export class MetaCloudProvider implements WhatsAppProviderInterface {
  readonly providerName = 'META_CLOUD';
  private readonly logger = new Logger(MetaCloudProvider.name);
  private readonly apiToken: string;
  private readonly botNumber: string;

  constructor(private readonly config: ConfigService) {
    this.apiToken = this.config.get<string>('WHATSAPP_API_TOKEN', '');
    this.botNumber = this.config.getOrThrow<string>('WHATSAPP_BOT_NUMBER');
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    const url = `https://graph.facebook.com/v19.0/${this.botNumber}/messages`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      });
      return response.ok;
    } catch {
      this.logger.warn('Meta Cloud API call failed. Falling back gracefully.');
      return false;
    }
  }

  async sendVoucher(to: string, voucher: VoucherDetails): Promise<boolean> {
    const text = `🧾 *COMPROBANTE DE COMPRA CORPORATIVA*
Autorización: ${voucher.authorization_code}
Comercio: ${voucher.merchant.name}
Monto: ${voucher.currency} ${voucher.amount}
Nuevo Disponible: ${voucher.currency} ${voucher.new_available_balance}`;
    return this.sendMessage(to, text);
  }

  async sendInteractiveMenu(to: string, clientName: string): Promise<boolean> {
    const text = `¡Hola, *${clientName}*! Bienvenido a Corp-Credit POS.
1️⃣ Crédito Aprobado
2️⃣ Crédito Disponible
3️⃣ Última Factura / Consumo
4️⃣ Historial de Movimientos
5️⃣ Solicitar Nuevo Monto`;
    return this.sendMessage(to, text);
  }
}

