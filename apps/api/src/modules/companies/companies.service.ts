import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { CashRegisterStatus, CompanyStatus } from '../../common/enums';
import { CreateCompanyDto, UpdateCompanyDto } from './dto/company.dto';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
  ) {}

  private async closeOpenRegistersIfDisallowed(company: Company): Promise<void> {
    if (company.status !== CompanyStatus.ACTIVE || !company.is_merchant) {
      await this.cashRegisterRepository.update(
        { company_id: company.id, status: CashRegisterStatus.OPEN },
        { status: CashRegisterStatus.CLOSED },
      );
    }
  }

  async findAll(): Promise<Company[]> {
    return this.companyRepository.find({
      order: { name: 'ASC' },
      relations: { cash_registers: true },
    });
  }

  async findMerchants(): Promise<Company[]> {
    return this.companyRepository.find({
      where: { is_merchant: true, status: CompanyStatus.ACTIVE },
      relations: { cash_registers: true },
    });
  }

  async findEmployers(): Promise<Company[]> {
    return this.companyRepository.find({
      where: { is_employer: true, status: CompanyStatus.ACTIVE },
    });
  }

  async findOne(id: string): Promise<Company> {
    const comp = await this.companyRepository.findOne({
      where: { id },
      relations: { cash_registers: true },
    });
    if (!comp) {
      throw new NotFoundException(`Empresa con ID ${id} no encontrada`);
    }
    return comp;
  }

  async create(dto: CreateCompanyDto, createdBy?: string): Promise<Company> {
    const existingCode = await this.companyRepository.findOne({
      where: { code: dto.code.trim().toUpperCase() },
    });
    if (existingCode) {
      throw new ConflictException(`Ya existe una empresa con código '${dto.code}'`);
    }

    const existingRuc = await this.companyRepository.findOne({
      where: { ruc: dto.ruc.trim() },
    });
    if (existingRuc) {
      throw new ConflictException(`Ya existe una empresa con RUC '${dto.ruc}'`);
    }

    const company = this.companyRepository.create({
      code: dto.code.trim().toUpperCase(),
      name: dto.name.trim(),
      ruc: dto.ruc.trim(),
      address: dto.address?.trim() || '',
      phone: dto.phone?.trim() || '',
      is_employer: dto.is_employer ?? true,
      is_merchant: dto.is_merchant ?? false,
      status: dto.status ?? CompanyStatus.ACTIVE,
      created_by: createdBy || 'SYSTEM',
    });

    return this.companyRepository.save(company);
  }

  async update(id: string, dto: UpdateCompanyDto): Promise<Company> {
    const company = await this.findOne(id);

    if (dto.code && dto.code.trim().toUpperCase() !== company.code) {
      const existing = await this.companyRepository.findOne({
        where: { code: dto.code.trim().toUpperCase() },
      });
      if (existing) {
        throw new ConflictException(`El código '${dto.code}' ya está en uso`);
      }
      company.code = dto.code.trim().toUpperCase();
    }

    if (dto.ruc && dto.ruc.trim() !== company.ruc) {
      const existing = await this.companyRepository.findOne({
        where: { ruc: dto.ruc.trim() },
      });
      if (existing) {
        throw new ConflictException(`El RUC '${dto.ruc}' ya está en uso`);
      }
      company.ruc = dto.ruc.trim();
    }

    if (dto.name !== undefined) company.name = dto.name.trim();
    if (dto.address !== undefined) company.address = dto.address.trim();
    if (dto.phone !== undefined) company.phone = dto.phone.trim();
    if (dto.is_employer !== undefined) company.is_employer = dto.is_employer;
    if (dto.is_merchant !== undefined) company.is_merchant = dto.is_merchant;
    if (dto.status !== undefined) company.status = dto.status;

    const saved = await this.companyRepository.save(company);
    await this.closeOpenRegistersIfDisallowed(saved);
    return this.findOne(saved.id);
  }

  async toggleStatus(id: string): Promise<Company> {
    const company = await this.findOne(id);
    company.status =
      company.status === CompanyStatus.ACTIVE
        ? CompanyStatus.INACTIVE
        : CompanyStatus.ACTIVE;
    const saved = await this.companyRepository.save(company);
    await this.closeOpenRegistersIfDisallowed(saved);
    return this.findOne(saved.id);
  }
}
