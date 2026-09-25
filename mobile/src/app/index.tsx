import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import { mockGarage } from '@/data/mock-hotwheels';

export default function HomeScreen() {
  const total = mockGarage.length;
  const favoritos = mockGarage.filter((item) => item.favorite).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        <Text style={styles.title}>HOT COLLECTION</Text>
        <Text style={styles.subtitle}>Bem-vindo de volta.</Text>

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