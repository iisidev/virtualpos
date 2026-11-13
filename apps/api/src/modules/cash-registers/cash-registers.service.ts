import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { CashRegisterStatus } from '../../common/enums';

@Injectable()
export class CashRegistersService {
  constructor(
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
  ) {}

  async findAll(companyId?: string): Promise<CashRegister[]> {
    const qb = this.cashRegisterRepository
      .createQueryBuilder('cr')
      .leftJoinAndSelect('cr.company', 'company')
      .orderBy('cr.terminal_code', 'ASC');

    if (companyId) {
      qb.where('cr.company_id = :companyId', { companyId });
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

  async updateStatus(id: string, status: CashRegisterStatus): Promise<CashRegister> {
    const cr = await this.findOne(id);
    cr.status = status;
    return this.cashRegisterRepository.save(cr);
  }
}
