/**
 * Hot Collection — Design System
 * Paleta de cores oficial do app.
 *
 * Conceito: garagem à noite (preto/grafite) + chama automotiva (vermelho-laranja)
 * + acabamento metálico (chrome).
 */

export const colors = {
  // Base — fundo e superfícies (grafite/preto)
  background: {
    900: '#0A0A0B', // fundo principal do app
    800: '#151517', // fundo de seções
    700: '#1F1F22', // cards
    600: '#2C2C30', // cards elevados / hover
    500: '#3D3D42', // bordas sutis, divisores
  },

  // Destaque — chama (ações, botões, badges)
  flame: {
    300: '#FFB84D',
    500: '#FF7A3D',
    600: '#F03A26', // cor principal de destaque
    700: '#B8241A',
  },

  // Metálico — bordas, ícones secundários, acabamento "chrome"
  chrome: {
    100: '#E8E9EB',
    300: '#C7CBD1',
    500: '#8A8D93',
    700: '#55585E',
  },

  // Texto
  text: {
    primary: '#F5F5F7',
    secondary: '#A6A7AC',
    disabled: '#5C5C5F',
  },

  // Feedback / estados
  feedback: {
    success: '#3DBE6D',
    warning: '#F0B429',
    danger: '#F03A26', // reaproveita o flame-600
  },
} as const;