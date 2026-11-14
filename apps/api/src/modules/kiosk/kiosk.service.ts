import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { CreditTransaction } from '../../database/entities/credit-transaction.entity';
import { CreditStatus, TransactionStatus } from '../../common/enums';

export interface KioskDisplayData {
  client_id: string;
  full_name: string;
  masked_national_id: string;
  employee_code: string;
  employer_name: string;
  job_title: string;
  approved_limit: string;
  available_balance: string;
  credit_status: CreditStatus;
  status_color_class: 'emerald' | 'amber' | 'red';
  last_purchase: {
    date: Date | null;
    amount: string | null;
    merchant_name: string | null;
  } | null;
  whatsapp_qr_url: string;
  auto_reset_seconds: number;
}

@Injectable()
export class KioskService {
  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository: Repository<CreditTransaction>,
    private readonly config: ConfigService,
  ) {}

  async getKioskProfile(query: string): Promise<KioskDisplayData> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      throw new NotFoundException('Ingrese su Cédula o Código de Carnet');
    }

    const client = await this.clientRepository
      .createQueryBuilder('c')
      .leftJoinAndSelect('c.employer_company', 'employer')
      .where('c.national_id = :q OR c.employee_code = :q', { q: cleanQuery })
      .getOne();

    if (!client) {
      throw new NotFoundException(`No se encontró registro para "${cleanQuery}"`);
    }

    // Last approved purchase
    const lastTx = await this.transactionRepository.findOne({
      where: { client_id: client.id, status: TransactionStatus.APPROVED },
      relations: { merchant_company: true },
      order: { created_at: 'DESC' },
    });

    const botNumber = this.config.getOrThrow<string>('WHATSAPP_BOT_NUMBER');
    const waText = encodeURIComponent(`HOLA CONSULTA CEDULA ${client.national_id}`);
    const whatsappUrl = `https://wa.me/${botNumber}?text=${waText}`;

    const approved = Number(client.approved_limit);
    const used = Number(client.used_balance);
    const consumption = approved > 0 ? (used / approved) * 100 : 0;

    let colorClass: 'emerald' | 'amber' | 'red' = 'emerald';
    if (client.credit_status !== CreditStatus.ACTIVE) {
      colorClass = 'red';
    } else if (consumption > 75) {
      colorClass = 'amber';
    }

    const maskedId =
      client.national_id.length > 8
        ? client.national_id.substring(0, 4) + '******' + client.national_id.substring(client.national_id.length - 4)
        : client.national_id;

    return {
      client_id: client.id,
      full_name: `${client.first_name} ${client.last_name}`,
      masked_national_id: maskedId,
      employee_code: client.employee_code,
      employer_name: client.employer_company?.name || 'EMPRESA AFILIADA',
      job_title: client.job_title,
      approved_limit: client.approved_limit,
      available_balance: client.available_balance,
      credit_status: client.credit_status,
      status_color_class: colorClass,
      last_purchase: lastTx
        ? {
            date: lastTx.created_at,
            amount: lastTx.amount,
            merchant_name: lastTx.merchant_company?.name || 'Tienda Afiliada',
          }
        : null,
      whatsapp_qr_url: whatsappUrl,
      auto_reset_seconds: 15,
    };
  }
}
