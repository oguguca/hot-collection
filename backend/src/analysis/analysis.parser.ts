// Valida a resposta da IA: só passa o que está no formato combinado. Qualquer valor fora da lista vira null.

export type AnalysisResult = {
  raridade: 'comum' | 'incomum' | 'rara' | 'muito rara' | null;
  disponibilidade: 'fácil' | 'moderada' | 'difícil' | null;
  preco: {
    moeda: string | null;
    minimo: number | null;
    tipico: number | null;
    maximo: number | null;
    base: 'anúncios' | 'vendidos' | 'sem dados';
    anunciosEncontrados: number | null;
  };
  valorizacao: 'baixa' | 'média' | 'alta' | 'incerta' | null;
  motivos: string[];
  resumo: string | null;
};

export type AnalysisSource = { title: string | null; url: string };

const pick = <T extends string>(value: unknown, allowed: readonly T[]): T | null =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value.trim().toLowerCase())
    ? (value.trim().toLowerCase() as T)
    : null;

const price = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.round(value * 100) / 100 : null;

const text = (value: unknown, max: number): string | null =>
  typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : null;

// Extrai o JSON do texto (o modelo às vezes coloca ```json ... ``` em volta)
export function parseAnalysis(raw: string): AnalysisResult | null {
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!data || typeof data !== 'object') return null;

  const p = (data.preco ?? {}) as Record<string, unknown>;
  let minimo = price(p.minimo);
  let tipico = price(p.tipico);
  let maximo = price(p.maximo);
  // Faixa incoerente (mínimo acima do máximo): descarta em vez de mostrar errado
  if (minimo != null && maximo != null && minimo > maximo) minimo = tipico = maximo = null;
  const hasPrice = [minimo, tipico, maximo].some((v) => v != null);
  const moeda = typeof p.moeda === 'string' && /^[A-Z]{3}$/.test(p.moeda.trim().toUpperCase()) ? p.moeda.trim().toUpperCase() : null;
  const listings = typeof p.anunciosEncontrados === 'number' && p.anunciosEncontrados >= 0 ? Math.floor(p.anunciosEncontrados) : null;

  const result: AnalysisResult = {
    raridade: pick(data.raridade, ['comum', 'incomum', 'rara', 'muito rara'] as const),
    disponibilidade: pick(data.disponibilidade, ['fácil', 'moderada', 'difícil'] as const),
    preco: {
      moeda: hasPrice ? moeda : null,
      minimo,
      tipico,
      maximo,
      base: hasPrice ? (pick(p.base, ['anúncios', 'vendidos'] as const) ?? 'anúncios') : 'sem dados',
      anunciosEncontrados: listings,
    },
    valorizacao: pick(data.valorizacao, ['baixa', 'média', 'alta', 'incerta'] as const),
    motivos: Array.isArray(data.motivos)
      ? data.motivos.map((m) => text(m, 200)).filter((m): m is string => Boolean(m)).slice(0, 3)
      : [],
    resumo: text(data.resumo, 400),
  };

  // Sem nenhum campo útil, a resposta não serve
  if (!result.raridade && !result.disponibilidade && !hasPrice && !result.resumo) return null;
  return result;
}

// Links vêm das citações da própria API (não do texto do modelo), sem repetir e só http(s)
export function extractSources(annotations: unknown[] | undefined, max = 8): AnalysisSource[] {
  const seen = new Map<string, AnalysisSource>();
  for (const a of annotations ?? []) {
    const ann = a as { type?: string; url?: string; title?: string };
    if (ann?.type !== 'url_citation' || typeof ann.url !== 'string' || !/^https?:\/\//i.test(ann.url)) continue;
    // Remove o rastreio que a busca acrescenta (?utm_source=openai)
    const url = ann.url.replace(/([?&])utm_source=openai(&|$)/, (_, p1: string, p2: string) => (p2 ? p1 : '')).replace(/[?&]$/, '');
    if (!seen.has(url)) seen.set(url, { title: typeof ann.title === 'string' ? ann.title.slice(0, 160) : null, url });
  }
  return [...seen.values()].slice(0, max);
}
