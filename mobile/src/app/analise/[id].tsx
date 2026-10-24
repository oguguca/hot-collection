import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { isAxiosError } from 'axios';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { api } from '@/services/api';
import { HotWheelCard } from '@/components/hot-wheel-card';
import { ExternalLink } from '@/components/external-link';
import { useSubscription } from '@/hooks/use-subscription';
import type { HotWheel } from '@/types/hot-wheel';
import type { Analysis, AnalysisQuota, AnalysisResponse, AnalysisResult } from '@/types/analysis';

// A pesquisa na web pode levar dezenas de segundos
const ANALYZE_TIMEOUT_MS = 100_000;

type Tone = 'hot' | 'warm' | 'good' | 'neutral';
const TONE: Record<string, Tone> = {
  'muito rara': 'hot',
  rara: 'warm',
  incomum: 'neutral',
  comum: 'neutral',
  difícil: 'hot',
  moderada: 'warm',
  fácil: 'good',
  alta: 'good',
  média: 'warm',
  baixa: 'neutral',
  incerta: 'neutral',
};

function formatMoney(value: number | null, currency: string | null) {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: currency ?? 'BRL', maximumFractionDigits: 0 }).format(value);
  } catch {
    return `${currency ?? ''} ${Math.round(value)}`.trim();
  }
}

function formatWhen(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const domainOf = (url: string) => url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

// Mensagem do backend (limite diário, IA indisponível...) ou uma genérica
function errorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (error.code === 'ECONNABORTED') return 'A pesquisa demorou demais. Tente de novo.';
    const data = error.response?.data as { message?: string | { message?: string }; code?: string; quota?: AnalysisQuota } | undefined;
    const message = typeof data?.message === 'string' ? data.message : data?.message?.message;
    if (data?.code === 'DAILY_LIMIT' && data.quota?.resetsAt) {
      return `${message} Uma nova análise libera às ${formatWhen(data.quota.resetsAt).split(' às ')[1]}.`;
    }
    if (message) return message;
  }
  return 'Não foi possível concluir a análise. Tente de novo.';
}

function Indicator({ label, value }: { label: string; value: string | null }) {
  const tone = value ? TONE[value] ?? 'neutral' : 'neutral';
  return (
    <View style={styles.indicator}>
      <Text style={styles.indicatorLabel}>{label}</Text>
      <View style={[styles.pill, styles[`pill_${tone}`]]}>
        <Text style={[styles.pillText, styles[`pillText_${tone}`]]}>{value ?? 'indefinida'}</Text>
      </View>
    </View>
  );
}

function ResultCard({ analysis }: { analysis: Analysis }) {
  const r: AnalysisResult = analysis.result;
  const hasPrice = r.preco.base !== 'sem dados';
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.indicators}>
        <Indicator label="Raridade" value={r.raridade} />
        <Indicator label="Para achar" value={r.disponibilidade} />
        <Indicator label="Valorização" value={r.valorizacao} />
      </View>

      <View style={styles.priceBox}>
        <Text style={styles.sectionLabel}>Preço agora</Text>
        {hasPrice ? (
          <>
            <Text style={styles.price}>{formatMoney(r.preco.tipico ?? r.preco.minimo, r.preco.moeda)}</Text>
            {r.preco.minimo != null && r.preco.maximo != null && (
              <Text style={styles.muted}>
                de {formatMoney(r.preco.minimo, r.preco.moeda)} a {formatMoney(r.preco.maximo, r.preco.moeda)}
              </Text>
            )}
            <Text style={styles.muted}>
              Base: {r.preco.base}
              {r.preco.anunciosEncontrados != null ? ` · ${r.preco.anunciosEncontrados} encontrados` : ''}
            </Text>
          </>
        ) : (
          <Text style={styles.muted}>Nenhum preço confiável encontrado agora.</Text>
        )}
      </View>

      {r.resumo && <Text style={styles.summary}>{r.resumo}</Text>}

      {r.motivos.length > 0 && (
        <View style={styles.reasons}>
          {r.motivos.map((m) => (
            <View key={m} style={styles.reasonRow}>
              <Ionicons name="checkmark-circle" size={16} color={colors.flame[500]} />
              <Text style={styles.reasonText}>{m}</Text>
            </View>
          ))}
        </View>
      )}

      {analysis.sources.length > 0 && (
        <View style={styles.sources}>
          <Text style={styles.sectionLabel}>Fontes</Text>
          {analysis.sources.map((s) => (
            <ExternalLink key={s.url} href={s.url as `${string}:${string}`} style={styles.sourceLink}>
              {s.title ?? domainOf(s.url)} <Text style={styles.sourceDomain}>· {domainOf(s.url)}</Text>
            </ExternalLink>
          ))}
        </View>
      )}

      <Text style={styles.when}>Analisado em {formatWhen(analysis.createdAt)}</Text>
    </View>
  );
}

