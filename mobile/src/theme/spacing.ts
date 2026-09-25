/**
 * Hot Collection — Design System
 * Espaçamento, bordas e sombras.
 */

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const borderRadius = {
  sm: 6,
  md: 12,
  lg: 20,
  pill: 999, // para badges/tags totalmente arredondados
};

export const shadow = {
  // sombra sutil, para cards no fundo escuro
  card: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6, // equivalente no Android
  },
  // sombra mais forte, para elementos "flutuantes" (ex: botão de adicionar)
  elevated: {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 16,
    elevation: 12,
  },
} as const;