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
import { requireEnv } from '../../common/config/require-env';

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

      // 4. Bootstrap the first administrator from environment variables (no hardcoded credentials).
      //    Other users are managed from the Admin panel. Existing users are never modified,
      //    unless ADMIN_RESET_PASSWORD=true is set explicitly.
      const adminUsername = requireEnv('ADMIN_USERNAME').trim().toLowerCase();
      const adminPassword = requireEnv('ADMIN_PASSWORD');
      const resetPassword = process.env.ADMIN_RESET_PASSWORD === 'true';

      const existingAdmin = await this.userRepository.findOne({
        where: { username: adminUsername },
      });

      if (!existingAdmin) {
        const adminEntity = this.userRepository.create({
          username: adminUsername,
          password_hash: await bcrypt.hash(adminPassword, 10),
          full_name: process.env.ADMIN_FULL_NAME?.trim() || 'Administrador del Sistema',
          role: UserRole.SUPER_ADMIN,
          company_id: null,
          is_active: true,
          created_by: 'SYSTEM_SEED',
        });
        await this.userRepository.save(adminEntity);
        this.logger.log(`Administrador inicial '${adminUsername}' creado desde variables de entorno.`);
      } else if (resetPassword) {
        existingAdmin.password_hash = await bcrypt.hash(adminPassword, 10);
        existingAdmin.is_active = true;
        existingAdmin.role = UserRole.SUPER_ADMIN;
        await this.userRepository.save(existingAdmin);
        this.logger.log(`Contraseña del administrador '${adminUsername}' restablecida desde variables de entorno.`);
      }
    } catch (err: unknown) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.logger.error(`Error en seed de datos iniciales: ${errorMsg}`);
    }
  }
}
