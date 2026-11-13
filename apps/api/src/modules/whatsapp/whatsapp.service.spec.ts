import { classifyWhatsAppIntent } from './whatsapp-intent.classifier';

describe('WhatsApp Intent Classifier (Zero Mocks, Real Deterministic Flow)', () => {
  it('should correctly classify numeric choices', () => {
    expect(classifyWhatsAppIntent('1').intent).toBe('CHECK_APPROVED');
    expect(classifyWhatsAppIntent('2').intent).toBe('CHECK_AVAILABLE');
    expect(classifyWhatsAppIntent('3').intent).toBe('LAST_INVOICE');
    expect(classifyWhatsAppIntent('4').intent).toBe('HISTORY');
    expect(classifyWhatsAppIntent('5').intent).toBe('REQUEST_INCREASE');
  });

  it('should correctly classify natural language queries', () => {
    expect(classifyWhatsAppIntent('¿Cuánto me queda de saldo disponible?').intent).toBe('CHECK_AVAILABLE');
    expect(classifyWhatsAppIntent('¿Cuál es mi límite total aprobado?').intent).toBe('CHECK_APPROVED');
    expect(classifyWhatsAppIntent('Quiero ver el detalle de mi última factura').intent).toBe('LAST_INVOICE');
    expect(classifyWhatsAppIntent('Ver estado de cuenta y compras recientes').intent).toBe('HISTORY');
    const req = classifyWhatsAppIntent('Quiero solicitar aumento a 25000');
    expect(req.intent).toBe('REQUEST_INCREASE');
    expect(req.requestedAmount).toBe(25000);
    expect(classifyWhatsAppIntent('Necesito hablar con un asesor humano').intent).toBe('TALK_TO_HUMAN');
    expect(classifyWhatsAppIntent('hola').intent).toBe('MENU');
  });
});
