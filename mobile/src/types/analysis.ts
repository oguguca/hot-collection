// Formato da Análise do Colecionador devolvido pelo backend (GET/POST /hot-wheels/:id/analysis)
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

export type Analysis = {
  id: string;
  createdAt: string;
  result: AnalysisResult;
  sources: AnalysisSource[];
};

export type AnalysisQuota = { limit: number; used: number; remaining: number; resetsAt: string | null };

export type AnalysisResponse = { analysis: Analysis | null; quota: AnalysisQuota };
