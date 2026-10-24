import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, typography, spacing, borderRadius, shadow } from '@/theme';
import type { HotWheel } from '@/types/hot-wheel';

type Props = {
  hotWheel: HotWheel;
  favorite?: boolean;
  quantity?: number;
};

// "#120/365" com total confirmado, "#120" sem total. "No #", "N/A" e valores quebrados não aparecem.
// Registros antigos ainda com "120/250" no texto continuam aparecendo como estão.
export function formatCollectionNumber(hw: Pick<HotWheel, 'collectionNumber' | 'collectionTotal'>) {
  const number = hw.collectionNumber?.trim();
  if (!number) return null;
  if (/^\d+\/\d+$/.test(number)) return `#${number}`;
  if (!/^\d+$/.test(number)) return null;
  return hw.collectionTotal ? `#${number}/${hw.collectionTotal}` : `#${number}`;
}

type TagStyle = 'sth' | 'th' | 'default';
const TAGS: Record<string, { label: string; style: TagStyle }> = {
  'Super Treasure Hunt': { label: 'Super TH', style: 'sth' },
  'Treasure Hunt': { label: 'Treasure Hunt', style: 'th' },
  'First Edition': { label: '1ª Edição', style: 'default' },
  'New Model': { label: 'Novo Modelo', style: 'default' },
  'Mystery Model': { label: 'Mystery', style: 'default' },
};
const TAG_ORDER = Object.keys(TAGS);

// Etiquetas do catálogo, das mais raras para as comuns. Etiquetas desconhecidas aparecem como vieram.
export function buildTagBadges(hw: Pick<HotWheel, 'tags'>) {
  return [...(hw.tags ?? [])]
    .sort((a, b) => (TAG_ORDER.indexOf(a) + 1 || 99) - (TAG_ORDER.indexOf(b) + 1 || 99))
    .map((tag) => TAGS[tag] ?? { label: tag, style: 'default' as TagStyle });
}

// Mainline mostra série e número da coleção. Pop Culture mostra franquia e cor.
function buildBadges(hw: HotWheel): string[] {
  const badges: string[] = [];

  if (hw.line === 'Pop Culture') {
    if (hw.theme) badges.push(hw.theme);
    if (hw.bodyColor) badges.push(hw.bodyColor);
  } else {
    if (hw.series) badges.push(hw.series);
    const collection = formatCollectionNumber(hw);
    if (collection) badges.push(collection);
  }

  // A variante STH já aparece como etiqueta; não repete "Super Treasure Hunt"
  if (hw.variation && !hw.tags?.includes(hw.variation)) badges.push(hw.variation);
  return badges;
}

export function HotWheelCard({ hotWheel, favorite = false, quantity = 1 }: Props) {
  const line = hotWheel.line ?? 'Mainline';
  const isSpecialLine = line !== 'Mainline';
  const badges = buildBadges(hotWheel);
  const tagBadges = buildTagBadges(hotWheel);

  return (
    <View style={[styles.card, shadow.card]}>
      <View style={styles.imagePlaceholder}>
        <Ionicons name="car-sport" size={32} color={colors.chrome[500]} />
      </View>

      <View style={styles.info}>
        <View style={styles.headerRow}>
          <Text style={styles.name} numberOfLines={1}>
            {hotWheel.name}
          </Text>
          {quantity > 1 && <Text style={styles.quantity}>×{quantity}</Text>}
          {favorite && <Ionicons name="star" size={16} color={colors.flame[500]} />}
        </View>

        <Text style={styles.code}>
          {hotWheel.code}
          {hotWheel.year ? ` · ${hotWheel.year}` : ''}
        </Text>

        <View style={styles.badgeRow}>
          {tagBadges.map(({ label, style }) => (
            <View key={label} style={[styles.badge, style === 'sth' && styles.badgeSth, style === 'th' && styles.badgeTh]}>
              <Text style={[styles.badgeText, style === 'sth' && styles.badgeSthText, style === 'th' && styles.badgeThText]}>
                {label}
              </Text>
            </View>
          ))}
          <View style={[styles.badge, isSpecialLine && styles.badgeLine]}>
            <Text style={[styles.badgeText, isSpecialLine && styles.badgeLineText]}>{line}</Text>
          </View>
          {badges.map((text) => (
            <View key={text} style={styles.badge}>
              <Text style={styles.badgeText}>{text}</Text>
            </View>
          ))}
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
    gap: spacing.xs,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text.primary,
    flex: 1,
  },
  quantity: {
    ...typography.label,
    color: colors.chrome[300],
  },
  code: {
    ...typography.caption,
    color: colors.text.disabled,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
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
  badgeLine: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.flame[600],
  },
  badgeLineText: {
    color: colors.flame[500],
  },
  badgeSth: {
    backgroundColor: colors.flame[600],
  },
  badgeSthText: {
    color: colors.text.primary,
  },
  badgeTh: {
    backgroundColor: colors.feedback.warning,
  },
  badgeThText: {
    color: colors.background[900],
  },
});