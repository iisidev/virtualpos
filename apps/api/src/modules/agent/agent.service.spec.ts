jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));

import { BadRequestException } from '@nestjs/common';
import {
  ChannelType,
  CreditStatus,
  IncreaseRequestStatus,
  TransactionStatus,
  TransactionType,
} from '../../common/enums';
import { isVipClassification, resolveAgentAccessMode } from '../../common/utils/classification.util';
import { extractPhoneDigits, toWhatsAppE164 } from '../../common/utils/phone.util';
import { AgentService } from './agent.service';

describe('phone.util, classification.util & AgentService', () => {
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

  it('validates VIP vs non-VIP classification accurately', () => {
    expect(isVipClassification('VIP')).toBe(true);
    expect(isVipClassification('vip')).toBe(true);
    expect(isVipClassification('Cliente VIP')).toBe(true);
    expect(isVipClassification('NO VIP')).toBe(false);
    expect(isVipClassification('PLANTA')).toBe(false);
    expect(isVipClassification('CONFIANZA')).toBe(false);
    expect(isVipClassification('TEMPORAL')).toBe(false);
    expect(isVipClassification('')).toBe(false);

    expect(resolveAgentAccessMode(true, 'VIP')).toBe('VIP_FULL_AGENT');
    expect(resolveAgentAccessMode(true, 'PLANTA')).toBe('CORPORATE_CREDIT_ONLY');
    expect(resolveAgentAccessMode(false, 'VIP')).toBe('UNLINKED');
  });

  function createService(opts: {
    exactMatches?: Record<string, unknown>[];
    localMatches?: Record<string, unknown>[];
    transactions?: Record<string, unknown>[];
    requests?: Record<string, unknown>[];
    pendingRequest?: Record<string, unknown> | null;
    linkLookup?: Record<string, unknown> | null;
    onSaveClient?: (entity: unknown) => void;
    onSaveRequest?: (entity: unknown) => Record<string, unknown>;
  }) {
    let qbCall = 0;
    const makeQb = (resultList: unknown[], singleResult?: unknown) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(resultList),
      getOne: jest.fn().mockResolvedValue(singleResult ?? null),
    });

    const clientRepo = {
      createQueryBuilder: jest.fn(() => {
        qbCall += 1;
        if (qbCall === 1) return makeQb(opts.exactMatches ?? []);
        if (qbCall === 2) return makeQb(opts.localMatches ?? []);
        return makeQb([], opts.linkLookup ?? null);
      }),
      save: jest.fn(async (entity: unknown) => {
        opts.onSaveClient?.(entity);
        return entity;
      }),
    };

    const txList = opts.transactions ?? [];
    const txRepo = {
      findOne: jest.fn().mockResolvedValue(txList[0] ?? null),
      find: jest.fn().mockResolvedValue(txList),
    };

    const reqRepo = {
      findOne: jest.fn().mockResolvedValue(opts.pendingRequest ?? null),
      find: jest.fn().mockResolvedValue(opts.requests ?? []),
      create: jest.fn((data: Record<string, unknown>) => data),
      save: jest.fn(async (entity: Record<string, unknown>) => {
        if (opts.onSaveRequest) return opts.onSaveRequest(entity);
        return {
          id: '99887766-aaaa-bbbb-cccc-1234567890ab',
          created_at: new Date('2026-11-13T10:05:00Z'),
          ...entity,
        };
      }),
    };

    const service = new AgentService(clientRepo as never, txRepo as never, reqRepo as never);
    return { service, clientRepo, txRepo, reqRepo };
  }

  it('returns VIP_FULL_AGENT mode and full profile data when client classification is VIP', async () => {
    const vipClient = {
      id: 'c-vip',
      first_name: 'Isaac',
      last_name: 'Lira',
      employee_code: 'EMP-001',
      national_id: '001-121092-0000X',
      job_title: 'Director TI',
      grade_level: 'G-7',
      classification: 'VIP',
      whatsapp_phone: '50587531402',
      birth_date: '1992-10-12',
      employer_company: { name: 'Grupo Corporativo' },
      credit_status: CreditStatus.ACTIVE,
      approved_limit: '15000.00',
      used_balance: '1200.00',
      available_balance: '13800.00',
      updated_at: new Date('2026-11-13T10:00:00Z'),
    };
    const { service } = createService({ exactMatches: [vipClient] });
    const res = await service.getBalance('50587531402:14@s.whatsapp.net');

    expect(res.linked).toBe(true);
    expect(res.is_vip).toBe(true);
    expect(res.agent_mode).toBe('VIP_FULL_AGENT');
    expect(res.client?.classification).toBe('VIP');
    expect(res.client?.job_title).toBe('Director TI');
    expect(res.client?.credit_status_label).toBe('Activo');
    expect(res.client?.approved_limit_formatted).toBe('C$ 15,000.00');
    expect(res.client?.available_balance_formatted).toBe('C$ 13,800.00');
    expect(res.client?.can_purchase).toBe(true);
  });

  it('returns CORPORATE_CREDIT_ONLY mode, live balance, and last_movement for non-VIP client', async () => {
    const client = {
      id: 'c-1',
      first_name: 'Maria',
      last_name: 'Rivas',
      employee_code: 'EMP-004',
      national_id: '001-050488-0002Y',
      job_title: 'Analista Contable',
      grade_level: 'G-3',
      classification: 'PLANTA',
      whatsapp_phone: '50587531402',
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
    const res = await service.getBalance('+50587531402');

    expect(res.linked).toBe(true);
    expect(res.is_vip).toBe(false);
    expect(res.agent_mode).toBe('CORPORATE_CREDIT_ONLY');
    expect(res.client?.job_title).toBe('Analista Contable');
    expect(res.client?.credit_status).toBe(CreditStatus.FROZEN);
    expect(res.client?.credit_status_label).toBe('Congelado');
    expect(res.client?.can_purchase).toBe(false);
    expect(res.client?.last_movement?.voucher_number).toBe('VALE-99');
    expect(res.client?.last_movement?.type_label).toBe('Compra a crédito');
    expect(res.client?.last_movement?.status_label).toBe('Aprobada');
    expect(res.client?.last_movement?.amount_formatted).toBe('C$ 250.00');
    expect(res.client?.last_movement?.date_formatted).toBe('13/11/2026, 03:50 a. m.');
  });

  it('creates a WhatsApp credit increase request for a linked non-VIP client and blocks duplicates', async () => {
    const client = {
      id: 'c-nonvip',
      first_name: 'Ana',
      last_name: 'Gomez',
      classification: 'CONFIANZA',
      credit_status: CreditStatus.ACTIVE,
      approved_limit: '5000.00',
    };
    const { service, reqRepo } = createService({
      exactMatches: [client],
      pendingRequest: null,
    });

    const created = await service.createCreditRequest('+50587531402', 9000, 'Gastos escolares');
    expect(created.linked).toBe(true);
    expect(created.created).toBe(true);
    expect(created.is_vip).toBe(false);
    expect(created.agent_mode).toBe('CORPORATE_CREDIT_ONLY');
    expect(created.request_code).toBe('REQ-99887766');
    expect(reqRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        channel: ChannelType.WHATSAPP_BOT,
        status: IncreaseRequestStatus.PENDING,
        requested_limit: '9000.00',
      }),
    );

    const { service: dupService } = createService({
      exactMatches: [client],
      pendingRequest: {
        id: 'abcd1234-0000-0000-0000-000000000000',
        current_limit: '5000.00',
        requested_limit: '9000.00',
        reason: 'Pendiente',
        channel: ChannelType.WHATSAPP_BOT,
        status: IncreaseRequestStatus.PENDING,
        created_at: new Date('2026-11-13T10:00:00Z'),
      },
    });
    const dup = await dupService.createCreditRequest('+50587531402', 12000, 'Otro');
    expect(dup.created).toBe(false);
    expect(dup.duplicate).toBe(true);
    expect(dup.request_code).toBe('REQ-ABCD1234');
  });

  it('rejects increase request when requested_limit <= current_limit or client is BLOCKED', async () => {
    const blocked = {
      id: 'c-blk',
      classification: 'TEMPORAL',
      credit_status: CreditStatus.BLOCKED,
      approved_limit: '5000.00',
    };
    const { service: svcBlocked } = createService({ exactMatches: [blocked] });
    const resBlocked = await svcBlocked.createCreditRequest('50587531402', 8000);
    expect(resBlocked.created).toBe(false);

    const active = { ...blocked, credit_status: CreditStatus.ACTIVE };
    const { service: svcLow } = createService({ exactMatches: [active] });
    const resLow = await svcLow.createCreditRequest('50587531402', 4000);
    expect(resLow.created).toBe(false);
    expect(resLow.message).toContain('debe ser mayor');
  });

  it('falls back to unique 8-digit match when exact digits are absent and handles movements + unlinked mode', async () => {
    const client = {
      id: 'c-2',
      first_name: 'Ana',
      last_name: 'Gomez',
      job_title: 'Supervisora',
      classification: 'PLANTA',
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
    expect(mov.agent_mode).toBe('CORPORATE_CREDIT_ONLY');
    expect(mov.client?.available_balance).toBe(1500);
    expect(mov.movements).toEqual([]);

    const { service: unlinkedSvc } = createService({ exactMatches: [], localMatches: [] });
    const unlinked = await unlinkedSvc.getBalance('50599999999');
    expect(unlinked.linked).toBe(false);
    expect(unlinked.is_vip).toBe(false);
    expect(unlinked.agent_mode).toBe('UNLINKED');
  });

  it('links phone case-insensitively and reports VIP access mode', async () => {
    let savedPhone = '';
    const client = {
      id: 'c-3',
      first_name: 'Carlos',
      last_name: 'Mora',
      employee_code: 'EMP-010',
      classification: 'VIP',
      whatsapp_phone: '',
    };
    const { service } = createService({
      exactMatches: [],
      localMatches: [],
      linkLookup: client,
      onSaveClient: (e) => {
        savedPhone = (e as { whatsapp_phone: string }).whatsapp_phone;
      },
    });

    await expect(service.getBalance('1234')).rejects.toThrow(BadRequestException);

    const linked = await service.linkPhone('whatsapp:+50587531402', 'emp-010');
    expect(linked.linked).toBe(true);
    expect(linked.is_vip).toBe(true);
    expect(linked.agent_mode).toBe('VIP_FULL_AGENT');
    expect(savedPhone).toBe('50587531402');
  });
});
