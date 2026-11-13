import { Injectable, UnauthorizedException, OnModuleInit } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../../database/entities/user.entity';
import { Company } from '../../database/entities/company.entity';
import { CashRegister } from '../../database/entities/cash-register.entity';
import { UserRole, CompanyStatus, CashRegisterStatus } from '../../common/enums';
import { LoginDto, AuthResponseDto } from './dto/login.dto';

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(CashRegister)
    private readonly cashRegisterRepository: Repository<CashRegister>,
    private readonly jwtService: JwtService,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.seedInitialData();
  }

  async validateUser(loginDto: LoginDto): Promise<AuthResponseDto> {
    const user = await this.userRepository.findOne({
      where: { username: loginDto.username.trim(), is_active: true },
    });

    if (!user) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Credenciales inválidas');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      companyId: user.company_id,
    };

    const token = this.jwtService.sign(payload);

    return {
      access_token: token,
      user: {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        role: user.role,
        company_id: user.company_id,
      },
    };
  }

  /**
   * Automatically seeds initial demo companies, cash registers, and users
   * to ensure zero-setup readiness.
   */
  private async seedInitialData(): Promise<void> {
    const count = await this.userRepository.count();
    if (count > 0) return;

    // 1. Seed demo companies
    const employerCompany = this.companyRepository.create({
      code: 'EMP-CORP-01',
      name: 'Grupo Corporativo Industrial S.A.',
      ruc: 'J0310000001011',
      address: 'Km 6.5 Carretera Norte, Managua',
      phone: '+505 2244-1000',
      is_employer: true,
      is_merchant: false,
      status: CompanyStatus.ACTIVE,
      created_by: 'SYSTEM_SEED',
    });
    const savedEmployer = await this.companyRepository.save(employerCompany);

    const merchantCompany = this.companyRepository.create({
      code: 'MER-SUPER-01',
      name: 'Supermercados & Tiendas Corporativas S.A.',
      ruc: 'J0310000002022',
      address: 'Plaza Inter, Managua',
      phone: '+505 2255-2000',
      is_employer: false,
      is_merchant: true,
      status: CompanyStatus.ACTIVE,
      created_by: 'SYSTEM_SEED',
    });
    const savedMerchant = await this.companyRepository.save(merchantCompany);

    // 2. Seed Cash Register
    const cashRegister = this.cashRegisterRepository.create({
      company_id: savedMerchant.id,
      terminal_code: 'POS-CAJA-01',
      name: 'Terminal Caja Principal 01',
      location: 'Caja Rápida 1',
      status: CashRegisterStatus.OPEN,
      created_by: 'SYSTEM_SEED',
    });
    await this.cashRegisterRepository.save(cashRegister);

    // 3. Seed Users
    const saltRounds = 10;
    const defaultUsers = [
      {
        username: 'admin',
        password_hash: await bcrypt.hash('admin123', saltRounds),
        full_name: 'Administrador Maestro del Sistema',
        role: UserRole.SUPER_ADMIN,
        company_id: null,
      },
      {
        username: 'manager',
        password_hash: await bcrypt.hash('manager123', saltRounds),
        full_name: 'Gerente de Créditos y Cobranzas',
        role: UserRole.CREDIT_MANAGER,
        company_id: savedEmployer.id,
      },
      {
        username: 'caja1',
        password_hash: await bcrypt.hash('caja123', saltRounds),
        full_name: 'Cajero Principal Tienda',
        role: UserRole.CASHIER,
        company_id: savedMerchant.id,
      },
      {
        username: 'auditor',
        password_hash: await bcrypt.hash('auditor123', saltRounds),
        full_name: 'Auditor Financiero Externo',
        role: UserRole.AUDITOR,
        company_id: null,
      },
    ];

    for (const u of defaultUsers) {
      const userEntity = this.userRepository.create({
        ...u,
        is_active: true,
        created_by: 'SYSTEM_SEED',
      });
      await this.userRepository.save(userEntity);
    }
  }
}

