import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import {
  ClientCreditProfile,
  CreditTransaction,
  CreditIncreaseRequest,
} from '../../database/entities';
import {
  ChannelType,
  IncreaseRequestStatus,
  TransactionStatus,
} from '../../common/enums';
import { OpenClawProvider } from './providers/openclaw.provider';
import { WhatsAppProviderInterface } from './interfaces/whatsapp-provider.interface';
import { classifyWhatsAppIntent, WhatsAppIntent } from './whatsapp-intent.classifier';

export { WhatsAppIntent };

@Injectable()
export class WhatsAppService {
  private readonly logger = new Logger(WhatsAppService.name);
  private provider: WhatsAppProviderInterface;
  private readonly userSessionState = new Map<string, { step: string; attempts: number }>();

  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
    @InjectRepository(CreditIncreaseRequest)
    private readonly increaseRequestRepository: Repository<CreditIncreaseRequest>,
    private readonly config: ConfigService,
    private readonly openClawProvider: OpenClawProvider,
  ) {
    // OpenClaw is the primary real connected WhatsApp gateway
    this.provider = this.openClawProvider;
  }

  /**
   * Fast, deterministic NLP intent parser: Zero external AI dependencies or mocks.
   */
  classifyIntent(message: string): { intent: WhatsAppIntent; requestedAmount?: number } {
    return classifyWhatsAppIntent(message);
  }

  /**
   * Main conversational orchestrator for incoming WhatsApp messages
   */
  async handleIncomingMessage(fromPhone: string, messageText: string): Promise<string> {
    const cleanPhone = fromPhone.replace(/\D/g, '');
    const cleanText = messageText.trim();

    this.logger.log(`[WhatsApp Webhook] Mensaje recibido de ${cleanPhone}: "${cleanText}"`);

    // 1. Look for client linked with this phone number
    let client = await this.clientRepository.findOne({
      where: { whatsapp_phone: cleanPhone },
      relations: { employer_company: true },
    });

    // 2. If not linked, check session state or attempt linking
    if (!client) {
      return this.handleUnlinkedUser(cleanPhone, cleanText);
    }

    // 3. User is linked! Process deterministic intent
    const { intent, requestedAmount } = this.classifyIntent(cleanText);

    switch (intent) {
      case 'CHECK_APPROVED': {
        const approvedFormatted = Number(client.approved_limit).toLocaleString('es-NI', {
          minimumFractionDigits: 2,
        });
        const reply = `🏦 *Límite de Crédito Aprobado*
Estimado(a) *${client.first_name}*, su límite total autorizado por *${client.employer_company?.name || 'su empresa'}* es de:
👉 *C$ ${approvedFormatted}*

_Para consultar su saldo disponible para compras, escriba *2*._`;
        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      case 'CHECK_AVAILABLE': {
        const available = Number(client.available_balance);
        const used = Number(client.used_balance);
        const approved = Number(client.approved_limit);
        const pct = approved > 0 ? ((used / approved) * 100).toFixed(1) : '0';

        const reply = `🟢 *Disponibilidad de Crédito Inmediata*
👤 *${client.first_name} ${client.last_name}*
━━━━━━━━━━━━━━━━━━━━━
💵 *DISPONIBLE PARA COMPRAS:* *C$ ${available.toLocaleString('es-NI', { minimumFractionDigits: 2 })}*
📊 Saldo Consumido: C$ ${used.toLocaleString('es-NI', { minimumFractionDigits: 2 })} (${pct}%)
🛡️ Estado de Línea: *${client.credit_status}*
━━━━━━━━━━━━━━━━━━━━━
_Puede utilizar su cédula o código de carnet *${client.employee_code}* en las cajas de nuestras tiendas afiliadas._`;
        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      case 'LAST_INVOICE': {
        const lastTx = await this.transactionRepository.findOne({
          where: { client_id: client.id, status: TransactionStatus.APPROVED },
          relations: { merchant_company: true, cash_register: true },
          order: { created_at: 'DESC' },
        });

        if (!lastTx) {
          const reply = `ℹ️ Estimado(a) *${client.first_name}*, aún no registra consumos en el sistema. Su crédito disponible está al 100%.`;
          await this.provider.sendMessage(cleanPhone, reply);
          return reply;
        }

        const reply = `🧾 *Detalle de su Última Compra*
━━━━━━━━━━━━━━━━━━━━━
🏪 Comercio: *${lastTx.merchant_company?.name || 'Tienda Afiliada'}*
📅 Fecha: ${new Date(lastTx.created_at).toLocaleString('es-NI')}
🔢 No. Autorización: *${lastTx.authorization_code}*
🧾 Factura Externa: *${lastTx.external_invoice_number}*
💵 Monto Cobrado: *C$ ${Number(lastTx.amount).toLocaleString('es-NI', { minimumFractionDigits: 2 })}*
🟢 Saldo Disponible tras compra: C$ ${Number(lastTx.new_available_balance).toLocaleString('es-NI', { minimumFractionDigits: 2 })}
━━━━━━━━━━━━━━━━━━━━━`;
        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      case 'HISTORY': {
        const history = await this.transactionRepository.find({
          where: { client_id: client.id },
          relations: { merchant_company: true },
          order: { created_at: 'DESC' },
          take: 5,
        });

        if (history.length === 0) {
          const reply = `ℹ️ No registra movimientos recientes en su estado de cuenta.`;
          await this.provider.sendMessage(cleanPhone, reply);
          return reply;
        }

        let reply = `📜 *Últimos Movimientos de Cuenta:*\n━━━━━━━━━━━━━━━━━━━━━\n`;
        for (const h of history) {
          const sign = h.transaction_type === 'PURCHASE_CHARGE' ? '🔴 -' : '🟢 +';
          reply += `${sign} C$ ${Number(h.amount).toFixed(2)} | ${h.transaction_type}\n   📅 ${new Date(h.created_at).toLocaleDateString('es-NI')} | Auth: ${h.authorization_code}\n`;
        }
        reply += `━━━━━━━━━━━━━━━━━━━━━\nSaldo disponible actual: *C$ ${Number(client.available_balance).toLocaleString('es-NI', { minimumFractionDigits: 2 })}*`;

        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      case 'REQUEST_INCREASE': {
        const requestedAmt = requestedAmount || Number(client.approved_limit) * 1.3;
        const request = this.increaseRequestRepository.create({
          client_id: client.id,
          current_limit: client.approved_limit,
          requested_limit: requestedAmt.toFixed(2),
          reason: `Solicitud vía WhatsApp Bot: "${cleanText}"`,
          channel: ChannelType.WHATSAPP_BOT,
          status: IncreaseRequestStatus.PENDING,
        });
        await this.increaseRequestRepository.save(request);

        const reply = `📝 *Solicitud de Aumento de Crédito Registrada*
Estimado(a) *${client.first_name}*, su solicitud para ajustar su límite a *C$ ${requestedAmt.toLocaleString('es-NI', { minimumFractionDigits: 2 })}* ha sido enviada al Comité de Crédito de *${client.employer_company?.name || 'su empresa'}*.
📌 No. de Gestión: *REQ-${request.id.substring(0, 8).toUpperCase()}*
Le notificaremos por este mismo medio tan pronto sea evaluada.`;

        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      case 'TALK_TO_HUMAN': {
        const reply = `👨‍💼 *Atención al Colaborador*
Un oficial del Departamento de Crédito y Cobranzas tomará contacto con usted en breve en horario laboral (Lunes a Viernes de 8:00 AM a 5:00 PM).
Para emergencias, puede llamar directamente al teléfono corporativo de su empresa.`;
        await this.provider.sendMessage(cleanPhone, reply);
        return reply;
      }

      default: {
        // Welcome and default interactive menu
        await this.provider.sendInteractiveMenu(cleanPhone, `${client.first_name} ${client.last_name}`);
        return 'MENU_SENT';
      }
    }
  }

  /**
   * Secure self-linking flow: verifies Cedula or Employee Code
   */
  private async handleUnlinkedUser(fromPhone: string, text: string): Promise<string> {
    const session = this.userSessionState.get(fromPhone) || { step: 'AWAITING_ID', attempts: 0 };

    const tokens = text.split(/\s+/);
    let matchedClient: ClientCreditProfile | null = null;

    for (const token of tokens) {
      const trimmed = token.trim();
      if (trimmed.length >= 7) {
        matchedClient = await this.clientRepository.findOne({
          where: [{ national_id: trimmed }, { employee_code: trimmed }],
          relations: { employer_company: true },
        });
        if (matchedClient) break;
      }
    }

    if (matchedClient) {
      matchedClient.whatsapp_phone = fromPhone;
      await this.clientRepository.save(matchedClient);
      this.userSessionState.delete(fromPhone);

      const welcome = `🎉 *¡Cuenta Vinculada con Éxito!*
Hola, *${matchedClient.first_name} ${matchedClient.last_name}*.
Su número de WhatsApp ha sido enlazado a su línea de crédito corporativo en *${matchedClient.employer_company?.name || 'su empresa'}*.`;
      await this.provider.sendMessage(fromPhone, welcome);
      await this.provider.sendInteractiveMenu(fromPhone, matchedClient.first_name);
      return welcome;
    }

    session.attempts += 1;
    this.userSessionState.set(fromPhone, session);

    const prompt = `👋 *Bienvenido al Sistema de Crédito Corporativo Corp-Credit*
Para acceder a sus consultas de saldo, por favor responda con su número de *Cédula de Identidad* (ejemplo: *001-121092-0000X*) o su *Código de Carnet*.`;
    await this.provider.sendMessage(fromPhone, prompt);
    return prompt;
  }
}
