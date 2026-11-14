jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

import { BadRequestException, ForbiddenException } from '@nestjs/common';
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
    alwaysReturnExactMatches?: boolean;
    localMatches?: Record<string, unknown>[];
    qbListAfterLookup?: Record<string, unknown>[];
    transactions?: Record<string, unknown>[];
    salesTransactions?: Record<string, unknown>[];
    requests?: Record<string, unknown>[];
    pendingRequest?: Record<string, unknown> | null;
    linkLookup?: Record<string, unknown> | null;
    eligibleCount?: { with_whatsapp: number; deliverable_e164: number; missing_country_code: number };
    runningBulkJob?: boolean;
    onSaveClient?: (entity: unknown) => void;
    onSaveRequest?: (entity: unknown) => Record<string, unknown>;
  }) {
    let qbCall = 0;
    const makeQb = (resultList: unknown[], singleResult?: unknown) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(resultList),
      getOne: jest.fn().mockResolvedValue(singleResult ?? null),
    });

    const clientRepo = {
      createQueryBuilder: jest.fn(() => {
        if (opts.alwaysReturnExactMatches) {
          return makeQb(opts.exactMatches ?? []);
        }
        qbCall += 1;
        if (qbCall === 1) return makeQb(opts.exactMatches ?? []);
        if (qbCall === 2) {
          if (opts.qbListAfterLookup && (opts.exactMatches?.length ?? 0) === 1) {
            return makeQb(opts.qbListAfterLookup);
          }
          return makeQb(opts.localMatches ?? []);
        }
        return makeQb(opts.qbListAfterLookup ?? [], opts.linkLookup ?? null);
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
      createQueryBuilder: jest.fn(() => makeQb(opts.salesTransactions ?? txList)),
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

    const notifications = {
      hasRunningJob: jest.fn().mockReturnValue(opts.runningBulkJob ?? false),
      countEligibleRecipients: jest.fn().mockResolvedValue(
        opts.eligibleCount ?? {
          with_whatsapp: 12,
          deliverable_e164: 12,
          missing_country_code: 0,
        },
      ),
      startCustomBulk: jest.fn().mockResolvedValue({
        id: 'bulk-job-1',
        status: 'RUNNING',
        total: opts.eligibleCount?.with_whatsapp ?? 12,
        processed: 0,
        sent: 0,
        failed: 0,
        errors: [],
        started_at: '2026-11-14T17:00:00.000Z',
        finished_at: null,
      }),
      getJob: jest.fn().mockReturnValue({
        id: 'bulk-job-1',
        status: 'COMPLETED',
        total: 12,
        processed: 12,
        sent: 11,
        failed: 1,
        errors: [],
        started_at: '2026-11-14T17:00:00.000Z',
        finished_at: '2026-11-14T17:01:00.000Z',
      }),
      recordAudit: jest.fn().mockResolvedValue(undefined),
    };

    const service = new AgentService(
      clientRepo as never,
      txRepo as never,
      reqRepo as never,
      notifications as never,
    );
    return { service, clientRepo, txRepo, reqRepo, notifications };
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

  it('blocks non-VIP and unlinked callers with ForbiddenException across all 4 VIP endpoints', async () => {
    const nonVip = {
      id: 'c-planta',
      classification: 'PLANTA FIJA',
      whatsapp_phone: '50588881111',
    };
    const { service } = createService({
      exactMatches: [nonVip],
      alwaysReturnExactMatches: true,
    });
    await expect(service.getVipClientsSummary('50588881111')).rejects.toThrow(ForbiddenException);
    await expect(service.lookupVipClients('50588881111', 'Isaac')).rejects.toThrow(
      ForbiddenException,
    );
    await expect(service.getVipSalesReport('50588881111', { period: 'today' })).rejects.toThrow(
      ForbiddenException,
    );
    await expect(
      service.handleVipBroadcast('50588881111', { action: 'draft', message: 'Aviso general' }),
    ).rejects.toThrow(ForbiddenException);

    const { service: unlinkedSvc } = createService({ exactMatches: [], localMatches: [] });
    await expect(unlinkedSvc.getVipClientsSummary('50599999999')).rejects.toThrow(
      ForbiddenException,
    );
  });

  it('returns real-time client counts by company, classification, and credit status for VIPs', async () => {
    const vip = {
      id: 'c-vip',
      first_name: 'Isaac',
      last_name: 'Lira',
      classification: 'VIP',
      credit_status: CreditStatus.ACTIVE,
      whatsapp_phone: '50587531402',
      employer_company: { id: 'co-1', code: 'GCI', name: 'Grupo Industrial' },
    };
    const allClients = [
      vip,
      {
        id: 'c-2',
        first_name: 'Ana',
        last_name: 'Rivas',
        classification: 'PLANTA FIJA',
        credit_status: CreditStatus.ACTIVE,
        whatsapp_phone: '50588882222',
        employer_company: { id: 'co-1', code: 'GCI', name: 'Grupo Industrial' },
      },
      {
        id: 'c-3',
        first_name: 'Luis',
        last_name: 'Gomez',
        classification: 'TEMPORAL',
        credit_status: CreditStatus.FROZEN,
        whatsapp_phone: '',
        employer_company: { id: 'co-2', code: 'COM', name: 'Comercial Norte' },
      },
    ];

    const { service } = createService({ exactMatches: [vip], qbListAfterLookup: allClients });
    const summary = await service.getVipClientsSummary('50587531402');

    expect(summary.authorized).toBe(true);
    expect(summary.totals.total_clients).toBe(3);
    expect(summary.totals.vip_clients).toBe(1);
    expect(summary.totals.non_vip_clients).toBe(2);
    expect(summary.totals.with_whatsapp_count).toBe(2);
    expect(summary.totals.active_credits).toBe(2);
    expect(summary.totals.frozen_credits).toBe(1);
    expect(summary.by_company[0]).toMatchObject({
      company_name: 'Grupo Industrial',
      client_count: 2,
      vip_count: 1,
      active_count: 2,
    });
    expect(summary.by_classification).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ classification: 'VIP', is_vip: true, count: 1 }),
        expect.objectContaining({ classification: 'PLANTA FIJA', is_vip: false, count: 1 }),
      ]),
    );
    expect(summary.by_credit_status).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ credit_status: CreditStatus.ACTIVE, credit_status_label: 'Activo', count: 2 }),
        expect.objectContaining({ credit_status: CreditStatus.FROZEN, credit_status_label: 'Congelado', count: 1 }),
      ]),
    );
  });

  it('looks up registered client availability, names, and status without leaking salaries', async () => {
    const vip = {
      id: 'c-vip',
      first_name: 'Isaac',
      last_name: 'Lira',
      classification: 'VIP',
      whatsapp_phone: '50587531402',
    };
    const matched = {
      id: 'c-4',
      first_name: 'Maria',
      last_name: 'Martinez',
      employee_code: 'EMP-044',
      national_id: '001-010190-0001A',
      job_title: 'Contadora',
      grade_level: 'G-3',
      classification: 'PLANTA FIJA',
      salary_encrypted: 'encrypted-secret',
      whatsapp_phone: '50588884444',
      birth_date: '1990-01-01',
      credit_status: CreditStatus.ACTIVE,
      approved_limit: '10000.00',
      used_balance: '2500.00',
      available_balance: '7500.00',
      employer_company: { name: 'Grupo Industrial' },
    };

    const { service } = createService({ exactMatches: [vip], qbListAfterLookup: [matched] });
    const res = await service.lookupVipClients('50587531402', 'Maria Martinez');

    expect(res.found).toBe(true);
    expect(res.count).toBe(1);
    expect(res.clients[0]).toMatchObject({
      registered: true,
      first_name: 'Maria',
      last_name: 'Martinez',
      full_name: 'Maria Martinez',
      available_balance: 7500,
      available_balance_formatted: 'C$ 7,500.00',
      credit_status_label: 'Activo',
      whatsapp_linked: true,
    });
    expect((res.clients[0] as unknown as Record<string, unknown>)['salary']).toBeUndefined();
    expect(
      (res.clients[0] as unknown as Record<string, unknown>)['salary_encrypted'],
    ).toBeUndefined();
  });

  it('aggregates daily/period sales reports by company and by total while separating voided sales', async () => {
    const vip = { id: 'c-vip', classification: 'VIP', whatsapp_phone: '50587531402' };
    const txs = [
      {
        id: 't1',
        amount: '1500.00',
        status: TransactionStatus.APPROVED,
        transaction_type: TransactionType.PURCHASE_CHARGE,
        merchant_company_id: 'm1',
        merchant_company: { id: 'm1', code: 'COM-1', name: 'Comisariato Central' },
        client: { employer_company_id: 'e1', employer_company: { id: 'e1', name: 'Planta Sur' } },
      },
      {
        id: 't2',
        amount: '500.00',
        status: TransactionStatus.APPROVED,
        transaction_type: TransactionType.PURCHASE_CHARGE,
        merchant_company_id: 'm2',
        merchant_company: { id: 'm2', code: 'FAR-1', name: 'Farmacia Norte' },
        client: { employer_company_id: 'e1', employer_company: { id: 'e1', name: 'Planta Sur' } },
      },
      {
        id: 't3',
        amount: '300.00',
        status: TransactionStatus.VOIDED,
        transaction_type: TransactionType.PURCHASE_CHARGE,
        merchant_company_id: 'm1',
        merchant_company: { id: 'm1', code: 'COM-1', name: 'Comisariato Central' },
        client: { employer_company_id: 'e1', employer_company: { id: 'e1', name: 'Planta Sur' } },
      },
    ];

    const { service } = createService({ exactMatches: [vip], salesTransactions: txs });
    const byCompany = await service.getVipSalesReport('50587531402', {
      period: 'custom',
      from: '2026-11-01',
      to: '2026-11-14',
      groupBy: 'company',
    });

    expect(byCompany.totals.sales_count).toBe(2);
    expect(byCompany.totals.total_amount).toBe(2000);
    expect(byCompany.totals.total_amount_formatted).toBe('C$ 2,000.00');
    expect(byCompany.totals.voided_count).toBe(1);
    expect(byCompany.totals.voided_amount).toBe(300);
    expect(byCompany.by_company).toHaveLength(2);
    expect(byCompany.by_company[0]).toMatchObject({
      company_name: 'Comisariato Central',
      total_amount_formatted: 'C$ 1,500.00',
      share_percentage: 75,
    });

    const { service: totalSvc } = createService({ exactMatches: [vip], salesTransactions: txs });
    const byTotal = await totalSvc.getVipSalesReport('50587531402', {
      period: 'hoy',
      groupBy: 'total',
    });
    expect(byTotal.group_by).toBe('total');
    expect(byTotal.by_company).toEqual([]);
    expect(byTotal.totals.companies_involved).toEqual(['Comisariato Central', 'Farmacia Norte']);
  });

  it('requires draft + explicit approval before sending VIP broadcast notifications', async () => {
    const vip = {
      id: 'c-vip',
      first_name: 'Isaac',
      last_name: 'Lira',
      classification: 'VIP',
      whatsapp_phone: '50587531402',
    };
    const otherVip = {
      id: 'c-vip-other',
      first_name: 'Otro',
      last_name: 'VIP',
      classification: 'VIP',
      whatsapp_phone: '50587539999',
    };
    const { service, clientRepo, notifications } = createService({
      exactMatches: [vip],
      alwaysReturnExactMatches: true,
    });

    const draft = await service.handleVipBroadcast('50587531402', {
      action: 'draft',
      message: 'Aviso importante: mañana cerramos a las 2:00 p. m.',
    });

    expect(draft.status).toBe('DRAFT_PENDING_APPROVAL');
    expect(draft.requires_approval).toBe(true);
    expect(draft.sent_started).toBe(false);
    expect(draft.recipients_count).toBe(12);
    expect(draft.draft_id).toBeDefined();
    expect(notifications.startCustomBulk).not.toHaveBeenCalled();

    // Missing explicit approve=true cannot send
    await expect(
      service.handleVipBroadcast('50587531402', {
        action: 'confirm',
        draft_id: draft.draft_id,
        approve: false,
      }),
    ).rejects.toThrow(BadRequestException);

    // Another VIP cannot confirm someone else's draft on the same singleton service
    const makeSingleResultQb = (rows: unknown[]) => ({
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      addOrderBy: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getMany: jest.fn().mockResolvedValue(rows),
      getOne: jest.fn().mockResolvedValue(null),
    });
    clientRepo.createQueryBuilder.mockImplementationOnce(() => makeSingleResultQb([otherVip]));
    await expect(
      service.handleVipBroadcast('50587539999', {
        action: 'confirm',
        draft_id: draft.draft_id,
        approve: true,
      }),
    ).rejects.toThrow(BadRequestException);

    // Confirming with valid draft_id + approve=true from owner starts broadcast once
    const confirmed = await service.handleVipBroadcast('50587531402', {
      action: 'confirm',
      draft_id: draft.draft_id,
      approve: true,
    });
    expect(confirmed.status).toBe('SENDING');
    expect(confirmed.sent_started).toBe(true);
    expect(confirmed.job_id).toBe('bulk-job-1');
    expect(notifications.startCustomBulk).toHaveBeenCalledWith(
      'Aviso importante: mañana cerramos a las 2:00 p. m.',
      expect.objectContaining({
        userId: null,
        auditAction: 'WHATSAPP_VIP_BROADCAST_SENT',
      }),
    );

    // Replaying the same draft_id fails cleanly
    await expect(
      service.handleVipBroadcast('50587531402', {
        action: 'confirm',
        draft_id: draft.draft_id,
        approve: true,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
