import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WhatsAppProviderInterface } from '../interfaces/whatsapp-provider.interface';
import { VoucherDetails } from '../../credit/credit-ledger.service';

@Injectable()
export class OpenClawProvider implements WhatsAppProviderInterface {
  readonly providerName = 'OPENCLAW';
  private readonly logger = new Logger(OpenClawProvider.name);
  private readonly gatewayUrl: string;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.gatewayUrl = this.config.getOrThrow<string>('OPENCLAW_GATEWAY_URL');
    this.apiKey = this.config.getOrThrow<string>('OPENCLAW_API_KEY');
  }

  /**
   * Sends a WhatsApp text through the OpenClaw Gateway control-plane API
   * (POST /tools/invoke -> tool "message", action "send").
   * `to` must be a destination understood by WhatsApp (E.164, e.g. +50588881234).
   */
  async sendText(to: string, message: string): Promise<{ ok: boolean; error?: string }> {
    const url = `${this.gatewayUrl.replace(/\/+$/, '')}/tools/invoke`;
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'x-openclaw-message-channel': 'whatsapp',
          'x-openclaw-message-to': to,
        },
        body: JSON.stringify({
          tool: 'message',
          action: 'send',
          args: { channel: 'whatsapp', target: to, message },
        }),
        signal: AbortSignal.timeout(15000),
      });

      const raw = await response.text();
      if (!response.ok) {
        const detail = raw.slice(0, 300);
        this.logger.warn(`OpenClaw /tools/invoke respondió ${response.status}: ${detail}`);
        return { ok: false, error: `OpenClaw respondió ${response.status}: ${detail}` };
      }

      try {
        const parsed = JSON.parse(raw) as { ok?: boolean; error?: { message?: string } | string };
        if (parsed.ok === false) {
          const msg = typeof parsed.error === 'string' ? parsed.error : parsed.error?.message;
          return { ok: false, error: msg || 'OpenClaw rechazó el envío' };
        }
      } catch {
        // Non-JSON 2xx body: treat as accepted.
      }
      return { ok: true };
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error conectando con OpenClaw Gateway (${url}): ${errorMsg}`);
      return { ok: false, error: `No se pudo conectar con OpenClaw: ${errorMsg}` };
    }
  }

  async sendMessage(to: string, message: string): Promise<boolean> {
    const result = await this.sendText(to, message);
    return result.ok;
  }
  async sendVoucher(to: string, voucher: VoucherDetails): Promise<boolean> {
    const text = `🧾 *COMPROBANTE DE COMPRA CORPORATIVA*
━━━━━━━━━━━━━━━━━━━━━
🏪 *${voucher.merchant.name}*
📌 RUC: ${voucher.merchant.ruc}
📍 Caja: ${voucher.terminal.terminal_code} (${voucher.terminal.location})
👨‍💼 Cajero: ${voucher.cashier.full_name}

👤 *Cliente:* ${voucher.client.full_name}
🆔 *Cédula:* ${voucher.client.masked_national_id}
🏢 *Empresa:* ${voucher.client.employer_name}

🔢 *Autorización:* ${voucher.authorization_code}
📄 *No. Voucher:* ${voucher.voucher_number}
🧾 *Factura ERP:* ${voucher.external_invoice_number}
📅 *Fecha:* ${new Date(voucher.created_at).toLocaleString('es-NI')}

💵 *Monto de Compra:* ${voucher.currency} ${Number(voucher.amount).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
📊 *Disponible Anterior:* ${voucher.currency} ${Number(voucher.previous_available_balance).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
🟢 *NUEVO DISPONIBLE:* ${voucher.currency} ${Number(voucher.new_available_balance).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━
🔒 *Firma Digital:* ${voucher.signature_hash.substring(0, 16)}...
_Conserve este mensaje como comprobante de deducción autorizada._`;

    return this.sendMessage(to, text);
  }

  async sendInteractiveMenu(to: string, clientName: string): Promise<boolean> {
    const menu = `¡Hola, *${clientName}*! Bienvenido al Sistema de Crédito Corporativo.
Escribe el número de la opción que deseas consultar:
1️⃣ Crédito Aprobado
2️⃣ Crédito Disponible
3️⃣ Última Factura / Consumo
4️⃣ Historial de Movimientos (Últimos 5)
5️⃣ Solicitar Nuevo Monto de Crédito

_También puedes escribir tu consulta (ej: "¿Cuánto me queda disponible?")._`;

    return this.sendMessage(to, menu);
  }
}
