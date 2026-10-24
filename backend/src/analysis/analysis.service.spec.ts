import { ConflictException, HttpException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { AnalysisService } from './analysis.service';
import { AiError, OpenAiClient } from './openai.client';

const HOT_WHEEL = {
  id: '11111111-1111-4111-8111-111111111111',
  name: 'Ford Escort RS2000',
  code: 'HTF30',
  year: 2024,
  line: 'Mainline',
  series: 'Factory Fresh',
  variation: 'Super Treasure Hunt',
  bodyColor: 'Spectraflame Green',
  tags: ['Super Treasure Hunt'],
  collectionNumber: '023',
  collectionTotal: 250,
};

const GOOD_REPLY = {
  text: JSON.stringify({
    raridade: 'muito rara',
    disponibilidade: 'difícil',
    preco: { moeda: 'BRL', minimo: 180, tipico: 260, maximo: 450, base: 'anúncios', anunciosEncontrados: 7 },
    valorizacao: 'alta',
    motivos: ['Super Treasure Hunt'],
    resumo: 'Difícil de achar.',
  }),
  annotations: [{ type: 'url_citation', url: 'https://lista.mercadolivre.com.br/x', title: 'ML' }],
  searches: 2,
  inputTokens: 3000,
  outputTokens: 400,
};

// Banco simulado em memória, só com o que o serviço usa
function setup({ counted = 0, pending = false, hotWheel = HOT_WHEEL as any } = {}) {
  const rows: any[] = [];
  const prisma = {
    hotWheel: { findUnique: jest.fn().mockResolvedValue(hotWheel) },
    aiAnalysis: {
      findMany: jest.fn().mockImplementation(() =>
        Promise.resolve(Array.from({ length: counted }, (_, i) => ({ createdAt: new Date(Date.now() - (i + 1) * 60_000) }))),
      ),
      findFirst: jest.fn().mockImplementation(({ where }) =>
        Promise.resolve(where.status === 'pending' && pending ? { id: 'p' } : rows.filter((r) => r.status === 'ok').at(-1) ?? null),
      ),
      create: jest.fn().mockImplementation(({ data }) => {
        const row = { id: `a${rows.length}`, createdAt: new Date(), result: null, sources: null, ...data };
        rows.push(row);
        return Promise.resolve(row);
      }),
      update: jest.fn().mockImplementation(({ where, data }) => {
        const row = rows.find((r) => r.id === where.id);
        Object.assign(row, data);
        return Promise.resolve(row);
      }),
    },
  };
  const ask = jest.fn();
  const openai = { model: 'gpt-5.4-mini', searchAndAnswer: ask } as unknown as OpenAiClient;
  const service = new AnalysisService(prisma as any, openai);
  return { service, prisma, ask, rows };
}

describe('AnalysisService', () => {
  const original = process.env.AI_ANALYSIS_DAILY_LIMIT;
  afterEach(() => {
    process.env.AI_ANALYSIS_DAILY_LIMIT = original;
  });

  it('analisa, guarda o resultado e as fontes e devolve a cota atualizada', async () => {
    const { service, ask, rows } = setup();
    ask.mockResolvedValue(GOOD_REPLY);
    const out = await service.analyze('user-1', HOT_WHEEL.id);

    // A IA recebe só os fatos do catálogo
    const input = JSON.parse(ask.mock.calls[0][1]);
    expect(input).toMatchObject({ codigo: 'HTF30', variacao: 'Super Treasure Hunt', numero: '023/250' });

    expect(rows[0]).toMatchObject({ status: 'ok', searches: 2, inputTokens: 3000, outputTokens: 400 });
    expect(out.analysis.result).toMatchObject({ raridade: 'muito rara' });
    expect(out.analysis.sources).toEqual([{ title: 'ML', url: 'https://lista.mercadolivre.com.br/x' }]);
    expect(out.analysis).not.toHaveProperty('inputTokens');
  });

  it('bloqueia quando acabou o limite das últimas 24 horas, sem chamar a IA', async () => {
    process.env.AI_ANALYSIS_DAILY_LIMIT = '5';
    const { service, ask } = setup({ counted: 5 });
    await expect(service.analyze('user-1', HOT_WHEEL.id)).rejects.toMatchObject({ status: 429 });
    expect(ask).not.toHaveBeenCalled();
  });

  it('informa quando a vaga volta', async () => {
    process.env.AI_ANALYSIS_DAILY_LIMIT = '2';
    const { service } = setup({ counted: 2 });
    const quota = await service.quota('user-1');
    expect(quota).toMatchObject({ limit: 2, used: 2, remaining: 0 });
    expect(quota.resetsAt).not.toBeNull();
  });

  it('não deixa duas análises ao mesmo tempo para o mesmo usuário', async () => {
    const { service, ask } = setup({ pending: true });
    await expect(service.analyze('user-1', HOT_WHEEL.id)).rejects.toBeInstanceOf(ConflictException);
    expect(ask).not.toHaveBeenCalled();
  });

  it('sem saldo ou sem chave: mensagem amigável e o erro não conta no limite', async () => {
    const { service, ask, rows } = setup();
    ask.mockRejectedValue(new AiError('AI_UNAVAILABLE', 'insufficient_quota'));
    const error = await service.analyze('user-1', HOT_WHEEL.id).catch((e) => e);
    expect(error).toBeInstanceOf(ServiceUnavailableException);
    expect(error.getResponse()).toMatchObject({ code: 'AI_UNAVAILABLE', message: expect.stringContaining('indisponível') });
    // Detalhe técnico fica só no registro interno
    expect(rows[0]).toMatchObject({ status: 'error', error: expect.stringContaining('insufficient_quota') });
  });

  it('resposta fora do formato vira erro (não mostra lixo para o usuário)', async () => {
    const { service, ask, rows } = setup();
    ask.mockResolvedValue({ ...GOOD_REPLY, text: 'Desculpe, não sei.' });
    const error = await service.analyze('user-1', HOT_WHEEL.id).catch((e) => e);
    expect(error.getResponse()).toMatchObject({ code: 'AI_INVALID' });
    expect(rows[0]).toMatchObject({ status: 'error', error: 'AI_INVALID', searches: 2 });
  });

  it('carrinho inexistente: 404 sem chamar a IA', async () => {
    const { service, ask } = setup({ hotWheel: null });
    await expect(service.analyze('user-1', HOT_WHEEL.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(ask).not.toHaveBeenCalled();
  });

  it('a última análise não chama a IA', async () => {
    const { service, ask } = setup();
    const out = await service.latest('user-1', HOT_WHEEL.id);
    expect(out.analysis).toBeNull();
    expect(out.quota.remaining).toBe(5);
    expect(ask).not.toHaveBeenCalled();
  });

  it('erro 429 do limite é HttpException', async () => {
    process.env.AI_ANALYSIS_DAILY_LIMIT = '1';
    const { service } = setup({ counted: 1 });
    await expect(service.analyze('user-1', HOT_WHEEL.id)).rejects.toBeInstanceOf(HttpException);
  });
});
