import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'crypto';
import { Brackets, Repository } from 'typeorm';
import {
  ChannelType,
  CreditStatus,
  IncreaseRequestStatus,
  TransactionStatus,
  TransactionType,
} from '../../common/enums';
import {
  AgentAccessMode,
  isVipClassification,
  resolveAgentAccessMode,
} from '../../common/utils/classification.util';
import { extractPhoneDigits } from '../../common/utils/phone.util';
import {
  CREDIT_STATUS_LABELS,
  INCREASE_REQUEST_STATUS_LABELS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatCordoba,
  formatIsoDateDMY,
  formatWhatsAppDateTime,
  getManaguaCalendarDate,
  isValidIsoCalendarDate,
  shiftIsoCalendarDate,
  translateEnumLabel,
} from '../../common/utils/whatsapp-format.util';
import {
  ClientCreditProfile,
  CreditIncreaseRequest,
  CreditTransaction,
} from '../../database/entities';
import { WhatsAppNotificationsService } from '../notifications/whatsapp-notifications.service';

export interface AgentMovement {
  id: string;
  date: string;
  date_formatted: string;
  type: string;
  type_label: string;
  amount: number;
  amount_formatted: string;
  voucher_number: string;
  authorization_code: string;
  external_invoice_number: string;
  merchant: string | null;
  status: string;
  status_label: string;
  previous_available_balance: number;
  previous_available_balance_formatted: string;
  new_available_balance: number;
  new_available_balance_formatted: string;
}

export interface AgentCreditRequestItem {
  id: string;
  request_code: string;
  current_limit: number;
  current_limit_formatted: string;
  requested_limit: number;
  requested_limit_formatted: string;
  reason: string;
  channel: string;
  status: string;
  status_label: string;
  review_notes: string | null;
  created_at: string;
  created_at_formatted: string;
}

export interface AgentBalanceResult {
  linked: boolean;
  is_vip: boolean;
  agent_mode: AgentAccessMode;
  queried_at: string;
  message?: string;
  client?: {
    full_name: string;
    first_name: string;
    last_name: string;
    employee_code: string;
    national_id: string;
    job_title: string;
    grade_level: string;
    classification: string;
    is_vip: boolean;
    employer: string | null;
    whatsapp_phone: string;
    birth_date: string | null;
    credit_status: string;
    credit_status_label: string;
    can_purchase: boolean;
    currency: string;
    approved_limit: number;
    approved_limit_formatted: string;
    used_balance: number;
    used_balance_formatted: string;
    available_balance: number;
    available_balance_formatted: string;
    consumption_percentage: number;
    updated_at: string;
    last_movement: AgentMovement | null;
  };
}

export interface AgentMovementsResult {
  linked: boolean;
  is_vip: boolean;
  agent_mode: AgentAccessMode;
  queried_at: string;
  client?: {
    full_name: string;
    job_title: string;
    classification: string;
    is_vip: boolean;
    credit_status: string;
    credit_status_label: string;
    currency: string;
    approved_limit: number;
    approved_limit_formatted: string;
    used_balance: number;
    used_balance_formatted: string;
    available_balance: number;
    available_balance_formatted: string;
  };
  movements: AgentMovement[];
}

export interface AgentCreateCreditRequestResult {
  linked: boolean;
  created: boolean;
  duplicate?: boolean;
  is_vip: boolean;
  agent_mode: AgentAccessMode;
  request_code?: string;
  message: string;
  request?: AgentCreditRequestItem;
}

export interface AgentCreditRequestsResult {
  linked: boolean;
  is_vip: boolean;
  agent_mode: AgentAccessMode;
  queried_at: string;
  requests: AgentCreditRequestItem[];
}

export interface VipClientsSummaryResult {
  authorized: true;
  agent_mode: 'VIP_FULL_AGENT';
  queried_at: string;
  filter_company: string | null;
  totals: {
    total_clients: number;
    vip_clients: number;
    non_vip_clients: number;
    with_whatsapp_count: number;
    without_whatsapp_count: number;
    active_credits: number;
    frozen_credits: number;
    blocked_credits: number;
    pending_approval_credits: number;
  };
  by_company: Array<{
    company_id: string;
    company_code: string;
    company_name: string;
    client_count: number;
    vip_count: number;
    active_count: number;
    with_whatsapp_count: number;
  }>;
  by_classification: Array<{
    classification: string;
    is_vip: boolean;
    count: number;
  }>;
  by_credit_status: Array<{
    credit_status: string;
    credit_status_label: string;
    count: number;
  }>;
}

export interface VipClientLookupItem {
  id: string;
  registered: true;
  first_name: string;
  last_name: string;
  full_name: string;
  employee_code: string;
  national_id: string;
  employer: string | null;
  job_title: string;
  grade_level: string;
  classification: string;
  is_vip: boolean;
  whatsapp_phone: string | null;
  whatsapp_linked: boolean;
  birth_date: string | null;
  credit_status: string;
  credit_status_label: string;
  can_purchase: boolean;
  currency: 'C$';
  approved_limit: number;
  approved_limit_formatted: string;
  used_balance: number;
  used_balance_formatted: string;
  available_balance: number;
  available_balance_formatted: string;
  consumption_percentage: number;
}

export interface VipClientLookupResult {
  authorized: true;
  agent_mode: 'VIP_FULL_AGENT';
  queried_at: string;
  query: string;
  found: boolean;
  count: number;
  clients: VipClientLookupItem[];
  message?: string;
}

