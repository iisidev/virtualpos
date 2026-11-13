import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Company } from '../../database/entities/company.entity';
import { CompanyStatus } from '../../common/enums';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
  ) {}

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
}
