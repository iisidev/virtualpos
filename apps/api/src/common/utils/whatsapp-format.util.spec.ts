import {
  CreditStatus,
  IncreaseRequestStatus,
  TransactionStatus,
  TransactionType,
} from '../enums';
import {
  CREDIT_STATUS_LABELS,
  INCREASE_REQUEST_STATUS_LABELS,
  TRANSACTION_STATUS_LABELS,
  TRANSACTION_TYPE_LABELS,
  formatAmount,
  formatCordoba,
  formatWhatsAppDateTime,
  translateEnumLabel,
} from './whatsapp-format.util';

describe('whatsapp-format.util', () => {
  it('formats Cordoba monetary values consistently', () => {
    expect(formatAmount(1250.5)).toBe('1,250.50');
    expect(formatCordoba('15000')).toBe('C$ 15,000.00');
    expect(formatCordoba('not-a-number')).toBe('C$ 0.00');
  });

  it('formats UTC dates to Nicaragua local time (UTC-6)', () => {
    // 2026-11-14T04:15:00Z -> 2026-11-13 10:15 PM in America/Managua
    expect(formatWhatsAppDateTime('2026-11-14T04:15:00.000Z')).toBe('13/11/2026, 10:15 p. m.');
    // 2026-11-13T14:05:00Z -> 2026-11-13 08:05 AM in America/Managua
    expect(formatWhatsAppDateTime(new Date('2026-11-13T14:05:00.000Z'))).toBe(
      '13/11/2026, 08:05 a. m.',
    );
  });

  it('translates domain enums into readable Spanish labels', () => {
    expect(translateEnumLabel(CreditStatus.ACTIVE, CREDIT_STATUS_LABELS)).toBe('Activo');
    expect(translateEnumLabel(CreditStatus.FROZEN, CREDIT_STATUS_LABELS)).toBe('Congelado');
    expect(translateEnumLabel(TransactionType.PURCHASE_CHARGE, TRANSACTION_TYPE_LABELS)).toBe(
      'Compra a crédito',
    );
    expect(translateEnumLabel(TransactionType.PAYMENT_ABONO, TRANSACTION_TYPE_LABELS)).toBe(
      'Abono / Pago',
    );
    expect(translateEnumLabel(TransactionStatus.APPROVED, TRANSACTION_STATUS_LABELS)).toBe(
      'Aprobada',
    );
    expect(
      translateEnumLabel(IncreaseRequestStatus.PENDING, INCREASE_REQUEST_STATUS_LABELS),
    ).toBe('Pendiente de revisión');
  });
});
