export type WhatsAppIntent =
  | 'CHECK_APPROVED'
  | 'CHECK_AVAILABLE'
  | 'LAST_INVOICE'
  | 'HISTORY'
  | 'REQUEST_INCREASE'
  | 'TALK_TO_HUMAN'
  | 'MENU';

/**
 * Fast, deterministic NLP intent classifier for WhatsApp:
 * Zero external AI dependencies or mocks. Guaranteed 100% availability.
 */
export function classifyWhatsAppIntent(message: string): {
  intent: WhatsAppIntent;
  requestedAmount?: number;
} {
  const trimmed = message.trim();
  const lower = trimmed.toLowerCase();

  if (
    trimmed === '1' ||
    lower.includes('aprobado') ||
    lower.includes('techo') ||
    lower.includes('limite total') ||
    lower.includes('límite total')
  ) {
    return { intent: 'CHECK_APPROVED' };
  }

  if (
    trimmed === '2' ||
    lower.includes('disponible') ||
    lower.includes('saldo') ||
    lower.includes('cuanto me queda') ||
    lower.includes('cuánto me queda') ||
    lower.includes('puedo comprar')
  ) {
    return { intent: 'CHECK_AVAILABLE' };
  }

  if (
    trimmed === '3' ||
    lower.includes('ultima factura') ||
    lower.includes('última factura') ||
    lower.includes('ultimo consumo') ||
    lower.includes('último consumo') ||
    lower.includes('factura') ||
    lower.includes('ticket')
  ) {
    return { intent: 'LAST_INVOICE' };
  }

  if (
    trimmed === '4' ||
    lower.includes('historial') ||
    lower.includes('movimientos') ||
    lower.includes('estado de cuenta') ||
    lower.includes('compras')
  ) {
    return { intent: 'HISTORY' };
  }

  if (
    trimmed === '5' ||
    lower.includes('aumento') ||
    lower.includes('subir') ||
    lower.includes('mas credito') ||
    lower.includes('más crédito') ||
    lower.includes('nuevo monto')
  ) {
    const match = lower.match(/\d+([.,]\d+)?/);
    const amount = match ? parseFloat(match[0].replace(',', '.')) : undefined;
    return { intent: 'REQUEST_INCREASE', requestedAmount: amount };
  }

  if (
    lower.includes('humano') ||
    lower.includes('persona') ||
    lower.includes('asesor') ||
    lower.includes('agente') ||
    lower.includes('ayuda') ||
    lower.includes('soporte')
  ) {
    return { intent: 'TALK_TO_HUMAN' };
  }

  return { intent: 'MENU' };
}

