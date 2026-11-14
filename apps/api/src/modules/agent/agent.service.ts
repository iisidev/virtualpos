import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientCreditProfile, CreditTransaction } from '../../database/entities';

export interface AgentBalanceResult {
  linked: boolean;
  message?: string;
  client?: {
    full_name: string;
    employee_code: string;
    employer: string | null;
    credit_status: string;
    currency: string;
    approved_limit: number;
    used_balance: number;
    available_balance: number;
    consumption_percentage: number;
  };
}

export interface AgentMovement {
  date: string;
  type: string;
  amount: number;
  authorization_code: string;
  merchant: string | null;
  status: string;
}

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
  ) {}

  /** Keeps only digits; requires at least 8 (local Nicaraguan number length). */
  private normalizePhone(raw: string): string {
    const digits = (raw || '').replace(/\D/g, '');
    if (digits.length < 8) {
      throw new BadRequestException('Número de teléfono inválido');
    }
    return digits;
  }

  /**
   * Resolves exactly one client for a WhatsApp number. Matches the full number or
   * the last 8 digits so "+505 8888 1234", "50588881234" and "88881234" are equivalent.
   * Returns null when there is no match or when the number is ambiguous.
   */
  private async findClientByPhone(rawPhone: string): Promise<ClientCreditProfile | null> {
    const digits = this.normalizePhone(rawPhone);
    const local = digits.slice(-8);

    const matches = await this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'company')
      .where(`right(regexp_replace(c.whatsapp_phone, '\\D', '', 'g'), 8) = :local`, { local })
      .take(2)
      .getMany();

    return matches.length === 1 ? matches[0] : null;
  }

  async getBalance(rawPhone: string): Promise<AgentBalanceResult> {
    const client = await this.findClientByPhone(rawPhone);
    if (!client) {
      return {
        linked: false,
        message:
          'Este número no está vinculado a ningún cliente. Pida su cédula o código de carnet para vincularlo.',
      };
    }

    const approved = Number(client.approved_limit);
    const used = Number(client.used_balance);
    return {
      linked: true,
      client: {
        full_name: `${client.first_name} ${client.last_name}`.trim(),
        employee_code: client.employee_code,
        employer: client.employer_company?.name ?? null,
        credit_status: client.credit_status,
        currency: 'C$',
        approved_limit: approved,
        used_balance: used,
        available_balance: Number(client.available_balance),
        consumption_percentage: approved > 0 ? Number(((used / approved) * 100).toFixed(1)) : 0,
      },
    };
  }

  async getMovements(
    rawPhone: string,
    limit: number,
  ): Promise<{ linked: boolean; movements: AgentMovement[] }> {
    const client = await this.findClientByPhone(rawPhone);
    if (!client) return { linked: false, movements: [] };

    const rows = await this.transactionRepository.find({
      where: { client_id: client.id },
      relations: { merchant_company: true },
      order: { created_at: 'DESC' },
      take: Math.min(Math.max(limit, 1), 20),
    });

    return {
      linked: true,
      movements: rows.map((t) => ({
        date: new Date(t.created_at).toISOString(),
        type: t.transaction_type,
        amount: Number(t.amount),
        authorization_code: t.authorization_code,
        merchant: t.merchant_company?.name ?? null,
        status: t.status,
      })),
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
    const digits = this.normalizePhone(rawPhone);
    const id = (identifier || '').trim();
    if (id.length < 5) throw new BadRequestException('Identificación inválida');

    const existing = await this.findClientByPhone(digits);
    if (existing) {
      return { linked: true, message: 'Este número ya está vinculado.', full_name: `${existing.first_name} ${existing.last_name}`.trim() };
    }

    const client = await this.clientRepository.findOne({
      where: [{ national_id: id }, { employee_code: id }],
    });
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
