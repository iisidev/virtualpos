jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

import {
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CashRegisterStatus,
  CompanyStatus,
  CreditStatus,
  TransactionStatus,
  TransactionType,
  UserRole,
} from '../../common/enums';
import {
  AuditLog,
  CashRegister,
  ClientCreditProfile,
  Company,
  CreditTransaction,
  User,
} from '../../database/entities';
import { CreditLedgerService } from './credit-ledger.service';

describe('CreditLedgerService', () => {
  function createHarness() {
    const txManager = {
      findOne: jest.fn(),
      count: jest.fn(async () => 0),
      create: jest.fn((_entity: unknown, data?: Record<string, unknown>) => ({
        id: 'created-1',
        created_at: new Date('2026-11-14T12:00:00Z'),
        ...(data ?? {}),
      })),
      save: jest.fn(async (_entity: unknown, data?: Record<string, unknown>) =>
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

    const creditTxRepo = {
      findOne: jest.fn(async () => null),
      findOneOrFail: jest.fn(),
    };

    const dataSource = {
      createQueryRunner: jest.fn(() => queryRunner),
      getRepository: jest.fn(() => creditTxRepo),
    };

    const cryptoService = {
      generateTransactionSignature: jest.fn(() => 'sig-hash-123'),
    };

    const redisLockService = {
      registerIdempotency: jest.fn(async () => true),
      acquireLock: jest.fn(async () => true),
      releaseLock: jest.fn(async () => undefined),
    };

    const whatsappNotifications = {
      notifyPurchaseConsumption: jest.fn(async () => ({
        attempted: true,
        ok: true,
        phone: '+50588881111',
      })),
    };

    const service = new CreditLedgerService(
      dataSource as never,
      cryptoService as never,
      redisLockService as never,
      whatsappNotifications as never,
    );

    return {
      service,
      txManager,
      creditTxRepo,
      queryRunner,
      redisLockService,
      whatsappNotifications,
    };
  }

  const activeClientStub = {
    id: 'client-1',
    first_name: 'Carlos',
    last_name: 'Méndez',
    national_id: '001-010190-0001A',
    employee_code: 'EMP-09',
    credit_status: CreditStatus.ACTIVE,
    approved_limit: '5000.00',
    used_balance: '1000.00',
    available_balance: '4000.00',
    employer_company_id: 'emp-1',
    pin_hash: null,
  };

  it('rejects POS charge when cash register is CLOSED', async () => {
    const { service, txManager, queryRunner } = createHarness();

    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditTransaction) return null;
      if (entity === ClientCreditProfile) return activeClientStub;
      if (entity === CashRegister) {
        return {
          id: 'reg-1',
          company_id: 'merch-1',
          terminal_code: 'POS-01',
          name: 'Caja 1',
          status: CashRegisterStatus.CLOSED,
          company: {
            id: 'merch-1',
            name: 'Tienda 1',
            ruc: 'J0310000001',
            is_merchant: true,
            status: CompanyStatus.ACTIVE,
          },
        };
      }
      return null;
    });

    await expect(
      service.executeCharge(
        {
          client_id: 'client-1',
          cash_register_id: 'reg-1',
          merchant_company_id: 'merch-1',
          amount: 100,
          external_invoice_number: 'FAC-100',
          idempotency_key: 'idem-1',
        },
        'cashier-1',
        '127.0.0.1',
        { role: UserRole.CASHIER, companyId: 'merch-1' },
      ),
    ).rejects.toThrow(BadRequestException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('forbids a scoped CASHIER from charging through another company cash register', async () => {
    const { service, txManager, queryRunner } = createHarness();

    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditTransaction) return null;
      if (entity === ClientCreditProfile) return activeClientStub;
      if (entity === CashRegister) {
        return {
          id: 'reg-b',
          company_id: 'merch-B',
          terminal_code: 'POS-B1',
          name: 'Caja B',
          status: CashRegisterStatus.OPEN,
          company: {
            id: 'merch-B',
            name: 'Tienda B',
            ruc: 'J0310000002',
            is_merchant: true,
            status: CompanyStatus.ACTIVE,
          },
        };
      }
      return null;
    });

    await expect(
      service.executeCharge(
        {
          client_id: 'client-1',
          cash_register_id: 'reg-b',
          merchant_company_id: 'merch-B',
          amount: 250,
          external_invoice_number: 'FAC-101',
          idempotency_key: 'idem-2',
        },
        'cashier-a',
        '127.0.0.1',
        { role: UserRole.CASHIER, companyId: 'merch-A' },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('rejects POS charge when merchant_company_id conflicts with selected cash register company_id', async () => {
    const { service, txManager } = createHarness();

    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditTransaction) return null;
      if (entity === ClientCreditProfile) return activeClientStub;
      if (entity === CashRegister) {
        return {
          id: 'reg-a',
          company_id: 'merch-A',
          terminal_code: 'POS-A1',
          name: 'Caja A',
          status: CashRegisterStatus.OPEN,
          company: {
            id: 'merch-A',
            name: 'Tienda A',
            ruc: 'J0310000001',
            is_merchant: true,
            status: CompanyStatus.ACTIVE,
          },
        };
      }
      return null;
    });

    await expect(
      service.executeCharge(
        {
          client_id: 'client-1',
          cash_register_id: 'reg-a',
          merchant_company_id: 'merch-OTHER',
          amount: 150,
          external_invoice_number: 'FAC-102',
          idempotency_key: 'idem-3',
        },
        'admin-1',
        '127.0.0.1',
        { role: UserRole.SUPER_ADMIN, companyId: null },
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('charges an ACTIVE client using the register merchant company and returns voucher details', async () => {
    const {
      service,
      txManager,
      creditTxRepo,
      queryRunner,
      whatsappNotifications,
    } = createHarness();

    const merchantCompany = {
      id: 'merch-A',
      name: 'Comisariato A',
      ruc: 'J0310000001',
      is_merchant: true,
      status: CompanyStatus.ACTIVE,
    };
    const cashRegister = {
      id: 'reg-a',
      company_id: 'merch-A',
      terminal_code: 'POS-A1',
      name: 'Caja Principal A',
      location: 'Sucursal A',
      status: CashRegisterStatus.OPEN,
      company: merchantCompany,
    };
    const client = {
      id: 'client-1',
      first_name: 'Carlos',
      last_name: 'Méndez',
      national_id: '001-010190-0001A',
      employee_code: 'EMP-09',
      credit_status: CreditStatus.ACTIVE,
      approved_limit: '5000.00',
      used_balance: '1000.00',
      available_balance: '4000.00',
      employer_company_id: 'emp-1',
      employer_company: { id: 'emp-1', name: 'Grupo Industrial' },
      pin_hash: null,
    };
    const cashierUser = {
      id: 'cashier-1',
      full_name: 'Cajero Test',
      username: 'cajero1',
    };

    txManager.findOne.mockImplementation(async (entity: unknown) => {
      if (entity === CreditTransaction) return null;
      if (entity === CashRegister) return cashRegister;
      if (entity === Company) return merchantCompany;
      if (entity === ClientCreditProfile) return client;
      if (entity === User) return cashierUser;
      return null;
    });

    creditTxRepo.findOneOrFail.mockResolvedValue({
      id: 'tx-saved-1',
      authorization_code: 'AUTH-1234',
      voucher_number: 'VCH-1234',
      external_invoice_number: 'FAC-200',
      created_at: new Date('2026-11-14T12:00:00Z'),
      status: TransactionStatus.APPROVED,
      transaction_type: TransactionType.PURCHASE_CHARGE,
      amount: '500.00',
      previous_available_balance: '4000.00',
      new_available_balance: '3500.00',
      signature_hash: 'sig-hash-123',
      client,
      merchant_company: merchantCompany,
      cash_register: cashRegister,
      cashier: cashierUser,
      cashier_user: cashierUser,
    });

    const voucher = await service.executeCharge(
      {
        client_id: 'client-1',
        cash_register_id: 'reg-a',
        amount: 500,
        external_invoice_number: 'FAC-200',
        idempotency_key: 'idem-4',
      },
      'cashier-1',
      '127.0.0.1',
      { role: UserRole.CASHIER, companyId: 'merch-A' },
    );

    expect(queryRunner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(voucher.merchant.name).toBe('Comisariato A');
    expect(voucher.terminal.terminal_code).toBe('POS-A1');
    expect(voucher.amount).toBe('500.00');
    expect(voucher.new_available_balance).toBe('3500.00');
    expect(whatsappNotifications.notifyPurchaseConsumption).toHaveBeenCalledTimes(1);
  });

  it('writes cash_register_id = null and activates PENDING_APPROVAL client during applyLimitAdjustmentWithManager', async () => {
    const { service, txManager } = createHarness();
    const client = {
      id: 'client-pending',
      first_name: 'Lucía',
      last_name: 'Gómez',
      employer_company_id: 'emp-1',
      approved_limit: '0.00',
      used_balance: '0.00',
      available_balance: '0.00',
      credit_status: CreditStatus.PENDING_APPROVAL,
    } as unknown as ClientCreditProfile;

    const updated = await service.applyLimitAdjustmentWithManager(
      txManager as never,
      client,
      4500,
      'Aprobación inicial de línea',
      'admin-1',
      '127.0.0.1',
    );

    expect(updated.approved_limit).toBe('4500.00');
    expect(updated.available_balance).toBe('4500.00');
    expect(updated.credit_status).toBe(CreditStatus.ACTIVE);

    const txCreateCall = txManager.create.mock.calls.find(
      ([entity]) => entity === CreditTransaction,
    );
    expect(txCreateCall?.[1]).toMatchObject({
      transaction_type: TransactionType.LIMIT_ADJUSTMENT,
      cash_register_id: null,
      merchant_company_id: 'emp-1',
      status: TransactionStatus.APPROVED,
    });
    expect(
      txManager.create.mock.calls.some(([entity]) => entity === AuditLog),
    ).toBe(true);
  });

  it('forbids a scoped CASHIER from voiding a transaction belonging to another company', async () => {
    const { service, txManager, queryRunner } = createHarness();

    txManager.findOne.mockResolvedValue({
      id: 'tx-b1',
      client_id: 'client-1',
      merchant_company_id: 'merch-B',
      transaction_type: TransactionType.PURCHASE_CHARGE,
      status: TransactionStatus.APPROVED,
      amount: '200.00',
      client: { id: 'client-1' },
    });

    await expect(
      service.executeVoid(
        'tx-b1',
        { void_reason: 'Error de captura' },
        'cashier-a',
        '127.0.0.1',
        { role: UserRole.CASHIER, companyId: 'merch-A' },
      ),
    ).rejects.toThrow(ForbiddenException);

    expect(queryRunner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });
});
