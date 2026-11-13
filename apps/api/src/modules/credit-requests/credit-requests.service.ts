import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CreditIncreaseRequest } from '../../database/entities/credit-increase-request.entity';
import { ClientCreditProfile } from '../../database/entities/client-credit-profile.entity';
import { IncreaseRequestStatus } from '../../common/enums';
import { CreditLedgerService } from '../credit/credit-ledger.service';

@Injectable()
export class CreditRequestsService {
  constructor(
    @InjectRepository(CreditIncreaseRequest)
    private readonly requestRepository: Repository<CreditIncreaseRequest>,
    @InjectRepository(ClientCreditProfile)
    private readonly clientRepository: Repository<ClientCreditProfile>,
    private readonly ledgerService: CreditLedgerService,
  ) {}

  async findAll(status?: IncreaseRequestStatus): Promise<CreditIncreaseRequest[]> {
    const qb = this.requestRepository
      .createQueryBuilder('req')
      .leftJoinAndSelect('req.client', 'client')
      .leftJoinAndSelect('client.employer_company', 'employer')
      .leftJoinAndSelect('req.reviewer', 'reviewer')
      .orderBy('req.created_at', 'DESC');

    if (status) {
      qb.where('req.status = :status', { status });
    }

    return qb.getMany();
  }

  async reviewRequest(
    id: string,
    action: 'APPROVE' | 'REJECT',
    reviewerUserId: string,
    reviewNotes?: string,
  ): Promise<CreditIncreaseRequest> {
    const request = await this.requestRepository.findOne({
      where: { id },
      relations: { client: true },
    });

    if (!request) {
      throw new NotFoundException(`Solicitud ${id} no encontrada`);
    }

    if (request.status !== IncreaseRequestStatus.PENDING) {
      throw new BadRequestException('Esta solicitud ya fue revisada previamente');
    }

    request.reviewed_by = reviewerUserId;
    request.reviewed_at = new Date();
    request.review_notes = reviewNotes || null;

    if (action === 'APPROVE') {
      request.status = IncreaseRequestStatus.APPROVED;

      // Adjust limit in the financial ledger
      await this.ledgerService.adjustLimit(
        {
          client_id: request.client_id,
          new_limit: Number(request.requested_limit),
          reason: `Aprobación de Solicitud REQ-${request.id.substring(0, 8)}. Notas: ${reviewNotes || 'Sin notas'}`,
        },
        reviewerUserId,
      );
    } else {
      request.status = IncreaseRequestStatus.REJECTED;
    }

    return this.requestRepository.save(request);
  }
}
