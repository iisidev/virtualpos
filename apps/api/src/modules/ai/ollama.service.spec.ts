import { OllamaService } from './ollama.service';

describe('OllamaService (NLP & Heuristic Intent Classification)', () => {
  let service: OllamaService;

  beforeEach(() => {
    service = new OllamaService();
  });

  it('should classify numeric options directly with 1.0 confidence', async () => {
    expect((await service.classifyUserMessage('1')).intent).toBe('CHECK_APPROVED');
    expect((await service.classifyUserMessage('2')).intent).toBe('CHECK_AVAILABLE');
    expect((await service.classifyUserMessage('3')).intent).toBe('LAST_INVOICE');
    expect((await service.classifyUserMessage('4')).intent).toBe('HISTORY');
    expect((await service.classifyUserMessage('5')).intent).toBe('REQUEST_INCREASE');
  });

  it('should classify natural language queries via heuristic fallback when daemon offline', async () => {
    const resAvailable = await service.classifyUserMessage('¿Cuánto me queda para comprar hoy?');
    expect(resAvailable.intent).toBe('CHECK_AVAILABLE');

    const resApproved = await service.classifyUserMessage('¿Cuál es mi límite total aprobado?');
    expect(resApproved.intent).toBe('CHECK_APPROVED');

    const resInvoice = await service.classifyUserMessage('Quiero ver el ticket de mi última factura');
    expect(resInvoice.intent).toBe('LAST_INVOICE');

    const resIncrease = await service.classifyUserMessage('Deseo solicitar un aumento de crédito a 20000');
    expect(resIncrease.intent).toBe('REQUEST_INCREASE');
    expect(resIncrease.amount).toBe(20000);
  });
});
