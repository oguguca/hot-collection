import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { api } from '@/services/api';

export type PlanInfo = {
  plan: string;
  planName: string;
  isPremium: boolean;
  features: string[];
  expiresAt: string | null;
};

export function useSubscription() {
  const [info, setInfo] = useState<PlanInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const response = await api.get<PlanInfo>('/subscription/me');
      setInfo(response.data);
    } catch {
      // mantém o último valor conhecido
    } finally {
      setLoading(false);
    }
  }, []);

  // Recarrega toda vez que a tela ganha foco
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { info, loading, reload, setInfo };
}