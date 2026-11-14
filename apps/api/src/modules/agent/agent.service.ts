import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditStatus } from '../../common/enums';
import { extractPhoneDigits } from '../../common/utils/phone.util';
import { ClientCreditProfile, CreditTransaction } from '../../database/entities';

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

export interface AgentBalanceResult {
  linked: boolean;
  queried_at: string;
  message?: string;
  client?: {
    full_name: string;
    employee_code: string;
    employer: string | null;
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
  queried_at: string;
  client?: {
    full_name: string;
    credit_status: string;
    currency: string;
    approved_limit: number;
    used_balance: number;
    available_balance: number;
  };
  movements: AgentMovement[];
}

/**
 * Provides real-time credit balance, movement history, and WhatsApp linking
 * queries for the OpenClaw agent directly against PostgreSQL.
 */
@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
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

  async getBalance(rawPhone: string): Promise<AgentBalanceResult> {
    const queriedAt = new Date().toISOString();
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
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

    const approved = Number(client.approved_limit);
    const used = Number(client.used_balance);
    const available = Number(client.available_balance);

    return {
      linked: true,
      queried_at: queriedAt,
      client: {
        full_name: `${client.first_name} ${client.last_name}`.trim(),
        employee_code: client.employee_code,
        employer: client.employer_company?.name ?? null,
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
      return { linked: false, queried_at: queriedAt, movements: [] };
    }

    const rows = await this.transactionRepository.find({
      where: { client_id: client.id },
      relations: { merchant_company: true },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 20),
    });

    return {
      linked: true,
      queried_at: queriedAt,
      client: {
        full_name: `${client.first_name} ${client.last_name}`.trim(),
        credit_status: client.credit_status,
        currency: 'C$',
        approved_limit: Number(client.approved_limit),
        used_balance: Number(client.used_balance),
        available_balance: Number(client.available_balance),
      },
      movements: rows.map((tx) => this.mapMovement(tx)),
    };
  }

  /**
   * Links a WhatsApp number to a client after the client states their cédula or carnet code.
   * Refuses to overwrite a number that already belongs to another client.
   */
  async linkPhone(
    rawPhone: string,
    identifier: string,
  ): Promise<{ linked: boolean; message: string; full_name?: string }> {
    const digits = this.extractRequiredDigits(rawPhone);
    const id = (identifier || '').trim();
    if (id.length < 4) throw new BadRequestException('Identificación inválida');

    const existing = await this.findClientByPhone(digits);
    if (existing) {
      return {
        linked: true,
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
      return { linked: false, message: 'No se encontró un cliente con esa identificación.' };
    }

    client.whatsapp_phone = digits;
    await this.clientRepository.save(client);
    return {
      linked: true,
      message: 'Número vinculado correctamente.',
      full_name: `${client.first_name} ${client.last_name}`.trim(),
    };
  }
}
