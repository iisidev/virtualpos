import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { Repository } from 'typeorm';
import { AuditLog, ClientCreditProfile, CreditTransaction } from '../../database/entities';
import { CreditStatus } from '../../common/enums';
import { toWhatsAppE164 } from '../../common/utils/phone.util';
import { formatAmount } from '../../common/utils/whatsapp-format.util';
import { OpenClawProvider } from '../whatsapp/providers/openclaw.provider';

export interface SendResult {
  client_id: string;
  full_name: string;
  phone: string | null;
  ok: boolean;
  error?: string;
}

export interface ConsumptionNotificationResult {
  attempted: boolean;
  ok: boolean;
  phone: string | null;
  error?: string;
}

export interface BulkJob {
  id: string;
  status: 'RUNNING' | 'COMPLETED';
  total: number;
  processed: number;
  sent: number;
  failed: number;
  errors: SendResult[];
  started_at: string;
  finished_at: string | null;
}

@Injectable()
export class WhatsAppNotificationsService {
  private readonly logger = new Logger(WhatsAppNotificationsService.name);
  private readonly jobs = new Map<string, BulkJob>();
  private runningJobId: string | null = null;

  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly provider: OpenClawProvider,
    private readonly config: ConfigService,
  ) {}

  /** Welcome greeting plus the menu the OpenClaw skill understands (replies 1 to 4). */
  buildWelcomeMessage(firstName: string, employerName: string | null): string {
    const company = employerName ? ` de *${employerName}*` : '';
    return [
      `👋 ¡Hola, *${firstName}*! Bienvenido(a) al servicio de crédito corporativo${company}.`,
      '',
      'Responda con el número de la opción que desea consultar:',
      '1️⃣ Crédito aprobado',
      '2️⃣ Crédito disponible',
      '3️⃣ Últimos movimientos',
      '4️⃣ Solicitar aumento de crédito',
    ].join('\n');
  }

  getPreview(): { message: string } {
    return { message: this.buildWelcomeMessage('Nombre', 'su empresa') };
  }

  /** Builds the real-time WhatsApp message sent immediately after an approved purchase charge. */
  buildConsumptionMessage(
    merchantName: string,
    amount: number | string,
    availableBalance: number | string,
    voucherNumber?: string,
    authorizationCode?: string,
  ): string {
    const empresa = (merchantName || 'Comercio Afiliado').trim();
    const refs = [
      voucherNumber ? `Vale: ${voucherNumber}` : '',
      authorizationCode ? `Aut: ${authorizationCode}` : '',
    ].filter(Boolean);
    const refSuffix = refs.length > 0 ? `\n${refs.join(' · ')}` : '';
    return (
      `Se ha registrado un crédito en *${empresa}* por el monto de *C$ ${formatAmount(amount)}* ` +
      `consumiendo del crédito, quedando un monto disponible de *C$ ${formatAmount(availableBalance)}*.` +
      refSuffix
    );
  }

  /**
   * Sends a purchase consumption alert via OpenClaw without ever throwing or
   * blocking the underlying financial transaction.
   */
  async notifyPurchaseConsumption(tx: CreditTransaction): Promise<ConsumptionNotificationResult> {
    const rawPhone = tx.client?.whatsapp_phone?.trim() || '';
    if (!rawPhone) {
      return {
        attempted: false,
        ok: false,
        phone: null,
        error: 'Cliente sin número de WhatsApp registrado',
      };
    }

    const phone = this.toE164(rawPhone);
    if (!phone) {
      const error =
        'Teléfono sin código de país (defina WHATSAPP_DEFAULT_COUNTRY_CODE o guarde el número completo)';
      await this.audit('WHATSAPP_CONSUMPTION_FAILED', tx.id, tx.cashier_user_id, {
        client_id: tx.client_id,
        voucher_number: tx.voucher_number,
        error,
      }).catch(() => undefined);
      return { attempted: true, ok: false, phone: null, error };
    }

    const message = this.buildConsumptionMessage(
      tx.merchant_company?.name ?? 'Comercio Afiliado',
      tx.amount,
      tx.new_available_balance,
      tx.voucher_number,
      tx.authorization_code,
    );

    try {
      const result = await this.provider.sendText(phone, message);
      if (!result.ok) {
        this.logger.warn(`No se pudo notificar consumo por WhatsApp (${phone}): ${result.error}`);
      }
      await this.audit('WHATSAPP_CONSUMPTION_SENT', tx.id, tx.cashier_user_id, {
        client_id: tx.client_id,
        phone,
        ok: result.ok,
        voucher_number: tx.voucher_number,
        error: result.error ?? null,
      }).catch(() => undefined);
      return { attempted: true, ok: result.ok, phone, error: result.error };
    } catch (err: unknown) {
      const error = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Error inesperado enviando WhatsApp de consumo (${phone}): ${error}`);
      return { attempted: true, ok: false, phone, error };
    }
  }

  /** Normalizes a stored phone to E.164. Local 8-digit numbers need WHATSAPP_DEFAULT_COUNTRY_CODE. */
  private toE164(raw: string): string | null {
    const countryCode = this.config.get<string>('WHATSAPP_DEFAULT_COUNTRY_CODE');
    return toWhatsAppE164(raw, countryCode);
  }

  private async deliver(client: ClientCreditProfile): Promise<SendResult> {
    const fullName = `${client.first_name} ${client.last_name}`.trim();
    const phone = this.toE164(client.whatsapp_phone);
    if (!phone) {
      return {
        client_id: client.id,
        full_name: fullName,
        phone: null,
        ok: false,
        error: 'Teléfono sin código de país (defina WHATSAPP_DEFAULT_COUNTRY_CODE o guarde el número completo)',
      };
    }

    const text = this.buildWelcomeMessage(client.first_name, client.employer_company?.name ?? null);
    const result = await this.provider.sendText(phone, text);
    return { client_id: client.id, full_name: fullName, phone, ok: result.ok, error: result.error };
  }

  private async audit(
    action: string,
    entityId: string,
    userId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    await this.auditRepository.save(
      this.auditRepository.create({
        action,
        entity_type: 'WhatsAppNotification',
        entity_id: entityId,
        new_data: JSON.stringify(data),
        performed_by_user_id: userId,
        created_at: new Date(),
      }),
    );
  }

  async sendToClient(clientId: string, userId: string): Promise<SendResult> {
    const client = await this.clientRepository.findOne({
      where: { id: clientId },
      relations: { employer_company: true },
    });
    if (!client) throw new NotFoundException('Cliente no encontrado');
    if (!client.whatsapp_phone) {
      throw new BadRequestException('El cliente no tiene número de WhatsApp registrado');
    }

    const result = await this.deliver(client);
    await this.audit('WHATSAPP_WELCOME_SENT', client.id, userId, {
      ok: result.ok,
      phone: result.phone,
      error: result.error ?? null,
    });
    return result;
  }

  async startBulk(userId: string, employerCompanyId?: string): Promise<BulkJob> {
    if (this.runningJobId) {
      throw new ConflictException('Ya hay un envío masivo en curso. Espere a que termine.');
    }

    const qb = this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company')
      .where('c.credit_status = :status', { status: CreditStatus.ACTIVE })
      .andWhere(`COALESCE(TRIM(c.whatsapp_phone), '') <> ''`);
    if (employerCompanyId) {
      qb.andWhere('c.employer_company_id = :employerCompanyId', { employerCompanyId });
    }
    const clients = await qb.getMany();
    if (clients.length === 0) {
      throw new BadRequestException('No hay clientes activos con WhatsApp registrado para notificar');
    }

    const job: BulkJob = {
      id: randomUUID(),
      status: 'RUNNING',
      total: clients.length,
      processed: 0,
      sent: 0,
      failed: 0,
      errors: [],
      started_at: new Date().toISOString(),
      finished_at: null,
    };
    this.jobs.set(job.id, job);
    this.runningJobId = job.id;

    void this.runBulk(job, clients, userId);
    return job;
  }

  getJob(jobId: string): BulkJob {
    const job = this.jobs.get(jobId);
    if (!job) throw new NotFoundException('Envío masivo no encontrado');
    return job;
  }

  /**
   * Sequential sending with a pause between messages. WhatsApp (QR / unofficial session)
   * can flag bursts of identical messages, so the pace is configurable.
   */
  private async runBulk(job: BulkJob, clients: ClientCreditProfile[], userId: string): Promise<void> {
    const baseDelay = Number(this.config.get<string>('WHATSAPP_BULK_DELAY_MS') || 4000);
    try {
      for (const client of clients) {
        const result = await this.deliver(client);
        job.processed += 1;
        if (result.ok) {
          job.sent += 1;
        } else {
          job.failed += 1;
          job.errors.push(result);
        }
        if (job.processed < job.total) {
          const jitter = Math.floor(Math.random() * baseDelay * 0.5);
          await new Promise((resolve) => setTimeout(resolve, baseDelay + jitter));
        }
      }
    } catch (err: unknown) {
      this.logger.error(`Envío masivo ${job.id} interrumpido: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      job.status = 'COMPLETED';
      job.finished_at = new Date().toISOString();
      this.runningJobId = null;
      await this.audit('WHATSAPP_WELCOME_BULK', job.id, userId, {
        total: job.total,
        sent: job.sent,
        failed: job.failed,
      }).catch(() => undefined);
    }
  }
}

