import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CashRegisterStatus, CompanyStatus, UserRole } from '../../common/enums';
import { CreateCashRegisterDto, UpdateCashRegisterDto } from './dto/cash-register.dto';

export interface FindCashRegistersFilter {
  companyId?: string;
  status?: CashRegisterStatus;
  onlyActiveCompanies?: boolean;
}

@Injectable()
export class CashRegistersService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
  ) {}

  async findAll(filter: FindCashRegistersFilter = {}): Promise<CashRegister[]> {
    const qb = this.cashRegisterRepository
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.company', 'company')
      .orderBy('company.name', 'ASC')
      .addOrderBy('cr.terminal_code', 'ASC');

    if (filter.companyId) {
      qb.andWhere('cr.company_id = :companyId', { companyId: filter.companyId });
    }
    if (filter.status) {
      qb.andWhere('cr.status = :status', { status: filter.status });
    }
    if (filter.onlyActiveCompanies) {
      qb.andWhere('company.status = :compStatus AND company.is_merchant = true', {
        compStatus: CompanyStatus.ACTIVE,
      });
    }

    return qb.getMany();
  }

  async findOne(id: string): Promise<CashRegister> {
    const cr = await this.cashRegisterRepository.findOne({
      where: { id },
      relations: { company: true },
    });
    if (!cr) {
      throw new NotFoundException(`Caja registradora con ID ${id} no encontrada`);
    }
    return cr;
  }

  private async validateMerchantCompany(
    companyId: string,
    requireActiveForOpen: boolean,
  ): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('La empresa comercio asociada no existe');
    }
    if (!company.is_merchant) {
      throw new BadRequestException(
        `La empresa '${company.name}' no está habilitada como Comercio Afiliado (POS)`,
      );
    }
    if (requireActiveForOpen && company.status !== CompanyStatus.ACTIVE) {
      throw new BadRequestException(
        `La empresa '${company.name}' está inactiva; actívela antes de abrir o crear cajas activas`,
      );
    }
    return company;
  }

  async create(dto: CreateCashRegisterDto, performedByUserId?: string): Promise<CashRegister> {
    const targetStatus = dto.status ?? CashRegisterStatus.CLOSED;
    await this.validateMerchantCompany(
      dto.company_id,
      targetStatus === CashRegisterStatus.OPEN,
    );

    const terminalCode = dto.terminal_code.trim().toUpperCase();
    const existing = await this.cashRegisterRepository.findOne({
      where: { terminal_code: terminalCode },
    });
    if (existing) {
      throw new ConflictException(`Ya existe una caja con el código de terminal '${terminalCode}'`);
    }

    const cr = this.cashRegisterRepository.create({
      company_id: dto.company_id,
      terminal_code: terminalCode,
      name: dto.name.trim(),
      location: dto.location?.trim() || '',
      status: targetStatus,
    });
    const saved = await this.cashRegisterRepository.save(cr);

    await this.auditRepository.save(
      this.auditRepository.create({
        action: 'CASH_REGISTER_CREATED',
        entity_type: 'CashRegister',
        entity_id: saved.id,
        new_data: JSON.stringify({
          company_id: saved.company_id,
          terminal_code: saved.terminal_code,
          name: saved.name,
          status: saved.status,
        }),
        performed_by_user_id: performedByUserId || null,
        created_at: new Date(),
      }),
    );

    return this.findOne(saved.id);
  }

  async update(
    id: string,
    dto: UpdateCashRegisterDto,
    performedByUserId?: string,
  ): Promise<CashRegister> {
    const cr = await this.findOne(id);
    const previousData = {
      company_id: cr.company_id,
      terminal_code: cr.terminal_code,
      name: cr.name,
      location: cr.location,
      status: cr.status,
    };

    const nextCompanyId = dto.company_id ?? cr.company_id;
    const nextStatus = dto.status ?? cr.status;
    await this.validateMerchantCompany(
      nextCompanyId,
      nextStatus === CashRegisterStatus.OPEN,
    );

    if (dto.terminal_code) {
      const normalized = dto.terminal_code.trim().toUpperCase();
      if (normalized !== cr.terminal_code) {
        const existing = await this.cashRegisterRepository.findOne({
          where: { terminal_code: normalized },
        });
        if (existing) {
          throw new ConflictException(`El código de terminal '${normalized}' ya está en uso`);
        }
        cr.terminal_code = normalized;
      }
    }

    cr.company_id = nextCompanyId;
    if (dto.name !== undefined) cr.name = dto.name.trim();
    if (dto.location !== undefined) cr.location = dto.location.trim();
    if (dto.status !== undefined) cr.status = dto.status;

    await this.cashRegisterRepository.save(cr);

    await this.auditRepository.save(
      this.auditRepository.create({
        action: 'CASH_REGISTER_UPDATED',
        entity_type: 'CashRegister',
        entity_id: cr.id,
        previous_data: JSON.stringify(previousData),
        new_data: JSON.stringify({
          company_id: cr.company_id,
          terminal_code: cr.terminal_code,
          name: cr.name,
          location: cr.location,
          status: cr.status,
        }),
        performed_by_user_id: performedByUserId || null,
        created_at: new Date(),
      }),
    );

    return this.findOne(id);
  }

  async updateStatus(
    id: string,
    status: CashRegisterStatus,
    actor?: { userId?: string; role?: UserRole; companyId?: string | null },
  ): Promise<CashRegister> {
    const cr = await this.findOne(id);

    if (actor?.role === UserRole.CASHIER) {
      if (actor.companyId && cr.company_id !== actor.companyId) {
        throw new ForbiddenException('No puede modificar cajas pertenecientes a otro comercio');
      }
      if (status === CashRegisterStatus.SUSPENDED) {
        throw new ForbiddenException('Solo un administrador o gestor puede suspender una caja');
      }
    }

    if (status === CashRegisterStatus.OPEN) {
      await this.validateMerchantCompany(cr.company_id, true);
    }

    const previousStatus = cr.status;
    cr.status = status;
    await this.cashRegisterRepository.save(cr);

    await this.auditRepository.save(
      this.auditRepository.create({
        action: 'CASH_REGISTER_STATUS_UPDATED',
        entity_type: 'CashRegister',
        entity_id: cr.id,
        previous_data: JSON.stringify({ status: previousStatus }),
        new_data: JSON.stringify({ status }),
        performed_by_user_id: actor?.userId || null,
        created_at: new Date(),
      }),
    );

    return this.findOne(id);
  }
}
