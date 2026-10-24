export type HotWheel = {
  id: string;
  code: string;
  name: string;
  year: number | null;
  line: string | null;
  series: string | null;
  theme: string | null;
  bodyColor: string | null;
  collectionNumber: string | null;
  // Nulo quando a fonte não confirma o total. Opcional enquanto a API não tiver a coluna.
  collectionTotal?: number | null;
  seriesNumber: string | null;
  variation: string | null;
  // Etiquetas do catálogo: "Treasure Hunt", "Super Treasure Hunt", "First Edition", "New Model", "Mystery Model"
  tags?: string[];
};