import { AiError, OpenAiClient } from './openai.client';

const realFetch = global.fetch;
const env = { ...process.env };

function mockFetch(status: number, body: unknown) {
  global.fetch = jest.fn().mockResolvedValue({ ok: status >= 200 && status < 300, status, json: () => Promise.resolve(body) }) as any;
}

describe('OpenAiClient (sem chamar a OpenAI de verdade)', () => {
  beforeEach(() => {
    process.env.OPENAI_API_KEY = 'sk-test';
    delete process.env.OPENAI_MODEL;
  });
  afterEach(() => {
    global.fetch = realFetch;
    process.env = { ...env };
  });

  it('monta a chamada com busca na web obrigatória e lê texto, citações e consumo', async () => {
    mockFetch(200, {
      output: [
        { type: 'web_search_call', status: 'completed' },
        { type: 'web_search_call', status: 'completed' },
        { type: 'message', content: [{ type: 'output_text', text: '{"raridade":"rara"}', annotations: [{ type: 'url_citation', url: 'https://a.com' }] }] },
      ],
      usage: { input_tokens: 1200, output_tokens: 300 },
    });
    const out = await new OpenAiClient().searchAndAnswer('instruções', '{"nome":"X"}');

    const [url, init] = (global.fetch as jest.Mock).mock.calls[0];
    const body = JSON.parse(init.body);
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(init.headers.Authorization).toBe('Bearer sk-test');
    expect(body).toMatchObject({ model: 'gpt-5.4-mini', tool_choice: 'required', tools: [{ type: 'web_search', search_context_size: 'low' }] });
    expect(out).toEqual({ text: '{"raridade":"rara"}', annotations: [{ type: 'url_citation', url: 'https://a.com' }], searches: 2, inputTokens: 1200, outputTokens: 300 });
  });

  it('usa o modelo do .env quando definido', async () => {
    process.env.OPENAI_MODEL = 'gpt-5.4-nano';
    mockFetch(200, { output: [] });
    await new OpenAiClient().searchAndAnswer('i', 'x');
    expect(JSON.parse((global.fetch as jest.Mock).mock.calls[0][1].body).model).toBe('gpt-5.4-nano');
  });

  it.each([
    [429, { error: { code: 'insufficient_quota' } }, 'AI_UNAVAILABLE'],
    [401, { error: { code: 'invalid_api_key' } }, 'AI_UNAVAILABLE'],
    [429, { error: { code: 'rate_limit_exceeded' } }, 'AI_BUSY'],
    [500, { error: { type: 'server_error' } }, 'AI_ERROR'],
  ])('HTTP %i -> %s', async (status, body, code) => {
    mockFetch(status, body);
    await expect(new OpenAiClient().searchAndAnswer('i', 'x')).rejects.toMatchObject({ code });
  });

  it('sem chave: indisponível, sem chamar a rede', async () => {
    delete process.env.OPENAI_API_KEY;
    global.fetch = jest.fn() as any;
    await expect(new OpenAiClient().searchAndAnswer('i', 'x')).rejects.toBeInstanceOf(AiError);
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
