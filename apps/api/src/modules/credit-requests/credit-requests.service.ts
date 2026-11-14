import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { Company } from '../../database/entities/company.entity';
import { AuditLog } from '../../database/entities/audit-log.entity';
import {
  ChannelType,
  CreditStatus,
  IncreaseRequestStatus,
  UserRole,
} from '../../common/enums';
import { CreditLedgerService } from '../credit/credit-ledger.service';
import {
  ConsumptionNotificationResult,
  WhatsAppNotificationsService,
} from '../notifications/whatsapp-notifications.service';
import { CreateCreditRequestDto } from './dto/credit-request.dto';

export interface CreditRequestReviewResponse extends CreditIncreaseRequest {
  whatsapp_notification?: ConsumptionNotificationResult;
}

@Injectable()
export class CreditRequestsService {
  constructor(
    @InjectRepository(CreditIncreaseRequest)
    private readonly requestRepository: Repository<CreditIncreaseRequest>,
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    @InjectRepository(Company)
    private readonly companyRepository: Repository<Company>,
    @InjectRepository(AuditLog)
    private readonly auditRepository: Repository<AuditLog>,
    private readonly dataSource: DataSource,
    private readonly ledgerService: CreditLedgerService,
    @Optional() private readonly whatsappNotifications?: WhatsAppNotificationsService,
  ) {}

  private async resolveScopedEmployerId(
    actorRole?: UserRole,
    actorCompanyId?: string | null,
  ): Promise<string | null> {
    if (!actorCompanyId || actorRole === UserRole.SUPER_ADMIN) {
      return null;
    }
    const comp = await this.companyRepository.findOne({ where: { id: actorCompanyId } });
    return comp?.is_employer ? comp.id : null;
  }

  async findAll(filters?: {
    status?: IncreaseRequestStatus;
    employerCompanyId?: string;
    search?: string;
    actorRole?: UserRole;
    actorCompanyId?: string | null;
  }): Promise<CreditIncreaseRequest[]> {
    const qb = this.requestRepository
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.client', 'client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .leftJoinAndSelect('req.reviewer', 'reviewer')
      .orderBy('req.created_at', 'DESC');

    const scopedEmployerId = await this.resolveScopedEmployerId(
      filters?.actorRole,
      filters?.actorCompanyId,
    );
    const effectiveCompanyId = scopedEmployerId || filters?.employerCompanyId;

    if (effectiveCompanyId) {
      qb.andWhere('client.employer_company_id = :employerCompanyId', {
        employerCompanyId: effectiveCompanyId,
      });
    }

    if (filters?.status) {
      qb.andWhere('req.status = :status', { status: filters.status });
    }

    if (filters?.search?.trim()) {
      const term = `%${filters.search.trim()}%`;
      qb.andWhere(
        '(client.first_name ILIKE :term OR client.last_name ILIKE :term OR client.national_id ILIKE :term OR client.employee_code ILIKE :term OR req.reason ILIKE :term)',
        { term },
      );
    }

    return qb.getMany();
  }

  async createRequest(
    dto: CreateCreditRequestDto,
    createdByUserId: string,
    actorRole?: UserRole,
    actorCompanyId?: string | null,
  ): Promise<CreditIncreaseRequest> {
    const client = await this.clientRepository.findOne({
      where: { id: dto.client_id },
      relations: { employer_company: true },
    });
    if (!client) {
      throw new NotFoundException('Cliente no encontrado');
    }

    const scopedEmployerId = await this.resolveScopedEmployerId(actorRole, actorCompanyId);
    if (scopedEmployerId && client.employer_company_id !== scopedEmployerId) {
      throw new ForbiddenException(
        'No puede registrar solicitudes de crédito para colaboradores de otra empresa',
      );
    }

    if (client.credit_status === CreditStatus.BLOCKED) {
      throw new BadRequestException(
        'La línea de crédito del cliente está bloqueada; reactívela antes de solicitar aumento',
      );
    }

    const currentLimit = Number(client.approved_limit);
    const requestedLimit = Number(dto.requested_limit);
    if (!Number.isFinite(requestedLimit) || requestedLimit <= currentLimit) {
      throw new BadRequestException(
        `El monto solicitado (C$ ${requestedLimit.toFixed(2)}) debe ser mayor al límite actual (C$ ${currentLimit.toFixed(2)})`,
      );
    }

    const existingPending = await this.requestRepository.findOne({
      where: { client_id: client.id, status: IncreaseRequestStatus.PENDING },
    });
    if (existingPending) {
      const code = `REQ-${existingPending.id.substring(0, 8).toUpperCase()}`;
      throw new ConflictException(
        `El cliente ya tiene una solicitud pendiente (${code}) esperando evaluación`,
      );
    }

    const saved = await this.requestRepository.save(
      this.requestRepository.create({
        client_id: client.id,
        current_limit: client.approved_limit,
        requested_limit: requestedLimit.toFixed(2),
        reason: dto.reason.trim(),
        channel: ChannelType.WEB_PORTAL,
        status: IncreaseRequestStatus.PENDING,
      }),
    );

    await this.auditRepository.save(
      this.auditRepository.create({
        action: 'CREDIT_INCREASE_REQUEST_CREATED',
        entity_type: 'CreditIncreaseRequest',
        entity_id: saved.id,
        new_data: JSON.stringify({
          client_id: client.id,
          current_limit: client.approved_limit,
          requested_limit: requestedLimit.toFixed(2),
          channel: ChannelType.WEB_PORTAL,
        }),
        performed_by_user_id: createdByUserId,
        created_at: new Date(),
      }),
    );

    return this.requestRepository.findOneOrFail({
      where: { id: saved.id },
      relations: { client: { employer_company: true }, reviewer: true },
    });
  }

