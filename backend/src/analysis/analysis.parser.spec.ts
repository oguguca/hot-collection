import { extractSources, parseAnalysis } from './analysis.parser';
import { buildFacts } from './analysis.prompt';

describe('parseAnalysis', () => {
  const valid = {
    raridade: 'muito rara',
    disponibilidade: 'difícil',
    preco: { moeda: 'BRL', minimo: 180, tipico: 260, maximo: 450, base: 'anúncios', anunciosEncontrados: 7 },
    valorizacao: 'alta',
    motivos: ['Super Treasure Hunt', 'Poucos anúncios', 'Molde popular'],
    resumo: 'Difícil de achar.',
  };

  it('aceita a resposta no formato combinado', () => {
    expect(parseAnalysis(JSON.stringify(valid))).toEqual(valid);
  });

  it('tira o JSON de dentro de ```json ... ```', () => {
    expect(parseAnalysis('```json\n' + JSON.stringify(valid) + '\n```')?.raridade).toBe('muito rara');
  });

  it('valores fora da lista viram null', () => {
    const r = parseAnalysis(JSON.stringify({ ...valid, raridade: 'lendária', valorizacao: 'garantida' }));
    expect(r?.raridade).toBeNull();
    expect(r?.valorizacao).toBeNull();
  });

  it('sem preço confiável: base "sem dados" e moeda nula', () => {
    const r = parseAnalysis(JSON.stringify({ ...valid, preco: { moeda: 'BRL', minimo: null, tipico: 0, maximo: null, base: 'anúncios' } }));
    expect(r?.preco).toEqual({ moeda: null, minimo: null, tipico: null, maximo: null, base: 'sem dados', anunciosEncontrados: null });
  });

  it('descarta faixa de preço incoerente (mínimo acima do máximo)', () => {
    const r = parseAnalysis(JSON.stringify({ ...valid, preco: { ...valid.preco, minimo: 500, maximo: 100 } }));
    expect(r?.preco.base).toBe('sem dados');
  });

  it('limita motivos a 3 e corta textos longos', () => {
    const r = parseAnalysis(JSON.stringify({ ...valid, motivos: ['a', 'b', 'c', 'd'], resumo: 'x'.repeat(1000) }));
    expect(r?.motivos).toEqual(['a', 'b', 'c']);
    expect(r?.resumo?.length).toBe(400);
  });

  it('texto sem JSON ou sem nenhum campo útil não serve', () => {
    expect(parseAnalysis('Não consegui pesquisar.')).toBeNull();
    expect(parseAnalysis('{"motivos":[]}')).toBeNull();
  });
});

describe('extractSources', () => {
  it('usa só citações url_citation http(s), sem repetir e sem o rastreio da busca', () => {
    const sources = extractSources([
      { type: 'url_citation', url: 'https://lista.mercadolivre.com.br/escort-sth?utm_source=openai', title: 'ML' },
      { type: 'url_citation', url: 'https://lista.mercadolivre.com.br/escort-sth', title: 'ML de novo' },
      { type: 'url_citation', url: 'javascript:alert(1)', title: 'x' },
      { type: 'file_citation', url: 'https://x.com', title: 'y' },
    ]);
    expect(sources).toEqual([{ title: 'ML', url: 'https://lista.mercadolivre.com.br/escort-sth' }]);
  });

  it('sem citações: lista vazia', () => {
    expect(extractSources(undefined)).toEqual([]);
  });
});

describe('buildFacts', () => {
  it('envia só o necessário, sem campos vazios', () => {
    expect(
      buildFacts({
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
      }),
    ).toEqual({
      nome: 'Ford Escort RS2000',
      codigo: 'HTF30',
      ano: 2024,
      linha: 'Mainline',
      serie: 'Factory Fresh',
      variacao: 'Super Treasure Hunt',
      cor: 'Spectraflame Green',
      etiquetas: ['Super Treasure Hunt'],
      numero: '023/250',
    });
    expect(
      buildFacts({ name: 'X', code: 'A1', year: null, line: null, series: null, variation: null, bodyColor: null, tags: [], collectionNumber: null, collectionTotal: null }),
    ).toEqual({ nome: 'X', codigo: 'A1' });
  });
});
