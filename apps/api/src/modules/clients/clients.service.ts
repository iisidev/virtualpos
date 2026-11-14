import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  OnModuleInit,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import { CreditTransaction } from '../../database/entities/credit-transaction.entity';
import { CompanyStatus, CreditStatus, UserRole } from '../../common/enums';
import { CryptoService } from '../../common/crypto/crypto.service';
import {
  ConsumptionNotificationResult,
  WhatsAppNotificationsService,
} from '../notifications/whatsapp-notifications.service';
import { CreateClientDto, UpdateClientDto, UpdateClientStatusDto } from './dto/client.dto';

export interface ClientProfileResponse {
  id: string;
  employer_company_id: string;
  employer_name: string;
  employee_code: string;
  national_id: string;
  first_name: string;
  last_name: string;
  full_name: string;
  job_title: string;
  grade_level: string;
  classification: string;
  salary: string; // Decrypted if authorized, or "CONFIDENCIAL"
  whatsapp_phone: string;
  birth_date?: string | null;
  approved_limit: string;
  used_balance: string;
  available_balance: string;
  consumption_percentage: number;
  credit_status: CreditStatus;
  status_color_class: 'emerald' | 'amber' | 'red';
  created_at: Date;
  whatsapp_notification?: ConsumptionNotificationResult;
}

@Injectable()
export class ClientsService implements OnModuleInit {
  constructor(
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly cryptoService: CryptoService,
    @Optional() private readonly whatsappNotifications?: WhatsAppNotificationsService,
    @Optional()
    @InjectRepository(CreditTransaction)
    private readonly transactionRepository?: Repository<CreditTransaction>,
  ) {}

  private async assertEmployerScope(
    actorRole?: UserRole,
    actorCompanyId?: string | null,
    targetEmployerCompanyId?: string,
  ): Promise<void> {
    if (!actorCompanyId || !actorRole || actorRole === UserRole.SUPER_ADMIN || actorRole === UserRole.CASHIER) {
      return;
    }
    const actorCompany = await this.companyRepository.findOne({ where: { id: actorCompanyId } });
    if (actorCompany?.is_employer && targetEmployerCompanyId && actorCompany.id !== targetEmployerCompanyId) {
      throw new ForbiddenException(
        'No tiene permisos para eliminar o modificar clientes de otra empresa empleadora.',
      );
    }
  }

  private async validateEmployerCompany(companyId: string): Promise<Company> {
    const company = await this.companyRepository.findOne({ where: { id: companyId } });
    if (!company) {
      throw new NotFoundException('La empresa empleadora seleccionada no existe');
    }
    if (!company.is_employer) {
      throw new BadRequestException(
        `La empresa '${company.name}' no está configurada como Empresa Empleadora`,
      );
    }
    if (company.status !== CompanyStatus.ACTIVE) {
      throw new BadRequestException(
        `La empresa '${company.name}' está inactiva; actívela antes de asociar colaboradores`,
      );
    }
    return company;
  }

  async onModuleInit(): Promise<void> {
    await this.seedDemoClients();
  }

  async findAll(
    userRole: UserRole,
    filters?: {
      search?: string;
      employerCompanyId?: string;
      jobTitle?: string;
      gradeLevel?: string;
      classification?: string;
      creditStatus?: CreditStatus;
      scopedCompanyId?: string | null;
    },
  ): Promise<ClientProfileResponse[]> {
    const qb = this.clientRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .orderBy('client.created_at', 'DESC');

    if (filters?.scopedCompanyId && userRole !== UserRole.SUPER_ADMIN && userRole !== UserRole.CASHIER) {
      const assignedComp = await this.companyRepository.findOne({
        where: { id: filters.scopedCompanyId },
      });
      if (assignedComp?.is_employer) {
        qb.andWhere('client.employer_company_id = :scopedComp', {
          scopedComp: filters.scopedCompanyId,
        });
      }
    }

    if (filters?.search) {
      const term = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(client.national_id ILIKE :term OR client.employee_code ILIKE :term OR client.whatsapp_phone ILIKE :term OR client.first_name ILIKE :term OR client.last_name ILIKE :term)',
        { term },
      );
    }

