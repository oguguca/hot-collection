import { useCallback, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { api } from '@/services/api';
import { useAuth } from '@/contexts/auth-context';

export default function HomeScreen() {
  const { user } = useAuth();
  const [total, setTotal] = useState(0);
  const [favoritos, setFavoritos] = useState(0);
  const [loading, setLoading] = useState(true);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      api
        .get('/my-garage')
        .then((response) => {
          if (!active) return;
          const items = response.data as { favorite: boolean }[];
          setTotal(items.length);
          setFavoritos(items.filter((item) => item.favorite).length);
        })
        .catch(() => {})
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>HOT COLLECTION</Text>
        <Text style={styles.subtitle}>
          {user?.name ? `Bem-vindo, ${user.name}.` : 'Bem-vindo de volta.'}
        </Text>

        {loading ? (
          <ActivityIndicator color={colors.flame[600]} style={{ marginTop: spacing.lg }} />
        ) : (
          <View style={styles.statsRow}>
            <View style={[styles.statCard, shadow.card]}>
              <Ionicons name="car-sport" size={20} color={colors.flame[500]} />
              <Text style={styles.statNumber}>{total}</Text>
              <Text style={styles.statLabel}>na garagem</Text>
            </View>
            <View style={[styles.statCard, shadow.card]}>
              <Ionicons name="star" size={20} color={colors.flame[500]} />
              <Text style={styles.statNumber}>{favoritos}</Text>
              <Text style={styles.statLabel}>favoritos</Text>
            </View>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background[900] },
  container: { flex: 1, padding: spacing.lg },
  title: { ...typography.h1, color: colors.flame[600], marginBottom: spacing.xs },
  subtitle: { ...typography.body, color: colors.text.secondary, marginBottom: spacing.lg },
  statsRow: { flexDirection: 'row', gap: spacing.sm },
  statCard: {
    flex: 1,
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.md,
    alignItems: 'center',
    gap: 4,
  },
  statNumber: { ...typography.h2, color: colors.text.primary },
  statLabel: { ...typography.caption, color: colors.text.secondary },
});