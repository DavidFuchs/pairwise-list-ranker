import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { stringify as stringifyYaml } from 'yaml';

import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';

/** Values longer than this belong in the details panel, not in a summary chip. */
const CHIP_MAX_LENGTH = 20;

const MAX_CHIPS = 3;

export interface ItemCardProps {
  item: ListItem;
  side: 'left' | 'right';
  sortField?: string;
}

export function ItemCard({ item, side, sortField }: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);

  const label = selectItemLabel(item, sortField);
  const fields = isComplexItemValue(item.value) ? Object.entries(item.value) : [];
  const detailFields = fields.filter(([key]) => key !== sortField);
  const chips = detailFields.filter(([, value]) => isChipValue(value)).slice(0, MAX_CHIPS);

  return (
    <View
      style={styles.card}
      accessibilityLabel={`${side === 'left' ? 'Left' : 'Right'} option: ${label}`}
    >
      <Text style={styles.side}>{side === 'left' ? 'LEFT' : 'RIGHT'}</Text>

      <Text style={styles.title} numberOfLines={4}>
        {label}
      </Text>

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map(([key, value]) => (
            <View key={key} style={styles.chip}>
              <Text style={styles.chipText}>{`${key}: ${String(value)}`}</Text>
            </View>
          ))}
        </View>
      )}

      {detailFields.length > 0 && (
        <View style={styles.detailsBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${label}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((open) => !open)}
            style={styles.detailsToggle}
          >
            <Text style={styles.detailsToggleText}>
              {expanded ? 'Hide details' : 'Show details'}
            </Text>
            <Text style={styles.detailsChevron}>{expanded ? '–' : '+'}</Text>
          </Pressable>

          {expanded && (
            <View style={styles.details}>
              {detailFields.map(([key, value]) => (
                <View key={key} style={styles.detailRow}>
                  <Text style={styles.detailKey}>{key}</Text>
                  {isScalar(value) ? (
                    <Text style={styles.detailValue}>{String(value)}</Text>
                  ) : (
                    <Text style={styles.detailCode}>{formatNested(value)}</Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

function isChipValue(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && value.length <= CHIP_MAX_LENGTH && value.trim() !== '';
}

function formatNested(value: unknown): string {
  return stringifyYaml(value, { lineWidth: 0 }).trimEnd();
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 260,
    minWidth: 240,
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    boxShadow: '0 8px 18px rgba(16, 24, 40, 0.06)',
  },
  side: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 1.4,
    color: colors.textSecondary,
  },
  title: {
    ...typeScale.cardTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  detailsBlock: { gap: space.sm, marginTop: 'auto' },
  detailsToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  detailsToggleText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.accentStrong,
  },
  detailsChevron: { fontFamily: fonts.mono, fontSize: 14, color: colors.accentStrong },
  details: { gap: space.sm },
  detailRow: { gap: 2 },
  detailKey: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  detailValue: {
    ...typeScale.body,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  detailCode: {
    ...typeScale.code,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
  },
});
