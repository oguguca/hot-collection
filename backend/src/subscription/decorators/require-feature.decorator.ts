import { SetMetadata } from '@nestjs/common';

export const REQUIRED_FEATURE_KEY = 'required_feature';

// Marca uma rota como exigindo uma função do plano, ex: @RequireFeature('rarity_analysis')
export const RequireFeature = (feature: string) =>
  SetMetadata(REQUIRED_FEATURE_KEY, feature);