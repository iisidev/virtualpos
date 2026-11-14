jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreditStatus,
  IncreaseRequestStatus,
  UserRole,
} from '../../common/enums';
import {
  ClientCreditProfile,
  CreditIncreaseRequest,
} from '../../database/entities';
import { CreditRequestsService } from './credit-requests.service';

describe('CreditRequestsService', () => {
  function createHarness() {
    const requestRepository = {
      findOne: jest.fn(),
      findOneOrFail: jest.fn(),
      create: jest.fn((data: Record<string, unknown>) => ({
        id: 'req-new-1234',
        ...data,
      })),
      save: jest.fn(async (data: Record<string, unknown>) => data),
      createQueryBuilder: jest.fn(),
    };

    const clientRepository = {
      findOne: jest.fn(),
    };

    const companyRepository = {
      findOne: jest.fn(),
    };

    const auditRepository = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn(async (data: Record<string, unknown>) => data),
    };

    const txManager = {
      findOne: jest.fn(),
      save: jest.fn(async (_entity: unknown, data?: unknown) =>
        data === undefined ? _entity : data,
      ),
      create: jest.fn((_entity: unknown, data?: unknown) =>
        data === undefined ? _entity : data,
      ),
    };

    const queryRunner = {
      connect: jest.fn(async () => undefined),
      startTransaction: jest.fn(async () => undefined),
      commitTransaction: jest.fn(async () => undefined),
      rollbackTransaction: jest.fn(async () => undefined),
      release: jest.fn(async () => undefined),
      manager: txManager,
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
    };

    const ledgerService = {
      applyLimitAdjustmentWithManager: jest.fn(),
    };

    const whatsappNotifications = {
      notifyCreditRequestDecision: jest.fn(async () => ({
        attempted: true,
        ok: true,
        phone: '+50588881111',
      })),
    };

    const service = new CreditRequestsService(
      requestRepository as never,
      clientRepository as never,
      companyRepository as never,
      auditRepository as never,
      dataSource as never,
      ledgerService as never,
      whatsappNotifications as never,
    );

    return {
      service,
      requestRepository,
      clientRepository,
      companyRepository,
      auditRepository,
      queryRunner,
      txManager,
      ledgerService,
      whatsappNotifications,
    };
  }

  it('rejects createRequest when requested_limit is not higher than current approved_limit', async () => {
    const { service, clientRepository } = createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-1',
      employer_company_id: 'emp-1',
      approved_limit: '5000.00',
      credit_status: CreditStatus.ACTIVE,
    });

    await expect(
      service.createRequest(
        {
          client_id: 'client-1',
          requested_limit: 5000,
          reason: 'Mismo monto',
        },
        'manager-1',
        UserRole.SUPER_ADMIN,
        null,
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects createRequest when a scoped CREDIT_MANAGER targets a client from another employer company', async () => {
    const { service, clientRepository, companyRepository } = createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'emp-A',
      is_employer: true,
    });
    clientRepository.findOne.mockResolvedValue({
      id: 'client-1',
      employer_company_id: 'emp-B',
      approved_limit: '3000.00',
      credit_status: CreditStatus.ACTIVE,
    });

    await expect(
      service.createRequest(
        {
          client_id: 'client-1',
          requested_limit: 6000,
          reason: 'Aumento salarial',
        },
        'manager-a',
        UserRole.CREDIT_MANAGER,
        'emp-A',
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects createRequest when client already has a PENDING request', async () => {
    const { service, clientRepository, requestRepository } = createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-1',
      employer_company_id: 'emp-1',
      approved_limit: '3000.00',
      credit_status: CreditStatus.ACTIVE,
    });
    requestRepository.findOne.mockResolvedValue({
      id: 'req-existing',
      status: IncreaseRequestStatus.PENDING,
    });

    await expect(
      service.createRequest(
        {
          client_id: 'client-1',
          requested_limit: 6000,
          reason: 'Duplicada',
        },
        'manager-1',
        UserRole.SUPER_ADMIN,
        null,
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('creates a PENDING request and returns hydrated record when valid', async () => {
    const { service, clientRepository, requestRepository, auditRepository } =
      createHarness();
    const client = {
      id: 'client-1',
      first_name: 'Carlos',
      last_name: 'Pérez',
      employer_company_id: 'emp-1',
      approved_limit: '3000.00',
      credit_status: CreditStatus.ACTIVE,
    };
    clientRepository.findOne.mockResolvedValue(client);
    requestRepository.findOne.mockResolvedValue(null);
    requestRepository.findOneOrFail.mockResolvedValue({
      id: 'req-new-1234',
      client_id: 'client-1',
      current_limit: '3000.00',
      requested_limit: '6000.00',
      status: IncreaseRequestStatus.PENDING,
      client,
    });

    const created = await service.createRequest(
      {
        client_id: 'client-1',
        requested_limit: 6000,
        reason: 'Promoción anual',
      },
      'manager-1',
      UserRole.SUPER_ADMIN,
      null,
    );

    expect(created.status).toBe(IncreaseRequestStatus.PENDING);
    expect(auditRepository.save).toHaveBeenCalledTimes(1);
  });

  it('approves request atomically with approvedLimitOverride and triggers WhatsApp notification', async () => {
    const {
      service,
      requestRepository,
      txManager,
      queryRunner,
      ledgerService,
      whatsappNotifications,
    } = createHarness();

    const clientRecord = {
      id: 'client-1',
      first_name: 'Ana',
      last_name: 'López',
      employer_company_id: 'emp-1',
      whatsapp_phone: '88881111',
      approved_limit: '3000.00',
      used_balance: '1000.00',
      available_balance: '2000.00',
      credit_status: CreditStatus.ACTIVE,
    };

    const pendingReq = {
      id: 'req-12345678',
      client_id: 'client-1',
      current_limit: '3000.00',
      requested_limit: '7000.00',
      reason: 'Antigüedad laboral',
      status: IncreaseRequestStatus.PENDING,
      client: clientRecord,
    };

    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditIncreaseRequest) return pendingReq;
      if (entity === ClientCreditProfile) return clientRecord;
      return null;
    });

    const updatedClient = {
      ...clientRecord,
      approved_limit: '5500.00',
      available_balance: '4500.00',
    };
    ledgerService.applyLimitAdjustmentWithManager.mockResolvedValue(updatedClient);

    requestRepository.findOneOrFail.mockResolvedValue({
      ...pendingReq,
      status: IncreaseRequestStatus.APPROVED,
      review_notes: 'Aprobado parcialmente por comité',
      client: updatedClient,
    });

    const result = await service.reviewRequest(
      'req-12345678',
      'APPROVE',
      'admin-1',
      'Aprobado parcialmente por comité',
      5500,
      UserRole.SUPER_ADMIN,
      null,
      '127.0.0.1',
    );

    expect(ledgerService.applyLimitAdjustmentWithManager).toHaveBeenCalledWith(
      txManager,
      expect.objectContaining({ id: 'client-1' }),
      5500,
      expect.stringContaining('REQ-REQ-1234'),
      'admin-1',
      '127.0.0.1',
    );
    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.rollbackTransaction).not.toHaveBeenCalled();
    expect(whatsappNotifications.notifyCreditRequestDecision).toHaveBeenCalledWith(
      expect.objectContaining({ status: IncreaseRequestStatus.APPROVED }),
      expect.objectContaining({ approved_limit: '5500.00' }),
      5500,
      'admin-1',
    );
    expect(result.status).toBe(IncreaseRequestStatus.APPROVED);
  });

  it('forbids scoped CREDIT_MANAGER from reviewing a request from another employer company', async () => {
    const { service, companyRepository, txManager, queryRunner } =
      createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'emp-A',
      is_employer: true,
    });
    const clientB = {
      id: 'client-b',
      employer_company_id: 'emp-B',
    };
    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditIncreaseRequest) {
        return {
          id: 'req-2',
          client_id: 'client-b',
          status: IncreaseRequestStatus.PENDING,
          client: clientB,
        };
      }
      if (entity === ClientCreditProfile) return clientB;
      return null;
    });

    await expect(
      service.reviewRequest(
        'req-2',
        'REJECT',
        'manager-a',
        'Fuera de empresa',
        undefined,
        UserRole.CREDIT_MANAGER,
        'emp-A',
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(queryRunner.commitTransaction).not.toHaveBeenCalled();
  });
});
