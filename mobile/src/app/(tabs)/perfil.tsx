import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { useAuth } from '@/contexts/auth-context';

export default function PerfilScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function handleLogout() {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  }

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
    marginBottom: spacing.xl,
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
  logoutButtonDisabled: {
    opacity: 0.6,
  },
  logoutText: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
});