    if (filters?.employerCompanyId) {
      qb.andWhere('client.employer_company_id = :comp', { comp: filters.employerCompanyId });
    }

    if (filters?.jobTitle) {
      qb.andWhere('client.job_title = :title', { title: filters.jobTitle });
    }

    if (filters?.gradeLevel) {
      qb.andWhere('client.grade_level = :grade', { grade: filters.gradeLevel });
    }

    if (filters?.classification) {
      qb.andWhere('client.classification = :cls', { cls: filters.classification });
    }

    if (filters?.creditStatus) {
      qb.andWhere('client.credit_status = :status', { status: filters.creditStatus });
    }

    const clients = await qb.getMany();
    return clients.map((c) => this.formatResponse(c, userRole));
  }

  async findOne(id: string, userRole: UserRole): Promise<ClientProfileResponse> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: { employer_company: true },
    });
    if (!client) {
      throw new NotFoundException(`Cliente con id ${id} no encontrado`);
    }
    return this.formatResponse(client, userRole);
  }

  /**
   * Fast barcode/cedula/carnet scanner lookup for the POS Cashier Terminal
   */
  async findByScanQuery(query: string, userRole: UserRole): Promise<ClientProfileResponse> {
    const cleanQuery = query.trim();
    if (!cleanQuery) {
      throw new NotFoundException('Debe ingresar un criterio de búsqueda (Cédula o Carnet)');
    }

    const client = await this.clientRepository
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .where('client.national_id = :q OR client.employee_code = :q OR client.whatsapp_phone = :q', {
        q: cleanQuery,
      })
      .orWhere("LOWER(CONCAT(client.first_name, ' ', client.last_name)) ILIKE LOWER(:likeQ)", {
        likeQ: `%${cleanQuery}%`,
      })
      .getOne();

    if (!client) {
      throw new NotFoundException(`No se encontró ningún cliente con identificación "${cleanQuery}"`);
    }

    return this.formatResponse(client, userRole);
  }

  async create(dto: CreateClientDto, userId: string): Promise<ClientProfileResponse> {
    await this.validateEmployerCompany(dto.employer_company_id);

    const existing = await this.clientRepository.findOne({
      where: [{ national_id: dto.national_id.trim() }, { employee_code: dto.employee_code.trim() }],
    });
    if (existing) {
      throw new ConflictException('Ya existe un cliente con esta cédula o código de carnet');
    }

    const encryptedSalary = dto.salary
      ? this.cryptoService.encrypt(dto.salary.toFixed(2))
      : null;

    const approved = dto.approved_limit.toFixed(2);
    const client = this.clientRepository.create({
      employer_company_id: dto.employer_company_id,
      employee_code: dto.employee_code.trim(),
      national_id: dto.national_id.trim(),
      first_name: dto.first_name.trim(),
      last_name: dto.last_name.trim(),
      job_title: dto.job_title.trim(),
      grade_level: dto.grade_level || 'NIVEL-1',
      classification: dto.classification || 'PLANTA',
      salary_encrypted: encryptedSalary,
      whatsapp_phone: dto.whatsapp_phone.trim(),
      birth_date: dto.birth_date || null,
      approved_limit: approved,
      used_balance: '0.00',
      available_balance: approved,
      credit_status: dto.credit_status || CreditStatus.ACTIVE,
      created_by: userId,
    });

    const saved = await this.clientRepository.save(client);
    const full = await this.clientRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { employer_company: true },
    });

    return this.formatResponse(full, UserRole.CREDIT_MANAGER);
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    userId: string,
  ): Promise<ClientProfileResponse> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: { employer_company: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const previousData = {
      first_name: client.first_name,
      last_name: client.last_name,
      national_id: client.national_id,
      employee_code: client.employee_code,
      job_title: client.job_title,
      grade_level: client.grade_level,
      classification: client.classification,
      approved_limit: client.approved_limit,
      available_balance: client.available_balance,
      credit_status: client.credit_status,
    };

    if (dto.national_id && dto.national_id.trim() !== client.national_id) {
      const existing = await this.clientRepository.findOne({
        where: { national_id: dto.national_id.trim() },
      });
      if (existing) {
        throw new ConflictException('La cédula ingresada ya está registrada para otro cliente');
      }
      client.national_id = dto.national_id.trim();
    }

    if (dto.employee_code && dto.employee_code.trim() !== client.employee_code) {
      const existing = await this.clientRepository.findOne({
        where: { employee_code: dto.employee_code.trim() },
      });
      if (existing) {
        throw new ConflictException('El código de carnet ingresado ya está registrado para otro cliente');
      }
      client.employee_code = dto.employee_code.trim();
    }

    if (dto.employer_company_id && dto.employer_company_id !== client.employer_company_id) {
      await this.validateEmployerCompany(dto.employer_company_id);
      client.employer_company_id = dto.employer_company_id;
    }
    if (dto.first_name !== undefined) client.first_name = dto.first_name.trim();
    if (dto.last_name !== undefined) client.last_name = dto.last_name.trim();
    if (dto.job_title !== undefined) client.job_title = dto.job_title.trim();
    if (dto.grade_level !== undefined) client.grade_level = dto.grade_level.trim();
    if (dto.classification !== undefined) client.classification = dto.classification.trim();
    if (dto.whatsapp_phone !== undefined) client.whatsapp_phone = dto.whatsapp_phone.trim();
    if (dto.birth_date !== undefined) client.birth_date = dto.birth_date || null;
    if (dto.credit_status !== undefined) client.credit_status = dto.credit_status;

    if (dto.salary !== undefined) {
      client.salary_encrypted = dto.salary
        ? this.cryptoService.encrypt(dto.salary.toFixed(2))
        : null;
    }

    if (dto.approved_limit !== undefined) {
      const newLimit = Number(dto.approved_limit);
      const used = Number(client.used_balance);
      if (newLimit < used) {
        throw new BadRequestException(
          `El límite aprobado (C$ ${newLimit.toFixed(2)}) no puede ser menor al saldo ya consumido (C$ ${used.toFixed(2)})`,
        );
      }
      const newAvailable = Number((newLimit - used).toFixed(2));
      client.approved_limit = newLimit.toFixed(2);
      client.available_balance = newAvailable.toFixed(2);
    }

    await this.clientRepository.save(client);

    const audit = this.auditRepository.create({
      action: 'CLIENT_PROFILE_UPDATED',
      entity_type: 'ClientCreditProfile',
      entity_id: client.id,
      previous_data: JSON.stringify(previousData),
      new_data: JSON.stringify(dto),
      performed_by_user_id: userId,
      created_at: new Date(),
    });
    await this.auditRepository.save(audit);

    const full = await this.clientRepository.findOneOrFail({
      where: { id: client.id },
      relations: { employer_company: true },
    });
    return this.formatResponse(full, UserRole.CREDIT_MANAGER);
  }

  async updateStatus(
    id: string,
    dto: UpdateClientStatusDto,
    userId: string,
  ): Promise<ClientProfileResponse> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: { employer_company: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const prevStatus = client.credit_status;
    client.credit_status = dto.credit_status;
    await this.clientRepository.save(client);

    const audit = this.auditRepository.create({
      action: 'CLIENT_STATUS_UPDATED',
      entity_type: 'ClientCreditProfile',
      entity_id: client.id,
      previous_data: JSON.stringify({ status: prevStatus }),
      new_data: JSON.stringify({ status: dto.credit_status, reason: dto.reason }),
      performed_by_user_id: userId,
      created_at: new Date(),
    });
    await this.auditRepository.save(audit);

    const response = this.formatResponse(client, UserRole.CREDIT_MANAGER);
    if (
      prevStatus === CreditStatus.PENDING_APPROVAL &&
      dto.credit_status === CreditStatus.ACTIVE &&
      this.whatsappNotifications
    ) {
      response.whatsapp_notification = await this.whatsappNotifications.notifyCreditLineActivated(
        client,
        userId,
      );
    }

    return response;
  }

  async remove(
    id: string,
    userId: string,
    actor?: { role?: UserRole; companyId?: string | null },
    reason?: string,
  ): Promise<{ deleted: true; id: string; full_name: string; message: string }> {
    const client = await this.clientRepository.findOne({
      where: { id },
      relations: { employer_company: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    await this.assertEmployerScope(actor?.role, actor?.companyId, client.employer_company_id);

    const usedBalance = Number(client.used_balance) || 0;
    if (usedBalance > 0) {
      throw new ConflictException(
        `No se puede eliminar a ${client.first_name} ${client.last_name} porque tiene un saldo consumido activo de C$ ${usedBalance.toFixed(2)}.`,
      );
    }

    if (this.transactionRepository) {
      const txCount = await this.transactionRepository.count({
        where: { client_id: client.id },
      });
      if (txCount > 0) {
        throw new ConflictException(
          `No se puede eliminar a ${client.first_name} ${client.last_name} porque tiene ${txCount} transacción(es) registradas en el historial financiero. Bloquee su línea de crédito en su lugar para preservar la auditoría.`,
        );
      }
    }

    const fullName = `${client.first_name} ${client.last_name}`.trim();
    const previousData = {
      id: client.id,
      employer_company_id: client.employer_company_id,
      employer_name: client.employer_company?.name || null,
      employee_code: client.employee_code,
      national_id: client.national_id,
      full_name: fullName,
      whatsapp_phone: client.whatsapp_phone,
      approved_limit: client.approved_limit,
      used_balance: client.used_balance,
      credit_status: client.credit_status,
    };

    await this.clientRepository.delete({ id: client.id });

    const trimmedReason = reason?.trim();
    const audit = this.auditRepository.create({
      action: 'CLIENT_PROFILE_DELETED',
      entity_type: 'ClientCreditProfile',
      entity_id: client.id,
      previous_data: JSON.stringify(previousData),
      new_data: trimmedReason ? JSON.stringify({ reason: trimmedReason }) : null,
      performed_by_user_id: userId,
      created_at: new Date(),
    });
    await this.auditRepository.save(audit);

    return {
      deleted: true,
      id: client.id,
      full_name: fullName,
      message: `Cliente ${fullName} eliminado correctamente.`,
    };
  }

  private formatResponse(c: ClientCreditProfile, role: UserRole): ClientProfileResponse {
    const canSeeSalary = role === UserRole.CREDIT_MANAGER || role === UserRole.SUPER_ADMIN;
    let salaryText = 'CONFIDENCIAL';
    if (canSeeSalary && c.salary_encrypted) {
      const dec = this.cryptoService.decrypt(c.salary_encrypted);
      salaryText = dec ? `C$ ${Number(dec).toLocaleString('es-NI', { minimumFractionDigits: 2 })}` : 'N/A';
    }

    const approved = Number(c.approved_limit) || 0;
    const used = Number(c.used_balance) || 0;
    const available = Number(c.available_balance) || 0;
    const consumptionPct = approved > 0 ? Number(((used / approved) * 100).toFixed(1)) : 0;

    let colorClass: 'emerald' | 'amber' | 'red' = 'emerald';
    if (c.credit_status !== CreditStatus.ACTIVE) {
      colorClass = 'red';
    } else if (consumptionPct > 75) {
      colorClass = 'amber';
    }

    return {
      id: c.id,
      employer_company_id: c.employer_company_id,
      employer_name: c.employer_company?.name || 'EMPRESA AFILIADA',
      employee_code: c.employee_code,
      national_id: c.national_id,
      first_name: c.first_name,
      last_name: c.last_name,
      full_name: `${c.first_name} ${c.last_name}`,
      job_title: c.job_title,
      grade_level: c.grade_level,
      classification: c.classification,
      salary: salaryText,
      whatsapp_phone: c.whatsapp_phone,
      birth_date: c.birth_date,
      approved_limit: approved.toFixed(2),
      used_balance: used.toFixed(2),
      available_balance: available.toFixed(2),
      consumption_percentage: consumptionPct,
      credit_status: c.credit_status,
      status_color_class: colorClass,
      created_at: c.created_at,
    };
  }

  private async seedDemoClients(): Promise<void> {
    const count = await this.clientRepository.count();
    if (count > 0) return;

    const employer = await this.companyRepository.findOne({
      where: { is_employer: true },
    });
    if (!employer) return;

    const demoClients = [
      {
        employee_code: 'EMP-001',
        national_id: '001-121092-0000X',
        first_name: 'Juan Alberto',
        last_name: 'Pérez Rostrán',
        job_title: 'Ingeniero de Sistemas Sr.',
        grade_level: 'G-5',
        classification: 'VIP',
        salary: 45000,
        whatsapp_phone: '50588881234',
        birth_date: '1992-10-12',
        approved_limit: '15000.00',
        used_balance: '3500.00',
        available_balance: '11500.00',
        credit_status: CreditStatus.ACTIVE,
      },
      {
        employee_code: 'EMP-002',
        national_id: '001-050488-0002Y',
        first_name: 'María Elena',
        last_name: 'González Rivas',
        job_title: 'Analista Contable Principal',
        grade_level: 'G-3',
        classification: 'PLANTA',
        salary: 22000,
        whatsapp_phone: '50588882345',
        birth_date: '1988-04-05',
        approved_limit: '8000.00',
        used_balance: '6800.00', // 85% -> Amber
        available_balance: '1200.00',
        credit_status: CreditStatus.ACTIVE,
      },
      {
        employee_code: 'EMP-003',
        national_id: '001-200875-0001Z',
        first_name: 'Carlos Roberto',
        last_name: 'Mendoza Castro',
        job_title: 'Director de Operaciones',
        grade_level: 'G-7',
        classification: 'EJECUTIVO',
        salary: 80000,
        whatsapp_phone: '50588883456',
        birth_date: '1975-08-20',
        approved_limit: '25000.00',
        used_balance: '0.00',
        available_balance: '25000.00',
        credit_status: CreditStatus.ACTIVE,
      },
      {
        employee_code: 'EMP-004',
        national_id: '001-150995-0003W',
        first_name: 'Sandra Lorena',
        last_name: 'López Valle',
        job_title: 'Asistente Administrativo',
        grade_level: 'G-1',
        classification: 'TEMPORAL',
        salary: 14000,
        whatsapp_phone: '50588884567',
        birth_date: '1995-09-15',
        approved_limit: '5000.00',
        used_balance: '5000.00',
        available_balance: '0.00',
        credit_status: CreditStatus.BLOCKED, // Blocked -> Red
      },
    ];

    for (const d of demoClients) {
      const encryptedSalary = this.cryptoService.encrypt(d.salary.toFixed(2));
      const client = this.clientRepository.create({
        employer_company_id: employer.id,
        employee_code: d.employee_code,
        national_id: d.national_id,
        first_name: d.first_name,
        last_name: d.last_name,
        job_title: d.job_title,
        grade_level: d.grade_level,
        classification: d.classification,
        salary_encrypted: encryptedSalary,
        whatsapp_phone: d.whatsapp_phone,
        birth_date: d.birth_date,
        approved_limit: d.approved_limit,
        used_balance: d.used_balance,
        available_balance: d.available_balance,
        credit_status: d.credit_status,
        created_by: 'SEED',
      });
      await this.clientRepository.save(client);
    }
  }
}