  async reviewRequest(
    id: string,
    action: 'APPROVE' | 'REJECT',
    reviewerUserId: string,
    reviewNotes?: string,
    approvedLimitOverride?: number,
    actorRole?: UserRole,
    actorCompanyId?: string | null,
    ipAddress?: string,
  ): Promise<CreditRequestReviewResponse> {
    const scopedEmployerId = await this.resolveScopedEmployerId(actorRole, actorCompanyId);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction('READ COMMITTED');

    let savedRequest: CreditIncreaseRequest;
    let updatedClient: ClientCreditProfile;
    let targetLimit = 0;

    try {
      const request = await queryRunner.manager.findOne(CreditIncreaseRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });

      if (!request) {
        throw new NotFoundException(`Solicitud ${id} no encontrada`);
      }

      if (request.status !== IncreaseRequestStatus.PENDING) {
        throw new BadRequestException('Esta solicitud ya fue revisada previamente');
      }

      const client = await queryRunner.manager.findOne(ClientCreditProfile, {
        where: { id: request.client_id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!client) {
        throw new NotFoundException('Cliente asociado a la solicitud no existe');
      }

      if (scopedEmployerId && client.employer_company_id !== scopedEmployerId) {
        throw new ForbiddenException(
          'No tiene permiso para resolver solicitudes de otra empresa empleadora',
        );
      }

      request.reviewed_by = reviewerUserId;
      request.reviewed_at = new Date();
      request.review_notes = reviewNotes?.trim() || null;

      if (action === 'APPROVE') {
        targetLimit =
          approvedLimitOverride !== undefined
            ? Number(approvedLimitOverride)
            : Number(request.requested_limit);

        request.status = IncreaseRequestStatus.APPROVED;
        if (approvedLimitOverride !== undefined) {
          request.requested_limit = targetLimit.toFixed(2);
        }

        updatedClient = await this.ledgerService.applyLimitAdjustmentWithManager(
          queryRunner.manager,
          client,
          targetLimit,
          `Aprobación de Solicitud REQ-${request.id.substring(0, 8).toUpperCase()}. Notas: ${request.review_notes || 'Sin notas'}`,
          reviewerUserId,
          ipAddress,
        );
      } else {
        targetLimit = Number(client.approved_limit);
        request.status = IncreaseRequestStatus.REJECTED;
        updatedClient = client;

        await queryRunner.manager.save(
          AuditLog,
          queryRunner.manager.create(AuditLog, {
            action: 'CREDIT_INCREASE_REQUEST_REJECTED',
            entity_type: 'CreditIncreaseRequest',
            entity_id: request.id,
            previous_data: JSON.stringify({ status: IncreaseRequestStatus.PENDING }),
            new_data: JSON.stringify({
              status: IncreaseRequestStatus.REJECTED,
              review_notes: request.review_notes,
            }),
            performed_by_user_id: reviewerUserId,
            ip_address: ipAddress || null,
            created_at: new Date(),
          }),
        );
      }

      savedRequest = await queryRunner.manager.save(CreditIncreaseRequest, request);
      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    const hydrated = await this.requestRepository.findOneOrFail({
      where: { id: savedRequest.id },
      relations: { client: { employer_company: true }, reviewer: true },
    });

    const response: CreditRequestReviewResponse = hydrated;
    if (this.whatsappNotifications) {
      response.whatsapp_notification =
        await this.whatsappNotifications.notifyCreditRequestDecision(
          hydrated,
          hydrated.client || updatedClient,
          targetLimit,
          reviewerUserId,
        );
    }

    return response;
  }
}
