jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import { CreditStatus, TransactionStatus, TransactionType } from '../../common/enums';
import { extractPhoneDigits, toWhatsAppE164 } from '../../common/utils/phone.util';
import { AgentService } from './agent.service';

describe('phone.util & AgentService (Real-Time Queries)', () => {
  it('extractPhoneDigits handles E.164, whatsapp prefix, and multi-device JIDs', () => {
    expect(extractPhoneDigits('50587531402:12@s.whatsapp.net')).toBe('50587531402');
    expect(extractPhoneDigits('whatsapp:+50587531402')).toBe('50587531402');
    expect(extractPhoneDigits('+505 8753-1402')).toBe('50587531402');
    expect(extractPhoneDigits('87531402')).toBe('87531402');
  });

  it('toWhatsAppE164 formats local and international numbers consistently', () => {
    expect(toWhatsAppE164('87531402', '505')).toBe('+50587531402');
    expect(toWhatsAppE164('87531402', '')).toBeNull();
    expect(toWhatsAppE164('50587531402:12@s.whatsapp.net')).toBe('+50587531402');
    expect(toWhatsAppE164('+505 8753-1402')).toBe('+50587531402');
  });

  function createService(opts: {
    exactMatches?: Record<string, unknown>[];
    localMatches?: Record<string, unknown>[];
    transactions?: Record<string, unknown>[];
    linkLookup?: Record<string, unknown> | null;
    onSave?: (entity: unknown) => void;
  }) {
    let qbCall = 0;
    const makeQb = (resultList: unknown[], singleResult?: unknown) => {
      const qb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(resultList),
        getOne: jest.fn().mockResolvedValue(singleResult ?? null),
      };
      return qb;
    };

    const clientRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        if (qbCall === 1) return makeQb(opts.exactMatches ?? []);
        if (qbCall === 2) return makeQb(opts.localMatches ?? []);
        return makeQb([], opts.linkLookup ?? null);
      }),
      save: jest.fn(async (entity: unknown) => {
        opts.onSave?.(entity);
        return entity;
      }),
    };

    const txList = opts.transactions ?? [];
    const txRepo = {
      findOne: jest.fn().mockResolvedValue(txList[0] ?? null),
      find: jest.fn().mockResolvedValue(txList),
    };

    const service = new AgentService(clientRepo as never, txRepo as never);
    return { service, clientRepo, txRepo };
  }

  it('returns live balance, can_purchase status, and last_movement for WhatsApp JID', async () => {
    const client = {
      id: 'c-1',
      first_name: 'Isaac',
      last_name: 'Lira',
      employee_code: 'EMP-004',
      employer_company: { name: 'Grupo Corporativo' },
      credit_status: CreditStatus.FROZEN,
      approved_limit: '5000.00',
      used_balance: '1200.00',
      available_balance: '3800.00',
      updated_at: new Date('2026-11-13T10:00:00Z'),
    };
    const tx = {
      id: 'tx-1',
      created_at: new Date('2026-11-13T09:50:00Z'),
      transaction_type: TransactionType.PURCHASE_CHARGE,
      amount: '250.00',
      voucher_number: 'VALE-99',
      authorization_code: 'AUT-777',
      external_invoice_number: 'FACT-12',
      merchant_company: { name: 'Supermercado X' },
      status: TransactionStatus.APPROVED,
      previous_available_balance: '4050.00',
      new_available_balance: '3800.00',
    };

    const { service } = createService({ exactMatches: [client], transactions: [tx] });
    const res = await service.getBalance('50587531402:14@s.whatsapp.net');

    expect(res.linked).toBe(true);
    expect(typeof res.queried_at).toBe('string');
    expect(res.client?.full_name).toBe('Isaac Lira');
    expect(res.client?.credit_status).toBe(CreditStatus.FROZEN);
    expect(res.client?.can_purchase).toBe(false);
    expect(res.client?.available_balance).toBe(3800);
    expect(res.client?.last_movement?.voucher_number).toBe('VALE-99');
    expect(res.client?.last_movement?.new_available_balance).toBe(3800);
  });

  it('falls back to unique 8-digit match when exact digits are absent and returns movements + live balance', async () => {
    const client = {
      id: 'c-2',
      first_name: 'Ana',
      last_name: 'Gomez',
      employee_code: 'EMP-008',
      credit_status: CreditStatus.ACTIVE,
      approved_limit: '2000.00',
      used_balance: '500.00',
      available_balance: '1500.00',
      updated_at: new Date('2026-11-13T10:00:00Z'),
    };
    const { service } = createService({ exactMatches: [], localMatches: [client], transactions: [] });
    const mov = await service.getMovements('+50587531402', 5);

    expect(mov.linked).toBe(true);
    expect(mov.client?.available_balance).toBe(1500);
    expect(mov.movements).toEqual([]);
  });

  it('returns linked: false when 8-digit fallback is ambiguous', async () => {
    const { service } = createService({ exactMatches: [], localMatches: [{ id: '1' }, { id: '2' }] });
    const res = await service.getBalance('87531402');
    expect(res.linked).toBe(false);
  });

  it('links phone case-insensitively and validates short phone input', async () => {
    let savedPhone = '';
    const client = {
      id: 'c-3',
      first_name: 'Carlos',
      last_name: 'Mora',
      employee_code: 'EMP-010',
      whatsapp_phone: '',
    };
    const { service } = createService({
      exactMatches: [],
      localMatches: [],
      linkLookup: client,
      onSave: (e) => {
        savedPhone = (e as { whatsapp_phone: string }).whatsapp_phone;
      },
    });

    await expect(service.getBalance('1234')).rejects.toThrow(BadRequestException);

    const linked = await service.linkPhone('whatsapp:+50587531402', 'emp-010');
    expect(linked.linked).toBe(true);
    expect(savedPhone).toBe('50587531402');
  });
});
