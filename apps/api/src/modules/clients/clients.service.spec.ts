jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { CreditStatus, UserRole } from '../../common/enums';
import { ClientsService } from './clients.service';

describe('ClientsService', () => {
  function createHarness() {
    const clientRepository = {
      findOne: jest.fn(),
      delete: jest.fn(async () => ({ affected: 1 })),
    };

    const companyRepository = {
      findOne: jest.fn(),
    };

    const auditRepository = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn(async (data: Record<string, unknown>) => data),
    };

    const cryptoService = {
      encrypt: jest.fn((v: string) => `enc:${v}`),
      decrypt: jest.fn(() => '25000.00'),
    };

    const whatsappNotifications = {
      notifyCreditLineActivated: jest.fn(),
    };

    const transactionRepository = {
      count: jest.fn(async () => 0),
    };

    const service = new ClientsService(
      clientRepository as never,
      companyRepository as never,
      auditRepository as never,
      cryptoService as never,
      whatsappNotifications as never,
      transactionRepository as never,
    );

    return {
      service,
      clientRepository,
      companyRepository,
      auditRepository,
      transactionRepository,
    };
  }

  it('throws NotFoundException when removing a nonexistent client', async () => {
    const { service, clientRepository } = createHarness();
    clientRepository.findOne.mockResolvedValue(null);

    await expect(
      service.remove('missing-id', 'admin-1', {
        role: UserRole.SUPER_ADMIN,
        companyId: null,
      }),
    ).rejects.toThrow(NotFoundException);
  });

  it('forbids a scoped employer CREDIT_MANAGER from deleting a client from another employer company', async () => {
    const { service, clientRepository, companyRepository } = createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-b',
      first_name: 'Ana',
      last_name: 'Torres',
      employer_company_id: 'emp-B',
      used_balance: '0.00',
    });
    companyRepository.findOne.mockResolvedValue({
      id: 'emp-A',
      is_employer: true,
    });

    await expect(
      service.remove('client-b', 'mgr-a', {
        role: UserRole.CREDIT_MANAGER,
        companyId: 'emp-A',
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(clientRepository.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a client with active consumed balance', async () => {
    const { service, clientRepository } = createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-1',
      first_name: 'Carlos',
      last_name: 'Díaz',
      employer_company_id: 'emp-1',
      used_balance: '350.00',
    });

    await expect(
      service.remove('client-1', 'admin-1', {
        role: UserRole.SUPER_ADMIN,
        companyId: null,
      }),
    ).rejects.toThrow(ConflictException);
    expect(clientRepository.delete).not.toHaveBeenCalled();
  });

  it('rejects deleting a client with financial transaction history', async () => {
    const { service, clientRepository, transactionRepository } =
      createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-1',
      first_name: 'Carlos',
      last_name: 'Díaz',
      employer_company_id: 'emp-1',
      used_balance: '0.00',
    });
    transactionRepository.count.mockResolvedValue(4);

    await expect(
      service.remove('client-1', 'admin-1', {
        role: UserRole.SUPER_ADMIN,
        companyId: null,
      }),
    ).rejects.toThrow(ConflictException);
    expect(clientRepository.delete).not.toHaveBeenCalled();
  });

  it('deletes eligible client cleanly and records CLIENT_PROFILE_DELETED audit log', async () => {
    const {
      service,
      clientRepository,
      transactionRepository,
      auditRepository,
    } = createHarness();
    clientRepository.findOne.mockResolvedValue({
      id: 'client-ok',
      first_name: 'Sofía',
      last_name: 'Mendoza',
      employee_code: 'EMP-99',
      national_id: '001-010195-0001K',
      whatsapp_phone: '88887777',
      employer_company_id: 'emp-1',
      employer_company: { id: 'emp-1', name: 'Grupo Industrial' },
      approved_limit: '5000.00',
      used_balance: '0.00',
      credit_status: CreditStatus.PENDING_APPROVAL,
    });
    transactionRepository.count.mockResolvedValue(0);

    const res = await service.remove(
      'client-ok',
      'admin-1',
      { role: UserRole.SUPER_ADMIN, companyId: null },
      'Registro duplicado en alta inicial',
    );

    expect(clientRepository.delete).toHaveBeenCalledWith({ id: 'client-ok' });
    expect(auditRepository.save).toHaveBeenCalledTimes(1);
    expect(auditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'CLIENT_PROFILE_DELETED',
        entity_type: 'ClientCreditProfile',
        entity_id: 'client-ok',
        performed_by_user_id: 'admin-1',
      }),
    );
    expect(res).toMatchObject({
      deleted: true,
      id: 'client-ok',
      full_name: 'Sofía Mendoza',
    });
  });
});

