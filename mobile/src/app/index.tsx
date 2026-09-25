import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';

export default function HomeScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.h1}>HOT COLLECTION</Text>
        <Text style={styles.h2}>Design System — teste visual</Text>

        <View style={[styles.card, shadow.card]}>
          <Text style={styles.h3}>Sua garagem</Text>
          <Text style={styles.body}>
            Esta é uma prévia das cores, fontes e espaçamentos definidos para o app.
          </Text>
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: colors.flame[600] }]}>
            <Text style={styles.badgeText}>RARO</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.chrome[500] }]}>
            <Text style={styles.badgeText}>NOVO</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: colors.feedback.success }]}>
            <Text style={styles.badgeText}>OK</Text>
          </View>
        </View>

        <Text style={styles.caption}>Fonte de título: Barlow Condensed</Text>
        <Text style={styles.bodyMedium}>Fonte de corpo: Inter Medium</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background[900],
  },
  container: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  h1: {
    ...typography.h1,
    color: colors.flame[600],
  },
  h2: {
    ...typography.h3,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  h3: {
    ...typography.h3,
    color: colors.text.primary,
    marginBottom: spacing.sm,
  },
  body: {
    ...typography.body,
    color: colors.text.secondary,
  },
  bodyMedium: {
    ...typography.bodyMedium,
    color: colors.text.primary,
  },
  caption: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  card: {
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.background[500],
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  badge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.pill,
  },
  badgeText: {
    ...typography.label,
    color: colors.text.primary,
  },
});