export interface VipSalesReportResult {
  authorized: true;
  agent_mode: 'VIP_FULL_AGENT';
  queried_at: string;
  period: string;
  period_label: string;
  from_date: string;
  to_date: string;
  group_by: 'total' | 'company';
  filter_company: string | null;
  totals: {
    sales_count: number;
    total_amount: number;
    total_amount_formatted: string;
    average_ticket: number;
    average_ticket_formatted: string;
    voided_count: number;
    voided_amount: number;
    voided_amount_formatted: string;
    companies_count: number;
    companies_involved: string[];
  };
  by_company: Array<{
    company_id: string;
    company_code: string;
    company_name: string;
    sales_count: number;
    total_amount: number;
    total_amount_formatted: string;
    share_percentage: number;
  }>;
  by_employer_company: Array<{
    company_id: string;
    company_name: string;
    sales_count: number;
    total_amount: number;
    total_amount_formatted: string;
  }>;
}

export interface VipBroadcastResult {
  authorized: true;
  agent_mode: 'VIP_FULL_AGENT';
  status: 'DRAFT_PENDING_APPROVAL' | 'SENDING' | 'COMPLETED' | 'RUNNING' | 'CANCELLED';
  requires_approval: boolean;
  sent_started: boolean;
  draft_id?: string;
  confirmation_code?: string;
  job_id?: string;
  recipients_count?: number;
  deliverable_count?: number;
  missing_country_code_count?: number;
  processed?: number;
  sent?: number;
  failed?: number;
  draft_message?: string;
  expires_in_minutes?: number;
  message: string;
}

interface PendingVipBroadcastDraft {
  id: string;
  confirmationCode: string;
  vipClientId: string;
  vipName: string;
  vipPhone: string;
  message: string;
  employerCompanyId?: string;
  recipientsCount: number;
  createdAt: number;
  expiresAt: number;
}

const BROADCAST_DRAFT_TTL_MS = 30 * 60 * 1000;

/**
 * Provides real-time client profile/classification policy, credit balance,
 * movement history, WhatsApp linking, credit increase requests, and VIP-only admin capabilities.
 */
