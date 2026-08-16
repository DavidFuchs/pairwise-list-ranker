import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

export interface RankedListPreviewProps {
  ranking: RankedItem<ListItem>[];
  sortField?: string;
}

const MAX_META_FIELDS = 2;

/** The default, deliberately non-exportable view of the current ranking. */
export function RankedListPreview({ ranking, sortField }: RankedListPreviewProps) {
  if (ranking.length === 0) {
    return <Text style={styles.empty}>Nothing here yet. Import a list to see it ranked.</Text>;
  }

  return (
    <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
      {ranking.map((entry) => (
        <View key={entry.item.id} style={styles.row}>
          <View style={styles.position}>
            <Text style={styles.positionText}>{String(entry.rank)}</Text>
          </View>

          <View style={styles.body}>
            <Text style={styles.label} numberOfLines={2}>
              {selectItemLabel(entry.item, sortField)}
            </Text>
            {metaFor(entry.item, sortField) !== null && (
              <Text style={styles.meta} numberOfLines={1}>
                {metaFor(entry.item, sortField)}
              </Text>
            )}
          </View>

          <Text style={styles.rating}>{Math.round(entry.state.rating)}</Text>
        </View>
      ))}
    </ScrollView>
  );
}

function metaFor(item: ListItem, sortField: string | undefined): string | null {
  if (!isComplexItemValue(item.value)) return null;

  const parts = Object.entries(item.value)
    .filter(([key, value]) => key !== sortField && isScalar(value))
    .slice(0, MAX_META_FIELDS)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length === 0 ? null : parts.join('  ·  ');
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { gap: space.xs, paddingBottom: space.md },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    padding: space.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  position: {
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  positionText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  body: { flex: 1, gap: 1 },
  label: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  rating: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
