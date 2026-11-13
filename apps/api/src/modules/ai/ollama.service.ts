import { Injectable, Logger, Optional } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

export type ClassifiedIntent =
  | 'CHECK_APPROVED'
  | 'CHECK_AVAILABLE'
  | 'LAST_INVOICE'
  | 'HISTORY'
  | 'REQUEST_INCREASE'
  | 'TALK_TO_HUMAN'
  | 'UNKNOWN';

export interface OllamaClassificationResult {
  intent: ClassifiedIntent;
  confidence: number;
  amount: number | null;
  raw_reasoning?: string;
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly modelName: string;

  constructor(@Optional() private readonly config?: ConfigService) {
    this.baseUrl =
      process.env.OLLAMA_BASE_URL ||
      this.config?.get<string>('OLLAMA_BASE_URL', 'http://localhost:11434') ||
      'http://localhost:11434';
    this.modelName =
      process.env.OLLAMA_MODEL ||
      this.config?.get<string>('OLLAMA_MODEL', 'qwen2.5:7b') ||
      'qwen2.5:7b';
  }

  /**
   * Classifies user natural language message into a strict JSON intent using Ollama (qwen2.5:7b)
   */
  async classifyUserMessage(message: string): Promise<OllamaClassificationResult> {
    const trimmed = message.trim();

    // Fast-path for numeric inputs
    if (trimmed === '1') return { intent: 'CHECK_APPROVED', confidence: 1.0, amount: null };
    if (trimmed === '2') return { intent: 'CHECK_AVAILABLE', confidence: 1.0, amount: null };
    if (trimmed === '3') return { intent: 'LAST_INVOICE', confidence: 1.0, amount: null };
    if (trimmed === '4') return { intent: 'HISTORY', confidence: 1.0, amount: null };
    if (trimmed === '5') return { intent: 'REQUEST_INCREASE', confidence: 1.0, amount: null };

    const systemPrompt = `Eres un motor financiero de clasificación de intenciones en español para Corp-Credit POS.
Analiza el mensaje del usuario y responde EXCLUSIVAMENTE con un JSON válido con la siguiente estructura:
{
  "intent": "CHECK_APPROVED" | "CHECK_AVAILABLE" | "LAST_INVOICE" | "HISTORY" | "REQUEST_INCREASE" | "TALK_TO_HUMAN" | "UNKNOWN",
  "confidence": 0.0 a 1.0,
  "amount": null o número si solicitan aumento
}
REGLAS:
- Si pregunta por saldo restante, cuánto le queda, disponible o si puede comprar: "CHECK_AVAILABLE".
- Si pregunta por su límite total asignado, techo o monto aprobado: "CHECK_APPROVED".
- Si pregunta por su última compra, ticket o factura: "LAST_INVOICE".
- Si pregunta por compras pasadas, estado de cuenta o histórico: "HISTORY".
- Si pide aumento de crédito, más saldo o subir límite: "REQUEST_INCREASE".
- Si pide hablar con una persona, operador, soporte o asesor: "TALK_TO_HUMAN".
- NO agregues texto antes ni después del JSON. Solo el objeto JSON.`;

    try {
      const response = await fetch(`${this.baseUrl}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelName,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: trimmed },
          ],
          stream: false,
          format: 'json',
          options: {
            temperature: 0.1,
          },
        }),
      });

      if (!response.ok) {
        this.logger.warn(`Ollama HTTP ${response.status}. Aplicando clasificador heurístico local.`);
        return this.heuristicFallback(trimmed);
      }

      const json = (await response.json()) as { message?: { content?: string } };
      const content = json.message?.content || '{}';
      const parsed = JSON.parse(content) as {
        intent?: ClassifiedIntent;
        confidence?: number;
        amount?: number | null;
      };

      const validIntents: ClassifiedIntent[] = [
        'CHECK_APPROVED',
        'CHECK_AVAILABLE',
        'LAST_INVOICE',
        'HISTORY',
        'REQUEST_INCREASE',
        'TALK_TO_HUMAN',
        'UNKNOWN',
      ];

      const intent = validIntents.includes(parsed.intent as ClassifiedIntent)
        ? (parsed.intent as ClassifiedIntent)
        : 'UNKNOWN';

      return {
        intent,
        confidence: Number(parsed.confidence) || 0.85,
        amount: parsed.amount ? Number(parsed.amount) : null,
      };
    } catch {
      // Resilient fallback when Ollama is offline or local daemon isn't running
      return this.heuristicFallback(trimmed);
    }
  }

  /**
   * Deterministic rule-based fallback when AI daemon is offline
   */
  private heuristicFallback(text: string): OllamaClassificationResult {
    const lower = text.toLowerCase();

    if (
      lower.includes('disponible') ||
      lower.includes('cuanto me queda') ||
      lower.includes('cuánto me queda') ||
      lower.includes('puedo comprar') ||
      lower.includes('saldo actual')
    ) {
      return { intent: 'CHECK_AVAILABLE', confidence: 0.9, amount: null };
    }

    if (
      lower.includes('aprobado') ||
      lower.includes('limite') ||
      lower.includes('límite total') ||
      lower.includes('techo')
    ) {
      return { intent: 'CHECK_APPROVED', confidence: 0.9, amount: null };
    }

    if (
      lower.includes('ultima factura') ||
      lower.includes('última factura') ||
      lower.includes('ultimo consumo') ||
      lower.includes('último consumo') ||
      lower.includes('ticket')
    ) {
      return { intent: 'LAST_INVOICE', confidence: 0.9, amount: null };
    }

    if (
      lower.includes('historial') ||
      lower.includes('movimientos') ||
      lower.includes('estado de cuenta') ||
      lower.includes('compras')
    ) {
      return { intent: 'HISTORY', confidence: 0.9, amount: null };
    }

    if (
      lower.includes('aumento') ||
      lower.includes('subir') ||
      lower.includes('mas credito') ||
      lower.includes('más crédito') ||
      lower.includes('nuevo monto')
    ) {
      const match = lower.match(/\d+([.,]\d+)?/);
      const amount = match ? parseFloat(match[0].replace(',', '.')) : null;
      return { intent: 'REQUEST_INCREASE', confidence: 0.9, amount };
    }

    if (
      lower.includes('humano') ||
      lower.includes('persona') ||
      lower.includes('asesor') ||
      lower.includes('agente') ||
      lower.includes('ayuda')
    ) {
      return { intent: 'TALK_TO_HUMAN', confidence: 0.9, amount: null };
    }

    return { intent: 'UNKNOWN', confidence: 0.5, amount: null };
  }
}