@Injectable()
export class AgentService {
  private readonly broadcastDrafts = new Map<string, PendingVipBroadcastDraft>();

  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
    @InjectRepository(CreditIncreaseRequest)
    private readonly increaseRequestRepository: Repository<CreditIncreaseRequest>,
    private readonly whatsappNotifications: WhatsAppNotificationsService,
  ) {}

  private extractRequiredDigits(raw: string): string {
    const digits = extractPhoneDigits(raw);
    if (digits.length < 8) {
      throw new BadRequestException('Número de teléfono inválido');
    }
    return digits;
  }

  /**
   * Resolves exactly one client for a WhatsApp number or JID.
   * Prefers an exact normalized-digit match and falls back to a unique 8-digit
   * local suffix match when unambiguous; returns null otherwise.
   */
  private async findClientByPhone(rawPhone: string): Promise<ClientCreditProfile | null> {
    const digits = this.extractRequiredDigits(rawPhone);

    const exactMatches = await this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company')
      .where(`regexp_replace(c.whatsapp_phone, '[^0-9]', '', 'g') = :digits`, { digits })
      .take(2)
      .getMany();

    if (exactMatches.length === 1) return exactMatches[0];
    if (exactMatches.length > 1) return null;

    const local = digits.slice(-8);
    const localMatches = await this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company')
      .where(`right(regexp_replace(c.whatsapp_phone, '[^0-9]', '', 'g'), 8) = :local`, { local })
      .take(2)
      .getMany();

    return localMatches.length === 1 ? localMatches[0] : null;
  }

  private mapMovement(tx: CreditTransaction): AgentMovement {
    return {
      id: tx.id,
      date: new Date(tx.created_at).toISOString(),
      date_formatted: formatWhatsAppDateTime(tx.created_at),
      type: tx.transaction_type,
      type_label: translateEnumLabel(tx.transaction_type, TRANSACTION_TYPE_LABELS),
      amount: Number(tx.amount),
      amount_formatted: formatCordoba(tx.amount),
      voucher_number: tx.voucher_number,
      authorization_code: tx.authorization_code,
      external_invoice_number: tx.external_invoice_number,
      merchant: tx.merchant_company?.name ?? null,
      status: tx.status,
      status_label: translateEnumLabel(tx.status, TRANSACTION_STATUS_LABELS),
      previous_available_balance: Number(tx.previous_available_balance),
      previous_available_balance_formatted: formatCordoba(tx.previous_available_balance),
      new_available_balance: Number(tx.new_available_balance),
      new_available_balance_formatted: formatCordoba(tx.new_available_balance),
    };
  }

  private mapIncreaseRequest(req: CreditIncreaseRequest): AgentCreditRequestItem {
    return {
      id: req.id,
      request_code: `REQ-${req.id.substring(0, 8).toUpperCase()}`,
      current_limit: Number(req.current_limit),
      current_limit_formatted: formatCordoba(req.current_limit),
      requested_limit: Number(req.requested_limit),
      requested_limit_formatted: formatCordoba(req.requested_limit),
      reason: req.reason,
      channel: req.channel,
      status: req.status,
      status_label: translateEnumLabel(req.status, INCREASE_REQUEST_STATUS_LABELS),
      review_notes: req.review_notes ?? null,
      created_at: new Date(req.created_at).toISOString(),
      created_at_formatted: formatWhatsAppDateTime(req.created_at),
    };
  }

  async getBalance(rawPhone: string): Promise<AgentBalanceResult> {
    const queriedAt = new Date().toISOString();
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
        is_vip: false,
        agent_mode: 'UNLINKED',
        queried_at: queriedAt,
        message:
          'Este número no está vinculado a ningún cliente. Pida su cédula o código de carnet para vincularlo.',
      };
    }

    const latestTx = await this.transactionRepository.findOne({
      where: { client_id: client.id },
      relations: { merchant_company: true },
      order: { created_at: 'DESC' },
    });

    const isVip = isVipClassification(client.classification);
    const approved = Number(client.approved_limit);
    const used = Number(client.used_balance);
    const available = Number(client.available_balance);

    return {
      linked: true,
      is_vip: isVip,
      agent_mode: resolveAgentAccessMode(true, client.classification),
      queried_at: queriedAt,
      client: {
        full_name: `${client.first_name} ${client.last_name}`.trim(),
        first_name: client.first_name,
        last_name: client.last_name,
        employee_code: client.employee_code,
        national_id: client.national_id,
        job_title: client.job_title,
        grade_level: client.grade_level,
        classification: client.classification,
        is_vip: isVip,
        employer: client.employer_company?.name ?? null,
        whatsapp_phone: client.whatsapp_phone,
        birth_date: client.birth_date ?? null,
        credit_status: client.credit_status,
        credit_status_label: translateEnumLabel(client.credit_status, CREDIT_STATUS_LABELS),
        can_purchase: client.credit_status === CreditStatus.ACTIVE && available > 0,
        currency: 'C$',
        approved_limit: approved,
        approved_limit_formatted: formatCordoba(approved),
        used_balance: used,
        used_balance_formatted: formatCordoba(used),
        available_balance: available,
        available_balance_formatted: formatCordoba(available),
        consumption_percentage: approved > 0 ? Number(((used / approved) * 100).toFixed(1)) : 0,
        updated_at: new Date(client.updated_at).toISOString(),
        last_movement: latestTx ? this.mapMovement(latestTx) : null,
      },
    };
  }

  async getMovements(rawPhone: string, limit: number): Promise<AgentMovementsResult> {
    const queriedAt = new Date().toISOString();
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
        is_vip: false,
        agent_mode: 'UNLINKED',
        queried_at: queriedAt,
        movements: [],
      };
    }

    const rows = await this.transactionRepository.find({
      where: { client_id: client.id },
      relations: { merchant_company: true },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 20),
    });

    const isVip = isVipClassification(client.classification);
    return {
      linked: true,
      is_vip: isVip,
      agent_mode: resolveAgentAccessMode(true, client.classification),
      queried_at: queriedAt,
      client: {
        full_name: `${client.first_name} ${client.last_name}`.trim(),
        job_title: client.job_title,
        classification: client.classification,
        is_vip: isVip,
        credit_status: client.credit_status,
        credit_status_label: translateEnumLabel(client.credit_status, CREDIT_STATUS_LABELS),
        currency: 'C$',
        approved_limit: Number(client.approved_limit),
        approved_limit_formatted: formatCordoba(client.approved_limit),
        used_balance: Number(client.used_balance),
        used_balance_formatted: formatCordoba(client.used_balance),
        available_balance: Number(client.available_balance),
        available_balance_formatted: formatCordoba(client.available_balance),
      },
      movements: rows.map((tx) => this.mapMovement(tx)),
    };
  }

  async getCreditRequests(rawPhone: string, limit: number): Promise<AgentCreditRequestsResult> {
    const queriedAt = new Date().toISOString();
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
        is_vip: false,
        agent_mode: 'UNLINKED',
        queried_at: queriedAt,
        requests: [],
      };
    }

    const rows = await this.increaseRequestRepository.find({
      where: { client_id: client.id },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 10),
    });

    const isVip = isVipClassification(client.classification);
    return {
      linked: true,
      is_vip: isVip,
      agent_mode: resolveAgentAccessMode(true, client.classification),
      queried_at: queriedAt,
      requests: rows.map((r) => this.mapIncreaseRequest(r)),
    };
  }

  /**
   * Registers a credit limit increase request from WhatsApp for review by the Credit Committee.
   * Prevents duplicate simultaneous PENDING requests for the same client.
   */
  async createCreditRequest(
    rawPhone: string,
    requestedLimit: number,
    reason?: string,
  ): Promise<AgentCreateCreditRequestResult> {
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
        created: false,
        is_vip: false,
        agent_mode: 'UNLINKED',
        message:
          'Este número no está vinculado a ningún cliente. Pida su cédula o código de carnet para vincularlo.',
      };
    }

    const isVip = isVipClassification(client.classification);
    const agentMode = resolveAgentAccessMode(true, client.classification);

    if (client.credit_status === CreditStatus.BLOCKED) {
      return {
        linked: true,
        created: false,
        is_vip: isVip,
        agent_mode: agentMode,
        message: 'Su línea de crédito se encuentra bloqueada; contacte a un oficial de crédito.',
      };
    }

    const numericLimit = Number(requestedLimit);
    if (!Number.isFinite(numericLimit) || numericLimit <= 0) {
      throw new BadRequestException('El monto solicitado debe ser mayor a cero');
    }

    const currentLimit = Number(client.approved_limit);
    if (numericLimit <= currentLimit) {
      return {
        linked: true,
        created: false,
        is_vip: isVip,
        agent_mode: agentMode,
        message: `El nuevo límite solicitado (${formatCordoba(numericLimit)}) debe ser mayor a su límite aprobado actual (${formatCordoba(currentLimit)}).`,
      };
    }

    const existingPending = await this.increaseRequestRepository.findOne({
      where: { client_id: client.id, status: IncreaseRequestStatus.PENDING },
      order: { created_at: 'DESC' },
    });

    if (existingPending) {
      const code = `REQ-${existingPending.id.substring(0, 8).toUpperCase()}`;
      return {
        linked: true,
        created: false,
        duplicate: true,
        is_vip: isVip,
        agent_mode: agentMode,
        request_code: code,
        message: `Ya tiene una solicitud pendiente (${code}) por ${formatCordoba(existingPending.requested_limit)} esperando evaluación del Comité de Crédito.`,
        request: this.mapIncreaseRequest(existingPending),
      };
    }

    const cleanReason =
      (reason || '').trim() || 'Solicitud de aumento de crédito vía WhatsApp (OpenClaw)';

    const saved = await this.increaseRequestRepository.save(
      this.increaseRequestRepository.create({
        client_id: client.id,
        current_limit: client.approved_limit,
        requested_limit: numericLimit.toFixed(2),
        reason: cleanReason,
        channel: ChannelType.WHATSAPP_BOT,
        status: IncreaseRequestStatus.PENDING,
      }),
    );

    const request = this.mapIncreaseRequest(saved);
    return {
      linked: true,
      created: true,
      is_vip: isVip,
      agent_mode: agentMode,
      request_code: request.request_code,
      message: `Solicitud ${request.request_code} registrada por ${formatCordoba(numericLimit)} y enviada al Comité de Crédito.`,
      request,
    };
  }

  /**
   * Links a WhatsApp number to a client after the client states their cédula or carnet code.
   * Refuses to overwrite a number that already belongs to another client.
   */
  async linkPhone(
    rawPhone: string,
    identifier: string,
  ): Promise<{
    linked: boolean;
    is_vip: boolean;
    agent_mode: AgentAccessMode;
    classification?: string;
    message: string;
    full_name?: string;
  }> {
    const digits = this.extractRequiredDigits(rawPhone);
    const id = (identifier || '').trim();
    if (id.length < 4) throw new BadRequestException('Identificación inválida');

    const existing = await this.findClientByPhone(digits);
    if (existing) {
      const isVip = isVipClassification(existing.classification);
      return {
        linked: true,
        is_vip: isVip,
        agent_mode: resolveAgentAccessMode(true, existing.classification),
        classification: existing.classification,
        message: 'Este número ya está vinculado.',
        full_name: `${existing.first_name} ${existing.last_name}`.trim(),
      };
    }

    const client = await this.clientRepository
      .createQueryBuilder('c')
      .where('UPPER(TRIM(c.national_id)) = UPPER(:id) OR UPPER(TRIM(c.employee_code)) = UPPER(:id)', {
        id,
      })
      .getOne();

    if (!client) {
      return {
        linked: false,
        is_vip: false,
        agent_mode: 'UNLINKED',
        message: 'No se encontró un cliente con esa identificación.',
      };
    }

    client.whatsapp_phone = digits;
    await this.clientRepository.save(client);
    const isVip = isVipClassification(client.classification);
    return {
      linked: true,
      is_vip: isVip,
      agent_mode: resolveAgentAccessMode(true, client.classification),
      classification: client.classification,
      message: 'Número vinculado correctamente.',
      full_name: `${client.first_name} ${client.last_name}`.trim(),
    };
  }

  /** Verifies that the WhatsApp caller is a linked VIP client; throws 403 otherwise. */
  private async requireVipClient(rawPhone: string): Promise<ClientCreditProfile> {
    if (!rawPhone?.trim()) {
      throw new ForbiddenException(
        'Acceso denegado: esta función está disponible exclusivamente para clientes VIP.',
      );
    }
    const client = await this.findClientByPhone(rawPhone);
    if (!client || !isVipClassification(client.classification)) {
      throw new ForbiddenException(
        'Acceso denegado: esta función está disponible exclusivamente para clientes VIP.',
      );
    }
    return client;
  }

  /**
   * VIP #1: Real-time client counts by employer company, classification type, and credit status.
   */
  async getVipClientsSummary(
    rawPhone: string,
    companyFilter?: string,
  ): Promise<VipClientsSummaryResult> {
    await this.requireVipClient(rawPhone);
    const cleanCompany = (companyFilter || '').trim() || null;

    const qb = this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company');

    if (cleanCompany) {
      const term = `%${cleanCompany}%`;
      qb.where('(company.name ILIKE :term OR company.code ILIKE :term)', { term });
    }

    const clients = await qb.getMany();

    const companyBuckets = new Map<
      string,
      {
        company_id: string;
        company_code: string;
        company_name: string;
        client_count: number;
        vip_count: number;
        active_count: number;
        with_whatsapp_count: number;
      }
    >();
    const classBuckets = new Map<string, { classification: string; is_vip: boolean; count: number }>();
    const statusBuckets = new Map<string, number>();

    let vipClients = 0;
    let withWhatsApp = 0;
    let activeCredits = 0;
    let frozenCredits = 0;
    let blockedCredits = 0;
    let pendingCredits = 0;

    for (const c of clients) {
      const isVip = isVipClassification(c.classification);
      const hasWa = Boolean((c.whatsapp_phone || '').trim());
      if (isVip) vipClients += 1;
      if (hasWa) withWhatsApp += 1;

      if (c.credit_status === CreditStatus.ACTIVE) activeCredits += 1;
      else if (c.credit_status === CreditStatus.FROZEN) frozenCredits += 1;
      else if (c.credit_status === CreditStatus.BLOCKED) blockedCredits += 1;
      else if (c.credit_status === CreditStatus.PENDING_APPROVAL) pendingCredits += 1;

      const compId = c.employer_company?.id ?? c.employer_company_id ?? 'unassigned';
      const compBucket = companyBuckets.get(compId) ?? {
        company_id: compId,
        company_code: c.employer_company?.code ?? 'N/A',
        company_name: c.employer_company?.name ?? 'Sin empresa asignada',
        client_count: 0,
        vip_count: 0,
        active_count: 0,
        with_whatsapp_count: 0,
      };
      compBucket.client_count += 1;
      if (isVip) compBucket.vip_count += 1;
      if (c.credit_status === CreditStatus.ACTIVE) compBucket.active_count += 1;
      if (hasWa) compBucket.with_whatsapp_count += 1;
      companyBuckets.set(compId, compBucket);

      const clsName = (c.classification || 'SIN TIPIFICACIÓN').trim();
      const clsBucket = classBuckets.get(clsName) ?? {
        classification: clsName,
        is_vip: isVip,
        count: 0,
      };
      clsBucket.count += 1;
      classBuckets.set(clsName, clsBucket);

      statusBuckets.set(c.credit_status, (statusBuckets.get(c.credit_status) ?? 0) + 1);
    }

    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      queried_at: new Date().toISOString(),
      filter_company: cleanCompany,
      totals: {
        total_clients: clients.length,
        vip_clients: vipClients,
        non_vip_clients: clients.length - vipClients,
        with_whatsapp_count: withWhatsApp,
        without_whatsapp_count: clients.length - withWhatsApp,
        active_credits: activeCredits,
        frozen_credits: frozenCredits,
        blocked_credits: blockedCredits,
        pending_approval_credits: pendingCredits,
      },
      by_company: Array.from(companyBuckets.values()).sort(
        (a, b) => b.client_count - a.client_count || a.company_name.localeCompare(b.company_name),
      ),
      by_classification: Array.from(classBuckets.values()).sort(
        (a, b) => b.count - a.count || a.classification.localeCompare(b.classification),
      ),
      by_credit_status: Array.from(statusBuckets.entries())
        .map(([status, count]) => ({
          credit_status: status,
          credit_status_label: translateEnumLabel(status, CREDIT_STATUS_LABELS),
          count,
        }))
        .sort((a, b) => b.count - a.count),
    };
  }

  /**
   * VIP #2: Search registered clients by name, surname, national ID, employee code, or phone.
   */
  async lookupVipClients(
    rawPhone: string,
    rawQuery: string,
    limit = 10,
  ): Promise<VipClientLookupResult> {
    await this.requireVipClient(rawPhone);
    const clean = (rawQuery || '').trim();
    if (clean.length < 2) {
      throw new BadRequestException(
        'Ingrese al menos 2 caracteres (nombre, apellido, cédula, carnet o teléfono).',
      );
    }

    const safeLimit = Math.min(Math.max(Number(limit) || 10, 1), 20);
    const term = `%${clean}%`;
    const qDigits = extractPhoneDigits(clean);
    const tokens = clean.split(/\s+/).filter(Boolean);

    const rows = await this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company')
      .where(
        new Brackets((sub) => {
          sub
            .where('c.national_id ILIKE :term', { term })
            .orWhere('c.employee_code ILIKE :term', { term })
            .orWhere('c.whatsapp_phone ILIKE :term', { term })
            .orWhere(`CONCAT(c.first_name, ' ', c.last_name) ILIKE :term`, { term });

          if (tokens.length > 1) {
            sub.orWhere(
              new Brackets((nameQb) => {
                tokens.forEach((tok, idx) => {
                  const key = `tok${idx}`;
                  const clause = `CONCAT(c.first_name, ' ', c.last_name) ILIKE :${key}`;
                  if (idx === 0) nameQb.where(clause, { [key]: `%${tok}%` });
                  else nameQb.andWhere(clause, { [key]: `%${tok}%` });
                });
              }),
            );
          }

          if (qDigits.length >= 6) {
            sub.orWhere(`regexp_replace(c.whatsapp_phone, '[^0-9]', '', 'g') LIKE :qDigits`, {
              qDigits: `%${qDigits}%`,
            });
          }
        }),
      )
      .orderBy('c.first_name', 'ASC')
      .addOrderBy('c.last_name', 'ASC')
      .take(safeLimit)
      .getMany();

    const clients: VipClientLookupItem[] = rows.map((c) => {
      const approved = Number(c.approved_limit);
      const used = Number(c.used_balance);
      const available = Number(c.available_balance);
      return {
        id: c.id,
        registered: true,
        first_name: c.first_name,
        last_name: c.last_name,
        full_name: `${c.first_name} ${c.last_name}`.trim(),
        employee_code: c.employee_code,
        national_id: c.national_id,
        employer: c.employer_company?.name ?? null,
        job_title: c.job_title,
        grade_level: c.grade_level,
        classification: c.classification,
        is_vip: isVipClassification(c.classification),
        whatsapp_phone: c.whatsapp_phone || null,
        whatsapp_linked: Boolean((c.whatsapp_phone || '').trim()),
        birth_date: c.birth_date ?? null,
        credit_status: c.credit_status,
        credit_status_label: translateEnumLabel(c.credit_status, CREDIT_STATUS_LABELS),
        can_purchase: c.credit_status === CreditStatus.ACTIVE && available > 0,
        currency: 'C$',
        approved_limit: approved,
        approved_limit_formatted: formatCordoba(approved),
        used_balance: used,
        used_balance_formatted: formatCordoba(used),
        available_balance: available,
        available_balance_formatted: formatCordoba(available),
        consumption_percentage: approved > 0 ? Number(((used / approved) * 100).toFixed(1)) : 0,
      };
    });

    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      queried_at: new Date().toISOString(),
      query: clean,
      found: clients.length > 0,
      count: clients.length,
      clients,
      ...(clients.length === 0
        ? { message: `No se encontró ningún cliente registrado con "${clean}".` }
        : {}),
    };
  }

  private resolveSalesPeriod(
    periodRaw?: string,
    fromRaw?: string,
    toRaw?: string,
  ): {
    period: string;
    periodLabel: string;
    fromDate: string;
    toDate: string;
    start: Date;
    end: Date;
  } {
    const today = getManaguaCalendarDate();
    const rawFrom = (fromRaw || '').trim();
    const rawTo = (toRaw || '').trim();
    const normalized = (periodRaw || '').trim().toLowerCase();

    const aliasMap: Record<string, string> = {
      '': rawFrom || rawTo ? 'custom' : 'today',
      today: 'today',
      hoy: 'today',
      yesterday: 'yesterday',
      ayer: 'yesterday',
      week: 'week',
      semana: 'week',
      esta_semana: 'week',
      this_week: 'week',
      month: 'month',
      mes: 'month',
      este_mes: 'month',
      this_month: 'month',
      custom: 'custom',
      personalizado: 'custom',
      periodo: 'custom',
    };
    const period = aliasMap[normalized] ?? 'today';

    let fromDate = today;
    let toDate = today;
    let periodLabel = `Hoy (${formatIsoDateDMY(today)})`;

    if (period === 'yesterday') {
      const yesterday = shiftIsoCalendarDate(today, -1);
      fromDate = yesterday;
      toDate = yesterday;
      periodLabel = `Ayer (${formatIsoDateDMY(yesterday)})`;
    } else if (period === 'week') {
      const [y, m, d] = today.split('-').map(Number);
      const dayOfWeek = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      const offsetToMonday = (dayOfWeek + 6) % 7;
      fromDate = shiftIsoCalendarDate(today, -offsetToMonday);
      toDate = today;
      periodLabel = `Esta semana (${formatIsoDateDMY(fromDate)} al ${formatIsoDateDMY(toDate)})`;
    } else if (period === 'month') {
      fromDate = `${today.slice(0, 7)}-01`;
      toDate = today;
      periodLabel = `Este mes (${formatIsoDateDMY(fromDate)} al ${formatIsoDateDMY(toDate)})`;
    } else if (period === 'custom') {
      fromDate = rawFrom || rawTo || today;
      toDate = rawTo || rawFrom || today;
      if (!isValidIsoCalendarDate(fromDate) || !isValidIsoCalendarDate(toDate)) {
        throw new BadRequestException('Formato de fecha inválido; use YYYY-MM-DD.');
      }
      if (fromDate > toDate) {
        throw new BadRequestException('La fecha inicial (from) no puede ser mayor a la final (to).');
      }
      periodLabel =
        fromDate === toDate
          ? `Fecha ${formatIsoDateDMY(fromDate)}`
          : `Del ${formatIsoDateDMY(fromDate)} al ${formatIsoDateDMY(toDate)}`;
    }

    return {
      period,
      periodLabel,
      fromDate,
      toDate,
      start: new Date(`${fromDate}T00:00:00.000-06:00`),
      end: new Date(`${toDate}T23:59:59.999-06:00`),
    };
  }

  /**
   * VIP #3: Sales report for a day or date period, grouped by total or by merchant/employer company.
   */
  async getVipSalesReport(
    rawPhone: string,
    opts: {
      period?: string;
      from?: string;
      to?: string;
      groupBy?: string;
      company?: string;
    } = {},
  ): Promise<VipSalesReportResult> {
    await this.requireVipClient(rawPhone);
    const window = this.resolveSalesPeriod(opts.period, opts.from, opts.to);

    const groupRaw = (opts.groupBy || '').trim().toLowerCase();
    const groupBy: 'total' | 'company' =
      groupRaw === 'total' || groupRaw === 'resumen' ? 'total' : 'company';
    const cleanCompany = (opts.company || '').trim() || null;

    const qb = this.transactionRepository
      .createQueryBuilder('tx')
      .leftJoinAndSelect('tx.merchant_company', 'merchant')
      .leftJoinAndSelect('tx.client', 'client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .where('tx.transaction_type = :type', { type: TransactionType.PURCHASE_CHARGE })
      .andWhere('tx.created_at BETWEEN :start AND :end', {
        start: window.start,
        end: window.end,
      });

    if (cleanCompany) {
      qb.andWhere('(merchant.name ILIKE :comp OR merchant.code ILIKE :comp)', {
        comp: `%${cleanCompany}%`,
      });
    }

    const rows = await qb.getMany();

    let salesCount = 0;
    let totalAmount = 0;
    let voidedCount = 0;
    let voidedAmount = 0;

    const merchantMap = new Map<
      string,
      { company_id: string; company_code: string; company_name: string; sales_count: number; total_amount: number }
    >();
    const employerMap = new Map<
      string,
      { company_id: string; company_name: string; sales_count: number; total_amount: number }
    >();

    for (const tx of rows) {
      const amt = Number(tx.amount);
      if (tx.status === TransactionStatus.VOIDED) {
        voidedCount += 1;
        voidedAmount += amt;
        continue;
      }
      if (tx.status !== TransactionStatus.APPROVED) continue;

      salesCount += 1;
      totalAmount += amt;

      const mId = tx.merchant_company?.id ?? tx.merchant_company_id;
      const mBucket = merchantMap.get(mId) ?? {
        company_id: mId,
        company_code: tx.merchant_company?.code ?? 'N/A',
        company_name: tx.merchant_company?.name ?? 'Comercio Afiliado',
        sales_count: 0,
        total_amount: 0,
      };
      mBucket.sales_count += 1;
      mBucket.total_amount = Number((mBucket.total_amount + amt).toFixed(2));
      merchantMap.set(mId, mBucket);

      const empId = tx.client?.employer_company?.id ?? tx.client?.employer_company_id ?? 'unknown';
      const empBucket = employerMap.get(empId) ?? {
        company_id: empId,
        company_name: tx.client?.employer_company?.name ?? 'Sin empresa asignada',
        sales_count: 0,
        total_amount: 0,
      };
      empBucket.sales_count += 1;
      empBucket.total_amount = Number((empBucket.total_amount + amt).toFixed(2));
      employerMap.set(empId, empBucket);
    }

    totalAmount = Number(totalAmount.toFixed(2));
    voidedAmount = Number(voidedAmount.toFixed(2));
    const avgTicket = salesCount > 0 ? Number((totalAmount / salesCount).toFixed(2)) : 0;

    const sortedMerchants = Array.from(merchantMap.values())
      .map((m) => ({
        ...m,
        total_amount_formatted: formatCordoba(m.total_amount),
        share_percentage:
          totalAmount > 0 ? Number(((m.total_amount / totalAmount) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.total_amount - a.total_amount || b.sales_count - a.sales_count);

    const sortedEmployers = Array.from(employerMap.values())
      .map((e) => ({
        ...e,
        total_amount_formatted: formatCordoba(e.total_amount),
      }))
      .sort((a, b) => b.total_amount - a.total_amount || b.sales_count - a.sales_count);

    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      queried_at: new Date().toISOString(),
      period: window.period,
      period_label: window.periodLabel,
      from_date: window.fromDate,
      to_date: window.toDate,
      group_by: groupBy,
      filter_company: cleanCompany,
      totals: {
        sales_count: salesCount,
        total_amount: totalAmount,
        total_amount_formatted: formatCordoba(totalAmount),
        average_ticket: avgTicket,
        average_ticket_formatted: formatCordoba(avgTicket),
        voided_count: voidedCount,
        voided_amount: voidedAmount,
        voided_amount_formatted: formatCordoba(voidedAmount),
        companies_count: sortedMerchants.length,
        companies_involved: sortedMerchants.map((m) => m.company_name),
      },
      by_company: groupBy === 'total' ? [] : sortedMerchants,
      by_employer_company: groupBy === 'total' ? [] : sortedEmployers,
    };
  }

  private pruneExpiredBroadcastDrafts(): void {
    const now = Date.now();
    for (const [id, draft] of this.broadcastDrafts.entries()) {
      if (draft.expiresAt <= now) {
        this.broadcastDrafts.delete(id);
      }
    }
  }

  /**
   * VIP #4: Two-step broadcast notification (draft -> explicit VIP approval -> bulk send).
   */
  async handleVipBroadcast(
    rawPhone: string,
    input: {
      action?: 'draft' | 'confirm' | 'cancel' | 'status';
      message?: string;
      draft_id?: string;
      approve?: boolean;
      job_id?: string;
      employer_company_id?: string;
    },
  ): Promise<VipBroadcastResult> {
    const vip = await this.requireVipClient(rawPhone);
    this.pruneExpiredBroadcastDrafts();

    const action =
      input.action ??
      (input.job_id
        ? 'status'
        : input.draft_id && input.approve === true
          ? 'confirm'
          : input.draft_id && input.approve === false
            ? 'cancel'
            : 'draft');

    if (action === 'status') return this.getBroadcastJobStatus(input.job_id);
    if (action === 'cancel') return this.cancelBroadcastDraft(vip, input.draft_id);
    if (action === 'confirm') return this.confirmBroadcastDraft(vip, input.draft_id, input.approve);
    return this.createBroadcastDraft(vip, rawPhone, input.message, input.employer_company_id);
  }

  private getBroadcastJobStatus(jobId?: string): VipBroadcastResult {
    if (!jobId?.trim()) {
      throw new BadRequestException('El parámetro job_id es obligatorio para consultar estado.');
    }
    const job = this.whatsappNotifications.getJob(jobId.trim());
    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      status: job.status,
      requires_approval: false,
      sent_started: true,
      job_id: job.id,
      recipients_count: job.total,
      processed: job.processed,
      sent: job.sent,
      failed: job.failed,
      message:
        job.status === 'RUNNING'
          ? `Envío en curso: ${job.processed} de ${job.total} procesados (${job.sent} enviados).`
          : `Envío finalizado: ${job.sent} enviados, ${job.failed} con error de ${job.total} totales.`,
    };
  }

  private async cancelBroadcastDraft(
    vip: ClientCreditProfile,
    rawDraftId?: string,
  ): Promise<VipBroadcastResult> {
    const draftId = (rawDraftId || '').trim();
    const draft = draftId ? this.broadcastDrafts.get(draftId) : undefined;
    if (draft && draft.vipClientId === vip.id) {
      this.broadcastDrafts.delete(draftId);
      await this.whatsappNotifications
        .recordAudit('WHATSAPP_VIP_BROADCAST_CANCELLED', draftId, null, {
          requested_by_client_id: vip.id,
          confirmation_code: draft.confirmationCode,
        })
        .catch(() => undefined);
    }
    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      status: 'CANCELLED',
      requires_approval: false,
      sent_started: false,
      message: 'Borrador cancelado. No se envió ninguna notificación.',
    };
  }

  private async confirmBroadcastDraft(
    vip: ClientCreditProfile,
    rawDraftId?: string,
    approve?: boolean,
  ): Promise<VipBroadcastResult> {
    const draftId = (rawDraftId || '').trim();
    if (!draftId || approve !== true) {
      throw new BadRequestException(
        'Debe generar primero un borrador y confirmar explícitamente (draft_id y approve=true) para enviar.',
      );
    }
    const draft = this.broadcastDrafts.get(draftId);
    if (!draft || draft.vipClientId !== vip.id) {
      throw new BadRequestException(
        'El borrador no existe, expiró o pertenece a otro usuario. Genere un nuevo borrador.',
      );
    }

    this.broadcastDrafts.delete(draftId);
    const vipName = `${vip.first_name} ${vip.last_name}`.trim();
    const job = await this.whatsappNotifications.startCustomBulk(draft.message, {
      userId: null,
      employerCompanyId: draft.employerCompanyId,
      auditAction: 'WHATSAPP_VIP_BROADCAST_SENT',
      auditMeta: {
        requested_by_client_id: vip.id,
        requested_by_name: vipName,
        requested_by_phone: draft.vipPhone,
        confirmation_code: draft.confirmationCode,
        message_preview: draft.message.slice(0, 140),
      },
    });

    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      status: 'SENDING',
      requires_approval: false,
      sent_started: true,
      job_id: job.id,
      confirmation_code: draft.confirmationCode,
      recipients_count: job.total,
      draft_message: draft.message,
      message: `Envío masivo aprobado e iniciado para ${job.total} clientes activos.`,
    };
  }

  private async createBroadcastDraft(
    vip: ClientCreditProfile,
    rawPhone: string,
    rawMessage?: string,
    employerCompanyId?: string,
  ): Promise<VipBroadcastResult> {
    const cleanMessage = (rawMessage || '').trim();
    if (cleanMessage.length < 5) {
      throw new BadRequestException(
        'El texto de la notificación debe tener al menos 5 caracteres.',
      );
    }
    if (this.whatsappNotifications.hasRunningJob()) {
      throw new ConflictException(
        'Ya hay un envío masivo en curso. Espere a que termine antes de preparar otro.',
      );
    }

    const recipients = await this.whatsappNotifications.countEligibleRecipients(employerCompanyId);
    if (recipients.with_whatsapp === 0) {
      throw new BadRequestException(
        'No hay clientes activos con WhatsApp registrado para recibir esta notificación.',
      );
    }

    const draftId = randomUUID();
    const confirmationCode = `ENV-${draftId.substring(0, 6).toUpperCase()}`;
    const vipName = `${vip.first_name} ${vip.last_name}`.trim();
    this.broadcastDrafts.set(draftId, {
      id: draftId,
      confirmationCode,
      vipClientId: vip.id,
      vipName,
      vipPhone: extractPhoneDigits(rawPhone),
      message: cleanMessage,
      employerCompanyId,
      recipientsCount: recipients.with_whatsapp,
      createdAt: Date.now(),
      expiresAt: Date.now() + BROADCAST_DRAFT_TTL_MS,
    });

    await this.whatsappNotifications
      .recordAudit('WHATSAPP_VIP_BROADCAST_DRAFT', draftId, null, {
        requested_by_client_id: vip.id,
        requested_by_name: vipName,
        confirmation_code: confirmationCode,
        recipients_count: recipients.with_whatsapp,
        message_preview: cleanMessage.slice(0, 140),
      })
      .catch(() => undefined);

    return {
      authorized: true,
      agent_mode: 'VIP_FULL_AGENT',
      status: 'DRAFT_PENDING_APPROVAL',
      requires_approval: true,
      sent_started: false,
      draft_id: draftId,
      confirmation_code: confirmationCode,
      recipients_count: recipients.with_whatsapp,
      deliverable_count: recipients.deliverable_e164,
      missing_country_code_count: recipients.missing_country_code,
      draft_message: cleanMessage,
      expires_in_minutes: 30,
      message: `Borrador ${confirmationCode} listo para ${recipients.with_whatsapp} clientes activos. Muéstralo al usuario y solicita su aprobación antes de enviar.`,
    };
  }
}
