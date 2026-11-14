jest.mock('@nestjs/typeorm', () => ({
  InjectRepository: () => () => undefined,
}));
jest.mock('@nestjs/config', () => ({
  ConfigService: class {},
}));

import { CreditTransaction } from '../../database/entities';
import { WhatsAppNotificationsService } from './whatsapp-notifications.service';

describe('WhatsAppNotificationsService', () => {
  function createService(opts?: {
    sendResult?: { ok: boolean; error?: string };
    throwOnSend?: boolean;
    defaultCountryCode?: string;
  }) {
    const clientRepo = { findOne: jest.fn(), createQueryBuilder: jest.fn() };
    const auditRepo = {
      create: jest.fn((data: unknown) => data),
      save: jest.fn(async (data: unknown) => data),
    };
    const provider = {
      sendText: opts?.throwOnSend
        ? jest.fn().mockRejectedValue(new Error('OpenClaw unreachable'))
        : jest.fn().mockResolvedValue(opts?.sendResult ?? { ok: true }),
    };
    const config = {
      get: jest.fn((key: string) =>
        key === 'WHATSAPP_DEFAULT_COUNTRY_CODE' ? opts?.defaultCountryCode ?? '505' : undefined,
      ),
    };

    const service = new WhatsAppNotificationsService(
      clientRepo as never,
      auditRepo as never,
      provider as never,
      config as never,
    );
    return { service, provider, auditRepo };
  }

  it('builds welcome message with menu options 1, 2, 3, 4', () => {
    const { service } = createService();
    const msg = service.buildWelcomeMessage('Isaac', 'Grupo Industrial');
    expect(msg).toContain('Isaac');
    expect(msg).toContain('Grupo Industrial');
    expect(msg).toContain('1️⃣ Crédito aprobado');
    expect(msg).toContain('2️⃣ Crédito disponible');
    expect(msg).toContain('3️⃣ Últimos movimientos');
    expect(msg).toContain('4️⃣ Solicitar aumento de crédito');
  });

  it('builds expected consumption message in Cordobas', () => {
    const { service } = createService();
    const msg = service.buildConsumptionMessage(
      'Comisariato Central',
      '1250.5',
      '3749.5',
      'VALE-001',
      'AUT-999',
    );
    expect(msg).toContain('Se ha registrado un crédito en *Comisariato Central* por el monto de *C$ 1,250.50* consumiendo del crédito, quedando un monto disponible de *C$ 3,749.50*.');
    expect(msg).toContain('Vale: VALE-001');
    expect(msg).toContain('Aut: AUT-999');
  });

  it('skips sending when client has no whatsapp_phone', async () => {
    const { service, provider } = createService();
    const res = await service.notifyPurchaseConsumption({
      id: 'tx-1',
      client_id: 'c-1',
      cashier_user_id: 'u-1',
      amount: '100.00',
      new_available_balance: '900.00',
      voucher_number: 'V-1',
      authorization_code: 'A-1',
      client: { whatsapp_phone: '  ' },
      merchant_company: { name: 'Tienda X' },
    } as unknown as CreditTransaction);

    expect(res).toEqual({
      attempted: false,
      ok: false,
      phone: null,
      error: 'Cliente sin número de WhatsApp registrado',
    });
    expect(provider.sendText).not.toHaveBeenCalled();
  });

  it('normalizes local 8-digit phone via WHATSAPP_DEFAULT_COUNTRY_CODE and notifies OpenClaw', async () => {
    const { service, provider, auditRepo } = createService({ defaultCountryCode: '505' });
    const res = await service.notifyPurchaseConsumption({
      id: 'tx-2',
      client_id: 'c-2',
      cashier_user_id: 'u-1',
      amount: '250.00',
      new_available_balance: '4750.00',
      voucher_number: 'V-2',
      authorization_code: 'A-2',
      client: { whatsapp_phone: '87531402' },
      merchant_company: { name: 'Farmacia Norte' },
    } as unknown as CreditTransaction);

    expect(res).toEqual({ attempted: true, ok: true, phone: '+50587531402', error: undefined });
    expect(provider.sendText).toHaveBeenCalledWith(
      '+50587531402',
      expect.stringContaining('Farmacia Norte'),
    );
    expect(auditRepo.save).toHaveBeenCalledTimes(1);
  });

  it('never throws if OpenClaw fails during consumption notification', async () => {
    const { service } = createService({ throwOnSend: true });
    const res = await service.notifyPurchaseConsumption({
      id: 'tx-3',
      client_id: 'c-3',
      cashier_user_id: 'u-1',
      amount: '50.00',
      new_available_balance: '950.00',
      voucher_number: 'V-3',
      authorization_code: 'A-3',
      client: { whatsapp_phone: '+50587531402' },
      merchant_company: { name: 'Ferreteria' },
    } as unknown as CreditTransaction);

    expect(res).toEqual({
      attempted: true,
      ok: false,
      phone: '+50587531402',
      error: 'OpenClaw unreachable',
    });
  });
});