export default function AnaliseScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { info, loading: planLoading } = useSubscription();
  const isPremium = info?.isPremium ?? false;

  const [hotWheel, setHotWheel] = useState<HotWheel | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [quota, setQuota] = useState<AnalysisQuota | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState('');

  // Carrinho e última análise (não gasta análise)
  const load = useCallback(async () => {
    try {
      const car = await api.get<HotWheel>(`/hot-wheels/${id}`);
      setHotWheel(car.data);
      if (isPremium) {
        const last = await api.get<AnalysisResponse>(`/hot-wheels/${id}/analysis`);
        setAnalysis(last.data.analysis);
        setQuota(last.data.quota);
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [id, isPremium]);

  useEffect(() => {
    if (!planLoading) load();
  }, [planLoading, load]);

  async function handleAnalyze() {
    setAnalyzing(true);
    setError('');
    try {
      const response = await api.post<AnalysisResponse>(`/hot-wheels/${id}/analysis`, null, { timeout: ANALYZE_TIMEOUT_MS });
      setAnalysis(response.data.analysis);
      setQuota(response.data.quota);
    } catch (e) {
      setError(errorMessage(e));
      if (isAxiosError(e) && (e.response?.data as { quota?: AnalysisQuota })?.quota) {
        setQuota((e.response?.data as { quota: AnalysisQuota }).quota);
      }
    } finally {
      setAnalyzing(false);
    }
  }

  const noneLeft = quota != null && quota.remaining <= 0;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Pressable style={styles.back} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="chevron-back" size={20} color={colors.text.secondary} />
          <Text style={styles.backText}>Voltar</Text>
        </Pressable>

        <Text style={styles.title}>Análise do Colecionador</Text>

        {loading || planLoading ? (
          <ActivityIndicator color={colors.flame[600]} size="large" style={styles.loader} />
        ) : (
          <>
            {hotWheel && <HotWheelCard hotWheel={hotWheel} />}

            {!isPremium ? (
              <View style={[styles.card, styles.lockedCard]}>
                <Ionicons name="lock-closed" size={28} color={colors.chrome[300]} />
                <Text style={styles.lockedTitle}>Recurso do plano Premium</Text>
                <Text style={styles.muted}>
                  Veja a raridade, se está fácil ou difícil de achar, o preço atual nos anúncios e o potencial de
                  valorização de cada miniatura.
                </Text>
              </View>
            ) : (
              <>
                <Pressable
                  style={[styles.button, (analyzing || noneLeft) && styles.buttonDisabled]}
                  onPress={handleAnalyze}
                  disabled={analyzing || noneLeft}>
                  {analyzing ? (
                    <ActivityIndicator color={colors.text.primary} />
                  ) : (
                    <>
                      <Ionicons name="sparkles" size={18} color={colors.text.primary} />
                      <Text style={styles.buttonText}>{analysis ? 'Analisar de novo' : 'Analisar agora'}</Text>
                    </>
                  )}
                </Pressable>
                <Text style={styles.hint}>
                  {analyzing
                    ? 'Pesquisando anúncios e preços… pode levar até 1 minuto.'
                    : quota
                      ? `Pesquisa o preço atual na internet · ${quota.remaining} de ${quota.limit} análises restantes nas últimas 24h`
                      : 'Pesquisa o preço atual na internet.'}
                </Text>

                {error ? <Text style={styles.error}>{error}</Text> : null}

                {analysis && !analyzing && <ResultCard analysis={analysis} />}

                <Text style={styles.disclaimer}>
                  Preços vêm de anúncios encontrados na internet no momento da análise e podem variar. Raridade e
                  valorização são opiniões baseadas nos dados disponíveis, não garantia de valor nem recomendação de
                  compra ou investimento.
                </Text>
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  container: { padding: spacing.lg, gap: spacing.md },
  back: { flexDirection: 'row', alignItems: 'center', gap: 2, alignSelf: 'flex-start' },
  backText: { ...typography.caption, color: colors.text.secondary },
  title: { ...typography.h2, color: colors.text.primary },
  loader: { marginTop: spacing.xl },
  card: {
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.md,
    gap: spacing.md,
  },
  lockedCard: { alignItems: 'center', gap: spacing.sm },
  lockedTitle: { ...typography.bodyMedium, color: colors.text.primary },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.flame[600],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.md,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { ...typography.bodyMedium, color: colors.text.primary },
  hint: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  error: { ...typography.caption, color: colors.feedback.danger, textAlign: 'center' },
  indicators: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  indicator: { flex: 1, alignItems: 'center', gap: spacing.xs },
  indicatorLabel: { ...typography.label, color: colors.text.secondary },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: borderRadius.pill },
  pill_hot: { backgroundColor: colors.flame[600] },
  pill_warm: { backgroundColor: colors.feedback.warning },
  pill_good: { backgroundColor: colors.feedback.success },
  pill_neutral: { backgroundColor: colors.background[600] },
  pillText: { ...typography.label },
  pillText_hot: { color: colors.text.primary },
  pillText_warm: { color: colors.background[900] },
  pillText_good: { color: colors.background[900] },
  pillText_neutral: { color: colors.text.secondary },
  priceBox: { alignItems: 'center', gap: 2 },
  sectionLabel: { ...typography.label, color: colors.text.secondary, textTransform: 'uppercase' },
  price: { ...typography.h1, color: colors.text.primary },
  muted: { ...typography.caption, color: colors.text.secondary, textAlign: 'center' },
  summary: { ...typography.body, color: colors.text.primary },
  reasons: { gap: spacing.xs },
  reasonRow: { flexDirection: 'row', gap: spacing.xs, alignItems: 'flex-start' },
  reasonText: { ...typography.caption, color: colors.text.secondary, flex: 1 },
  sources: { gap: spacing.xs },
  sourceLink: { ...typography.caption, color: colors.flame[500] },
  sourceDomain: { color: colors.text.disabled },
  when: { ...typography.label, color: colors.text.disabled, textAlign: 'right' },
  disclaimer: { ...typography.label, color: colors.text.disabled, textAlign: 'center', marginTop: spacing.sm },
});
