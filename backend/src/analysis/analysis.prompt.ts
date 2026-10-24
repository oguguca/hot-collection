import type { HotWheel } from '@prisma/client';

// Instruções fixas: curtas, porque vão em toda chamada
export const ANALYSIS_INSTRUCTIONS = `Você avalia miniaturas Hot Wheels para colecionadores no Brasil.
Use os dados do catálogo recebidos e pesquise na web o preço ATUAL desta miniatura exata (mesmo ano e variação; um Super Treasure Hunt não é o carrinho comum).
Regras:
- Prefira anúncios e vendas no Brasil (Mercado Livre, OLX, Shopee, grupos de colecionadores); se não houver, use o exterior e informe a moeda.
- Nunca invente preço: sem dados confiáveis, use null e diga isso.
- Etiquetas como Treasure Hunt indicam menor tiragem, não garantem valor.
- Valorização é opinião com base nos sinais, não promessa nem recomendação de investimento.
Responda SOMENTE com JSON, sem texto fora dele:
{"raridade":"comum|incomum|rara|muito rara","disponibilidade":"fácil|moderada|difícil","preco":{"moeda":"BRL","minimo":0,"tipico":0,"maximo":0,"base":"anúncios|vendidos|sem dados","anunciosEncontrados":0},"valorizacao":"baixa|média|alta|incerta","motivos":["até 3 frases curtas"],"resumo":"até 2 frases"}`;

type CatalogFacts = Pick<
  HotWheel,
  'name' | 'code' | 'year' | 'line' | 'series' | 'variation' | 'bodyColor' | 'tags' | 'collectionNumber' | 'collectionTotal'
>;

// Só os fatos que ajudam a IA a achar a miniatura certa (sem ids, links ou textos longos)
export function buildFacts(hw: CatalogFacts): Record<string, unknown> {
  const number = hw.collectionNumber
    ? hw.collectionTotal
      ? `${hw.collectionNumber}/${hw.collectionTotal}`
      : hw.collectionNumber
    : null;
  const facts: Record<string, unknown> = {
    nome: hw.name,
    codigo: hw.code,
    ano: hw.year,
    linha: hw.line,
    serie: hw.series,
    variacao: hw.variation,
    cor: hw.bodyColor,
    etiquetas: hw.tags?.length ? hw.tags : null,
    numero: number,
  };
  return Object.fromEntries(Object.entries(facts).filter(([, v]) => v != null && v !== ''));
}
