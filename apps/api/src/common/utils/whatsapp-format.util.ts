import {
  CreditStatus,
  IncreaseRequestStatus,
  TransactionStatus,
  TransactionType,
} from '../enums';

export const CREDIT_STATUS_LABELS: Record<string, string> = {
  [CreditStatus.ACTIVE]: 'Activo',
  [CreditStatus.FROZEN]: 'Congelado',
  [CreditStatus.BLOCKED]: 'Bloqueado',
  [CreditStatus.PENDING_APPROVAL]: 'Pendiente de aprobación',
};

export const TRANSACTION_TYPE_LABELS: Record<string, string> = {
  [TransactionType.PURCHASE_CHARGE]: 'Compra a crédito',
  [TransactionType.PAYMENT_ABONO]: 'Abono / Pago',
  [TransactionType.VOID_REVERSAL]: 'Anulación / Reverso',
  [TransactionType.LIMIT_ADJUSTMENT]: 'Ajuste de límite',
};

export const TRANSACTION_STATUS_LABELS: Record<string, string> = {
  [TransactionStatus.APPROVED]: 'Aprobada',
  [TransactionStatus.VOIDED]: 'Anulada',
  [TransactionStatus.REJECTED]: 'Rechazada',
};

export const INCREASE_REQUEST_STATUS_LABELS: Record<string, string> = {
  [IncreaseRequestStatus.PENDING]: 'Pendiente de revisión',
  [IncreaseRequestStatus.APPROVED]: 'Aprobada',
  [IncreaseRequestStatus.REJECTED]: 'Rechazada',
};

export function translateEnumLabel(value: string, labels: Record<string, string>): string {
  return labels[value] ?? value;
}

/**
 * Formats a monetary value using standard grouping and 2 decimal places (`1,250.00`).
 */
export function formatAmount(value: number | string): string {
  const num = Number(value);
  return (Number.isFinite(num) ? num : 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Formats a Córdoba monetary value (`C$ 1,250.00`) consistently across Node locales.
 */
export function formatCordoba(value: number | string): string {
  return `C$ ${formatAmount(value)}`;
}

/**
 * Formats a timestamp into Nicaragua local date/time (`DD/MM/YYYY, hh:mm a. m./p. m.`)
 * independently of container timezone or minimal-ICU builds.
 */
export function formatWhatsAppDateTime(input: Date | string): string {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Managua',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).formatToParts(date);

  const pick = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((p) => p.type === type)?.value ?? '';

  const period = pick('dayPeriod').toUpperCase() === 'PM' ? 'p. m.' : 'a. m.';
  return `${pick('day')}/${pick('month')}/${pick('year')}, ${pick('hour')}:${pick('minute')} ${period}`;
}
