import { Injectable, Logger } from '@nestjs/common';

// Erros que o app sabe mostrar. Detalhes (saldo, chave) ficam só no log do servidor.
export type AiErrorCode = 'AI_UNAVAILABLE' | 'AI_BUSY' | 'AI_TIMEOUT' | 'AI_ERROR';

export class AiError extends Error {
  constructor(
    readonly code: AiErrorCode,
    readonly detail: string,
  ) {
    super(code);
  }
}

export type WebSearchResponse = {
  text: string;
  annotations: unknown[];
  searches: number;
  inputTokens: number | null;
  outputTokens: number | null;
};

const TIMEOUT_MS = 90_000;

// Chamada à OpenAI (Responses API + busca na web) com fetch nativo, sem SDK
@Injectable()
export class OpenAiClient {
  private readonly logger = new Logger(OpenAiClient.name);

  get model(): string {
    return process.env.OPENAI_MODEL || 'gpt-5.4-mini';
  }

  async searchAndAnswer(instructions: string, input: string): Promise<WebSearchResponse> {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new AiError('AI_UNAVAILABLE', 'OPENAI_API_KEY não configurada');

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({
          model: this.model,
          instructions,
          input,
          tools: [{ type: 'web_search', search_context_size: 'low', user_location: { type: 'approximate', country: 'BR' } }],
          tool_choice: 'required',
          include: ['web_search_call.action.sources'],
          reasoning: { effort: 'low' },
          max_output_tokens: 2500,
        }),
        signal: controller.signal,
      });
    } catch (error) {
      if ((error as Error).name === 'AbortError') throw new AiError('AI_TIMEOUT', `sem resposta em ${TIMEOUT_MS / 1000}s`);
      throw new AiError('AI_ERROR', `falha de rede: ${(error as Error).message}`);
    } finally {
      clearTimeout(timer);
    }

    const body = (await response.json().catch(() => ({}))) as Record<string, any>;
    if (!response.ok) {
      const code: string = body?.error?.code ?? body?.error?.type ?? `http_${response.status}`;
      this.logger.warn(`OpenAI recusou a análise (HTTP ${response.status}, ${code})`);
      if (code === 'insufficient_quota' || response.status === 401 || response.status === 403) {
        throw new AiError('AI_UNAVAILABLE', code);
      }
      if (response.status === 429) throw new AiError('AI_BUSY', code);
      throw new AiError('AI_ERROR', code);
    }

    const output: any[] = Array.isArray(body.output) ? body.output : [];
    const message = output.find((o) => o?.type === 'message');
    const part = message?.content?.find((c: any) => c?.type === 'output_text');
    return {
      text: typeof part?.text === 'string' ? part.text : '',
      annotations: Array.isArray(part?.annotations) ? part.annotations : [],
      searches: output.filter((o) => o?.type === 'web_search_call').length,
      inputTokens: body.usage?.input_tokens ?? null,
      outputTokens: body.usage?.output_tokens ?? null,
    };
  }
}
