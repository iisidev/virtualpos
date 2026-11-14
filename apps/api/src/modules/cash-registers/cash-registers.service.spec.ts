jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CashRegisterStatus,
  CompanyStatus,
  UserRole,
} from '../../common/enums';
import { CashRegistersService } from './cash-registers.service';

describe('CashRegistersService', () => {
  function createHarness() {
    const cashRegisterRepository = {
      findOne: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data: Record<string, unknown>) => ({
        id: 'reg-1',
        ...data,
      })),
      save: jest.fn(async (data: Record<string, unknown>) => data),
      createQueryBuilder: jest.fn(),
    };

    const companyRepository = {
      findOne: jest.fn(),
    };

    const auditRepository = {
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn(async (data: Record<string, unknown>) => data),
    };

    const service = new CashRegistersService(
      cashRegisterRepository as never,
      companyRepository as never,
      auditRepository as never,
    );

    return {
      service,
      cashRegisterRepository,
      companyRepository,
      auditRepository,
    };
  }

  it('rejects creating a cash register for a non-merchant company', async () => {
    const { service, companyRepository } = createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'comp-1',
      name: 'Solo Empleadora',
      is_merchant: false,
      status: CompanyStatus.ACTIVE,
    });

    await expect(
      service.create(
        {
          company_id: 'comp-1',
          terminal_code: 'pos-01',
          name: 'Caja 1',
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects opening a cash register on creation when merchant company is INACTIVE', async () => {
    const { service, companyRepository } = createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'comp-1',
      name: 'Comercio Inactivo',
      is_merchant: true,
      status: CompanyStatus.INACTIVE,
    });

    await expect(
      service.create(
        {
          company_id: 'comp-1',
          terminal_code: 'pos-01',
          name: 'Caja 1',
          status: CashRegisterStatus.OPEN,
        },
        'admin-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects duplicate terminal_code on create', async () => {
    const { service, companyRepository, cashRegisterRepository } = createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'comp-1',
      name: 'Comisariato Central',
      is_merchant: true,
      status: CompanyStatus.ACTIVE,
    });
    cashRegisterRepository.findOne.mockResolvedValue({
      id: 'reg-existing',
      terminal_code: 'POS-01',
    });

    await expect(
      service.create(
        {
          company_id: 'comp-1',
          terminal_code: ' pos-01 ',
          name: 'Caja 1',
        },
        'admin-1',
      ),
    ).rejects.toThrow(ConflictException);
  });

  it('normalizes terminal_code to uppercase and records audit log on create', async () => {
    const { service, companyRepository, cashRegisterRepository, auditRepository } =
      createHarness();
    companyRepository.findOne.mockResolvedValue({
      id: 'comp-1',
      name: 'Comisariato Central',
      is_merchant: true,
      status: CompanyStatus.ACTIVE,
    });
    cashRegisterRepository.findOne
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: 'reg-1',
        company_id: 'comp-1',
        terminal_code: 'POS-SUCRE-02',
        name: 'Caja Principal',
        location: 'Sucursal Norte',
        status: CashRegisterStatus.OPEN,
      });

    const created = await service.create(
      {
        company_id: 'comp-1',
        terminal_code: ' pos-sucre-02 ',
        name: 'Caja Principal',
        location: 'Sucursal Norte',
      },
      'admin-1',
    );

    expect(created.terminal_code).toBe('POS-SUCRE-02');
    expect(created.company_id).toBe('comp-1');
    expect(auditRepository.save).toHaveBeenCalledTimes(1);
  });

  it('forbids a scoped CASHIER from changing status of another company cash register', async () => {
    const { service, cashRegisterRepository } = createHarness();
    cashRegisterRepository.findOne.mockResolvedValue({
      id: 'reg-2',
      company_id: 'comp-B',
      terminal_code: 'POS-B1',
      status: CashRegisterStatus.OPEN,
      company: {
        id: 'comp-B',
        name: 'Comercio B',
        is_merchant: true,
        status: CompanyStatus.ACTIVE,
      },
    });

    await expect(
      service.updateStatus('reg-2', CashRegisterStatus.CLOSED, {
        userId: 'cashier-a',
        role: UserRole.CASHIER,
        companyId: 'comp-A',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('forbids a CASHIER from setting register status to SUSPENDED', async () => {
    const { service, cashRegisterRepository } = createHarness();
    cashRegisterRepository.findOne.mockResolvedValue({
      id: 'reg-1',
      company_id: 'comp-A',
      terminal_code: 'POS-A1',
      status: CashRegisterStatus.OPEN,
      company: {
        id: 'comp-A',
        name: 'Comercio A',
        is_merchant: true,
        status: CompanyStatus.ACTIVE,
      },
    });

    await expect(
      service.updateStatus('reg-1', CashRegisterStatus.SUSPENDED, {
        userId: 'cashier-a',
        role: UserRole.CASHIER,
        companyId: 'comp-A',
      }),
    ).rejects.toThrow(ForbiddenException);
  });

  it('rejects opening a cash register whose merchant company is INACTIVE or not a merchant', async () => {
    const { service, cashRegisterRepository, companyRepository } = createHarness();
    cashRegisterRepository.findOne.mockResolvedValue({
      id: 'reg-1',
      company_id: 'comp-A',
      terminal_code: 'POS-A1',
      status: CashRegisterStatus.CLOSED,
      company: {
        id: 'comp-A',
        name: 'Comercio A',
        is_merchant: true,
        status: CompanyStatus.INACTIVE,
      },
    });
    companyRepository.findOne.mockResolvedValue({
      id: 'comp-A',
      name: 'Comercio A',
      is_merchant: true,
      status: CompanyStatus.INACTIVE,
    });

    await expect(
      service.updateStatus('reg-1', CashRegisterStatus.OPEN, {
        userId: 'admin-1',
        role: UserRole.SUPER_ADMIN,
        companyId: null,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});

