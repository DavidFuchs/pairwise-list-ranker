import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RankedRow } from '@/components/preview/RankedRow';
import { Button } from '@/components/ui/Button';
import { dropIndexFor, moveItem } from '@/lib/ranking/reorder';
import type { RowOffset } from '@/lib/ranking/reorder';
import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

export interface RankedListPreviewProps {
  ranking: RankedItem<ListItem>[];
  sortField?: string;
  /** Rated comparisons that a reorder would discard. */
  comparisonCount: number;
  onReorder: (itemIds: string[]) => void;
}

const MAX_META_FIELDS = 2;

/**
 * The ranking, and the one place it can be arranged by hand. A manual order
 * restarts ranking from that order, so anything that would discard real work
 * asks first.
 */
export function RankedListPreview({
  ranking,
  sortField,
  comparisonCount,
  onReorder,
}: RankedListPreviewProps) {
  const derivedIds = useMemo(() => ranking.map((entry) => entry.item.id), [ranking]);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<{ id: string; targetIndex: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const offsets = useRef(new Map<string, RowOffset>());

  const byId = useMemo(() => new Map(ranking.map((entry) => [entry.item.id, entry])), [ranking]);
  const orderedIds = pendingIds ?? derivedIds;

  /** Apply straight away when nothing is at stake; otherwise ask first. */
  const commit = useCallback(
    (nextIds: string[]) => {
      if (comparisonCount === 0) {
        setPendingIds(null);
        onReorder(nextIds);
        return;
      }
      setPendingIds(nextIds);
      setConfirming(true);
    },
    [comparisonCount, onReorder],
  );

  const handleKeyMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = orderedIds.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= orderedIds.length) return;
      commit(moveItem(orderedIds, from, to));
    },
    [commit, orderedIds],
  );

  const handleGrab = useCallback(
    (id: string) => {
      setDragging({ id, targetIndex: orderedIds.indexOf(id) });

      const rows = () =>
        orderedIds
          .map((rowId) => offsets.current.get(rowId))
          .filter((row): row is RowOffset => row !== undefined);

      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };

      const onMove = (event: PointerEvent) => {
        const index = dropIndexFor(rows(), event.clientY);
        setDragging((current) => (current === null ? null : { ...current, targetIndex: index }));
      };

      const onUp = (event: PointerEvent) => {
        stop();
        const from = orderedIds.indexOf(id);
        const to = dropIndexFor(rows(), event.clientY);
        setDragging(null);
        if (from !== to) commit(moveItem(orderedIds, from, to));
      };

      const onCancel = () => {
        stop();
        setDragging(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    },
    [commit, orderedIds],
  );

  if (ranking.length === 0) {
    return <Text style={styles.empty}>Nothing here yet. Import a list to see it ranked.</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} role="list">
        {orderedIds.map((id, index) => {
          const entry = byId.get(id);
          if (entry === undefined) return null;

          return (
            <RankedRow
              key={id}
              id={id}
              rank={index + 1}
              label={selectItemLabel(entry.item, sortField)}
              meta={metaFor(entry.item, sortField)}
              rating={entry.state.rating}
              y={offsets.current.get(id)?.y ?? 0}
              dragging={dragging?.id === id}
              target={dragging !== null && dragging.id !== id && dragging.targetIndex === index}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                offsets.current.set(id, { y, height });
              }}
              onGrab={() => handleGrab(id)}
              onKeyMove={(direction) => handleKeyMove(id, direction)}
            />
          );
        })}
      </ScrollView>

      {confirming && (
        <View style={styles.confirm} role="alert">
          <Text style={styles.confirmText}>
            {`Reordering by hand starts a new ranking session. Your ${comparisonCount} comparisons are cleared, and this order becomes the starting point.`}
          </Text>
          <View style={styles.confirmActions}>
            <Button
              label="Cancel"
              accessibilityLabel="Cancel reordering"
              variant="ghost"
              size="sm"
              onPress={() => {
                setConfirming(false);
                setPendingIds(null);
              }}
            />
            <Button
              label="Reorder and restart"
              accessibilityLabel="Reorder and restart"
              variant="primary"
              size="sm"
              onPress={() => {
                const next = pendingIds;
                setConfirming(false);
                setPendingIds(null);
                if (next !== null) onReorder(next);
              }}
            />
          </View>
        </View>
      )}
    </View>
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
  container: { flex: 1, gap: space.sm },
  scroll: { flex: 1 },
  list: { gap: space.xs, paddingBottom: space.md },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    padding: space.md,
  },
  confirm: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  confirmText: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  confirmActions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
});
