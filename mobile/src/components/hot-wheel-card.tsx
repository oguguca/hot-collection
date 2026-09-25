import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import type { HotWheelItem } from '@/data/mock-hotwheels';

export function HotWheelCard({ item }: { item: HotWheelItem }) {
  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.imagePlaceholder}>
        <Ionicons name="car-sport" size={32} color={colors.chrome[500]} />
      </View>

      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {item.name}
          </Text>
          {item.favorite && (
            <Ionicons name="star" size={16} color={colors.flame[500]} />
          )}
        </View>

        <Text style={styles.code}>{item.code}</Text>

        <View style={styles.badgeRow}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.series}</Text>
          </View>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{item.collectionNumber}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.background[700],
    borderRadius: borderRadius.md,
    borderWidth: 1,
    borderColor: colors.background[500],
    padding: spacing.sm,
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  imagePlaceholder: {
    width: 64,
    height: 64,
    borderRadius: borderRadius.sm,
    backgroundColor: colors.background[600],
    alignItems: 'center',
    justifyContent: 'center',
  },
  info: {
    flex: 1,
    justifyContent: 'center',
    gap: 4,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
    marginRight: spacing.xs,
  },
  code: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginTop: 4,
  },
  badge: {
    backgroundColor: colors.background[600],
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: borderRadius.pill,
  },
  badgeText: {
    ...typography.label,
    color: colors.text.secondary,
  },
});