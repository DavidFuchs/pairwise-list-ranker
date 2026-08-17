import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RankedRow } from '@/components/preview/RankedRow';
import { Button } from '@/components/ui/Button';
import { gapMovesRow, insertIndexFor, moveItem, targetIndexForGap } from '@/lib/ranking/reorder';
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
  /**
   * Nothing moves until the drop. The rows hold still and a line shows where
   * the row will land, so the list never shifts under the pointer that is
   * aiming at it. `rows` is the geometry snapshot taken at grab.
   */
  const [dragging, setDragging] = useState<{ id: string; gap: number } | null>(null);
  const [confirming, setConfirming] = useState(false);

  const byId = useMemo(() => new Map(ranking.map((entry) => [entry.item.id, entry])), [ranking]);
  const orderedIds = pendingIds ?? derivedIds;

  /** Which gap to mark, or null when dropping here would change nothing. */
  const insertionGap = useMemo(() => {
    if (dragging === null) return null;
    const from = orderedIds.indexOf(dragging.id);
    if (from < 0 || !gapMovesRow(from, dragging.gap)) return null;
    return dragging.gap;
  }, [dragging, orderedIds]);

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
    (id: string, startClientY: number, grip: HTMLElement) => {
      const from = orderedIds.indexOf(id);
      if (from < 0) return;

      /*
       * Measured from the DOM, in the same viewport space the pointer reports.
       * Deriving this from onLayout instead means holding two coordinate
       * systems at once — the earlier attempt did, and every drag silently
       * landed at the end of the list.
       *
       * Taken once, at grab: the rows hold still for the whole drag, so a
       * single snapshot stays true.
       */
      const list = grip.closest('[role="list"]');
      if (list === null) return;

      /*
       * Measured fresh from the DOM on every move, in the same viewport space
       * the pointer reports. Nothing moves until the drop, so re-measuring is
       * both safe and simpler than keeping a snapshot in step.
       */
      const gapFor = (clientY: number) => {
        const rows = [...list.querySelectorAll('[role="listitem"]')].map((row) => {
          const rect = row.getBoundingClientRect();
          return { y: rect.top, height: rect.height };
        });
        return insertIndexFor(rows, clientY);
      };

      setDragging({ id, gap: gapFor(startClientY) });

      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };

      const onMove = (event: PointerEvent) => {
        const gap = gapFor(event.clientY);
        setDragging((current) => (current === null ? null : { ...current, gap }));
      };

      const onUp = (event: PointerEvent) => {
        stop();
        const gap = gapFor(event.clientY);
        setDragging(null);
        if (gapMovesRow(from, gap)) commit(moveItem(orderedIds, from, targetIndexForGap(from, gap)));
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
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.list}
        role="list"
      >
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
              dragging={dragging?.id === id}
              insertBefore={insertionGap === index}
              insertAfter={insertionGap === orderedIds.length && index === orderedIds.length - 1}
              onGrab={(pointerY, grip) => handleGrab(id, pointerY, grip)}
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
