import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { useAuth } from '@/contexts/auth-context';
import { useSubscription } from '@/hooks/use-subscription';
import { api } from '@/services/api';

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const { info, loading, setInfo } = useSubscription();
  const [loggingOut, setLoggingOut] = useState(false);
  const [switching, setSwitching] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

  // Só para testes: alterna entre gratuito e premium (some em produção)
  async function handleDevSwitch() {
    if (!info) return;
    setSwitching(true);
    try {
      const response = await api.post('/subscription/dev-activate', {
        planCode: info.isPremium ? 'free' : 'premium',
      });
      setInfo(response.data);
    } catch {
      // se o backend recusar (flag desligada), nada muda
    } finally {
      setSwitching(false);
    }
  }

  const isPremium = info?.isPremium ?? false;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>Perfil</Text>

        <View style={[styles.card, shadow.card]}>
          <View style={styles.avatar}>
            <Ionicons name="person" size={32} color={colors.chrome[500]} />
          </View>
          <View style={styles.info}>
            <Text style={styles.name}>{user?.name ?? 'Usuário'}</Text>
            <Text style={styles.email}>{user?.email}</Text>
          </View>
        </View>

        <View style={[styles.card, styles.planCard, shadow.card]}>
          <View style={styles.planHeader}>
            <Text style={styles.planLabel}>Seu plano</Text>
            {loading ? (
              <ActivityIndicator color={colors.flame[600]} />
            ) : (
              <View style={[styles.badge, isPremium && styles.badgePremium]}>
                <Text style={styles.badgeText}>{info?.planName ?? '—'}</Text>
              </View>
            )}
          </View>

          <View style={styles.featureRow}>
            <Ionicons
              name={isPremium ? 'sparkles' : 'lock-closed'}
              size={20}
              color={isPremium ? colors.flame[500] : colors.chrome[500]}
            />
            <View style={styles.featureInfo}>
              <Text style={styles.featureTitle}>Análise do Colecionador</Text>
              <Text style={styles.featureText}>
                {isPremium
                  ? 'Incluída no seu plano. Em breve disponível.'
                  : 'Disponível no plano Premium.'}
              </Text>
            </View>
          </View>

          {__DEV__ && (
            <Pressable style={styles.devButton} onPress={handleDevSwitch} disabled={switching}>
              {switching ? (
                <ActivityIndicator color={colors.text.primary} />
              ) : (
                <Text style={styles.devButtonText}>
                  {isPremium ? 'Voltar para Gratuito (teste)' : 'Ativar Premium (teste)'}
                </Text>
              )}
            </Pressable>
          )}
        </View>

        <Pressable
          style={[styles.logoutButton, loggingOut && styles.logoutButtonDisabled]}
          onPress={handleLogout}
          disabled={loggingOut}>
          {loggingOut ? (
            <ActivityIndicator color={colors.text.primary} />
          ) : (
            <>
              <Ionicons name="log-out-outline" size={18} color={colors.text.primary} />
              <Text style={styles.logoutText}>Sair da conta</Text>
            </>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  container: { flex: 1, padding: spacing.lg },
  title: { ...typography.h2, color: colors.text.primary, marginBottom: spacing.lg },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: borderRadius.pill,
    backgroundColor: colors.background[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: { flex: 1, gap: 2 },
  name: { ...typography.bodyMedium, color: colors.text.primary },
  email: { ...typography.caption, color: colors.text.secondary },
  planCard: {
    flexDirection: 'column',
    alignItems: 'stretch',
    marginBottom: spacing.xl,
  },
  planHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  planLabel: { ...typography.caption, color: colors.text.secondary },
  badge: {
    backgroundColor: colors.background[600],
    paddingHorizontal: spacing.md,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  badgePremium: { backgroundColor: colors.flame[600] },
  badgeText: { ...typography.label, color: colors.text.primary },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  featureInfo: { flex: 1, gap: 2 },
  featureTitle: { ...typography.bodyMedium, color: colors.text.primary },
  featureText: { ...typography.caption, color: colors.text.secondary },
  devButton: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.chrome[700],
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  devButtonText: { ...typography.caption, color: colors.chrome[300] },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    backgroundColor: colors.background[700],
    borderWidth: 1,
    borderColor: colors.feedback.danger,
    borderRadius: borderRadius.md,
    paddingVertical: spacing.sm,
  },
  logoutButtonDisabled: { opacity: 0.6 },
  logoutText: { ...typography.bodyMedium, color: colors.text.primary },
});