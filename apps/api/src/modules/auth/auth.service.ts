import { Injectable, UnauthorizedException, OnModuleInit, Logger } from '@nestjs/common';
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
  private readonly logger = new Logger(AuthService.name);

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
    const cleanUsername = loginDto.username.trim().toLowerCase();

    const user = await this.userRepository
      .createQueryBuilder('u')
      .where('LOWER(u.username) = :uname', { uname: cleanUsername })
      .andWhere('u.is_active = :active', { active: true })
      .getOne();

    if (!user) {
      throw new UnauthorizedException(`Usuario '${loginDto.username}' no encontrado o se encuentra inactivo`);
    }

    const isMatch = await bcrypt.compare(loginDto.password, user.password_hash);
    if (!isMatch) {
      throw new UnauthorizedException('Contraseña incorrecta');
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
   * Automatically guarantees that demo companies, cash registers, and essential users
   * exist and have known passwords ready for login.
   */
  private async seedInitialData(): Promise<void> {
    try {
      // 1. Seed or retrieve employer company
      let savedEmployer = await this.companyRepository.findOne({
        where: { code: 'EMP-CORP-01' },
      });
      if (!savedEmployer) {
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
        savedEmployer = await this.companyRepository.save(employerCompany);
      }

      // 2. Seed or retrieve merchant company
      let savedMerchant = await this.companyRepository.findOne({
        where: { code: 'MER-SUPER-01' },
      });
      if (!savedMerchant) {
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
        savedMerchant = await this.companyRepository.save(merchantCompany);
      }

      // 3. Seed Cash Register
      let cashRegister = await this.cashRegisterRepository.findOne({
        where: { terminal_code: 'POS-CAJA-01' },
      });
      if (!cashRegister) {
        cashRegister = this.cashRegisterRepository.create({
          company_id: savedMerchant.id,
          terminal_code: 'POS-CAJA-01',
          name: 'Terminal Caja Principal 01',
          location: 'Caja Rápida 1',
          status: CashRegisterStatus.OPEN,
          created_by: 'SYSTEM_SEED',
        });
        await this.cashRegisterRepository.save(cashRegister);
      }

      // 4. Seed / Synchronize System Users
      const saltRounds = 10;
      const defaultUsers = [
        {
          username: 'admin',
          password: 'admin123',
          full_name: 'Administrador Maestro del Sistema',
          role: UserRole.SUPER_ADMIN,
          company_id: null,
        },
        {
          username: 'manager',
          password: 'manager123',
          full_name: 'Gerente de Créditos y Cobranzas',
          role: UserRole.CREDIT_MANAGER,
          company_id: savedEmployer.id,
        },
        {
          username: 'caja1',
          password: 'caja123',
          full_name: 'Cajero Principal Tienda',
          role: UserRole.CASHIER,
          company_id: savedMerchant.id,
        },
        {
          username: 'auditor',
          password: 'auditor123',
          full_name: 'Auditor Financiero Externo',
          role: UserRole.AUDITOR,
          company_id: null,
        },
      ];

      for (const u of defaultUsers) {
        const existing = await this.userRepository.findOne({
          where: { username: u.username },
        });

        const newHash = await bcrypt.hash(u.password, saltRounds);

        if (!existing) {
          const userEntity = this.userRepository.create({
            username: u.username,
            password_hash: newHash,
            full_name: u.full_name,
            role: u.role,
            company_id: u.company_id,
            is_active: true,
            created_by: 'SYSTEM_SEED',
          });
          await this.userRepository.save(userEntity);
          this.logger.log(`Usuario semilla '${u.username}' creado con éxito.`);
        } else {
          // Guarantee known password hash and active state for demo accounts
          existing.password_hash = newHash;
          existing.is_active = true;
          existing.role = u.role;
          await this.userRepository.save(existing);
        }
      }

      this.logger.log('✅ Usuarios del sistema verificados y listos para login: admin, manager, caja1, auditor');
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error en seed de datos iniciales: ${errorMsg}`);
    }
  }
}
