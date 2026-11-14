import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ChannelType,
  CreditStatus,
  IncreaseRequestStatus,
} from '../../common/enums';
import {
  AgentAccessMode,
  isVipClassification,
  resolveAgentAccessMode,
} from '../../common/utils/classification.util';
import { extractPhoneDigits } from '../../common/utils/phone.util';
import {
  ClientCreditProfile,
  CreditIncreaseRequest,
  CreditTransaction,
} from '../../database/entities';

export interface AgentMovement {
  id: string;
  date: string;
  type: string;
  amount: number;
  voucher_number: string;
  authorization_code: string;
  external_invoice_number: string;
  merchant: string | null;
  status: string;
  previous_available_balance: number;
  new_available_balance: number;
}

export interface AgentCreditRequestItem {
  id: string;
  request_code: string;
  current_limit: number;
  requested_limit: number;
  reason: string;
  channel: string;
  status: string;
  review_notes: string | null;
  created_at: string;
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
    can_purchase: boolean;
    currency: string;
    approved_limit: number;
    used_balance: number;
    available_balance: number;
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
    currency: string;
    approved_limit: number;
    used_balance: number;
    available_balance: number;
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

/**
 * Provides real-time client profile/classification policy, credit balance,
 * movement history, WhatsApp linking, and credit increase requests for OpenClaw.
 */
@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
    @InjectRepository(CreditIncreaseRequest)
    private readonly increaseRequestRepository: Repository<CreditIncreaseRequest>,
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
      type: tx.transaction_type,
      amount: Number(tx.amount),
      voucher_number: tx.voucher_number,
      authorization_code: tx.authorization_code,
      external_invoice_number: tx.external_invoice_number,
      merchant: tx.merchant_company?.name ?? null,
      status: tx.status,
      previous_available_balance: Number(tx.previous_available_balance),
      new_available_balance: Number(tx.new_available_balance),
    };
  }

  private mapIncreaseRequest(req: CreditIncreaseRequest): AgentCreditRequestItem {
    return {
      id: req.id,
      request_code: `REQ-${req.id.substring(0, 8).toUpperCase()}`,
      current_limit: Number(req.current_limit),
      requested_limit: Number(req.requested_limit),
      reason: req.reason,
      channel: req.channel,
      status: req.status,
      review_notes: req.review_notes ?? null,
      created_at: new Date(req.created_at).toISOString(),
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
        can_purchase: client.credit_status === CreditStatus.ACTIVE && available > 0,
        currency: 'C$',
        approved_limit: approved,
        used_balance: used,
        available_balance: available,
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
        currency: 'C$',
        approved_limit: Number(client.approved_limit),
        used_balance: Number(client.used_balance),
        available_balance: Number(client.available_balance),
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
        message: `El nuevo límite solicitado (C$ ${numericLimit.toFixed(2)}) debe ser mayor a su límite aprobado actual (C$ ${currentLimit.toFixed(2)}).`,
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
        message: `Ya tiene una solicitud pendiente (${code}) por C$ ${Number(existingPending.requested_limit).toFixed(2)} esperando evaluación del Comité de Crédito.`,
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
      message: `Solicitud ${request.request_code} registrada por C$ ${numericLimit.toFixed(2)} y enviada al Comité de Crédito.`,
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
}
