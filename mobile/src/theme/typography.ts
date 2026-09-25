/**
 * Hot Collection — Design System
 * Tipografia: tamanhos, pesos e famílias de fonte.
 */

export const fontFamily = {
  // Títulos — condensada, com personalidade "automotiva"
  headingBold: 'BarlowCondensed_700Bold',
  headingSemiBold: 'BarlowCondensed_600SemiBold',

  // Texto corrido — legível e neutra
  bodyRegular: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodySemiBold: 'Inter_600SemiBold',
};

export const fontSize = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 22,
  xxl: 28,
  display: 36, // usado em títulos grandes, tipo tela de splash
};

export const typography = {
  h1: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.display,
    lineHeight: 40,
  },
  h2: {
    fontFamily: fontFamily.headingBold,
    fontSize: fontSize.xxl,
    lineHeight: 34,
  },
  h3: {
    fontFamily: fontFamily.headingSemiBold,
    fontSize: fontSize.xl,
    lineHeight: 28,
  },
  body: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
  bodyMedium: {
    fontFamily: fontFamily.bodyMedium,
    fontSize: fontSize.md,
    lineHeight: 24,
  },
  caption: {
    fontFamily: fontFamily.bodyRegular,
    fontSize: fontSize.sm,
    lineHeight: 20,
  },
  label: {
    fontFamily: fontFamily.bodySemiBold,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
} as const;