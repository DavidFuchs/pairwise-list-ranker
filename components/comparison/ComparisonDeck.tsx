import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ItemCard } from '@/components/comparison/ItemCard';
import { useComparisonShortcuts } from '@/lib/hooks/useComparisonShortcuts';
import { selectItemLabel } from '@/lib/state/selectors';
import type { ActivePair } from '@/lib/state/selectors';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ComparisonOutcome } from '@/types/ranking';

export interface DeckProgress {
  activeItems: number;
  comparisons: number;
  skips: number;
  coverage: number;
}

export interface ComparisonDeckProps {
  pair: ActivePair | null;
  progress: DeckProgress;
  sortField?: string;
  onOutcome: (outcome: ComparisonOutcome) => void;
  onDelete: (itemId: string) => void;
}

/**
 * The comparison stage. Each card owns the actions for its own item — choose,
 * much better, remove — so there is no detached bank of buttons to map back
 * onto the two options. Only Skip, which belongs to the pair rather than to
 * either item, sits between them.
 */
export function ComparisonDeck({
  pair,
  progress,
  sortField,
  onOutcome,
  onDelete,
}: ComparisonDeckProps) {
  const [armed, setArmed] = useState<'left' | 'right' | null>(null);

  const emit = useCallback(
    (outcome: ComparisonOutcome) => {
      setArmed(null);
      onOutcome(outcome);
    },
    [onOutcome],
  );

  const confirmDelete = useCallback(() => {
    setArmed((side) => {
      if (side !== null && pair !== null) {
        onDelete(side === 'left' ? pair.left.id : pair.right.id);
      }
      return null;
    });
  }, [onDelete, pair]);

  useComparisonShortcuts({
    enabled: pair !== null,
    armed: armed !== null,
    onChoose: useCallback(
      (side, strong) => emit(strong ? (`${side}_strong` as ComparisonOutcome) : side),
      [emit],
    ),
    onSkip: useCallback(() => emit('skip'), [emit]),
    onArmDelete: useCallback((side) => setArmed(side), []),
    onConfirmDelete: confirmDelete,
    onCancelDelete: useCallback(() => setArmed(null), []),
  });

  if (pair === null) {
    return (
      <Notice
        title="Nothing to compare yet"
        body="Ranking needs at least two items. Import a list or add items to get started."
      />
    );
  }

  const percent = Math.round(progress.coverage * 100);

  return (
    <View style={styles.stage}>
      <View style={styles.statusStrip} accessibilityLiveRegion="polite">
        <View style={styles.statusRow}>
          <Text style={styles.status}>
            {`${progress.comparisons} comparisons · ${progress.activeItems} items`}
          </Text>
          <Text style={styles.statusPercent}>{`${percent}%`}</Text>
        </View>
        <Text style={styles.announcement}>
          {`Comparing ${selectItemLabel(pair.left, sortField)} and ${selectItemLabel(pair.right, sortField)}`}
        </Text>
        <View
          style={styles.meter}
          role="progressbar"
          aria-valuenow={percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Ranking progress"
        >
          <View style={[styles.meterFill, { width: `${percent}%` }]} dataSet={{ fill: 'meter' }} />
        </View>
      </View>

      {/* Wraps to stacked cards on narrow screens without measuring anything. */}
      <View style={styles.cards}>
        <ItemCard
          item={pair.left}
          side="left"
          sortField={sortField}
          pendingDelete={armed === 'left'}
          onChoose={() => emit('left')}
          onChooseStrong={() => emit('left_strong')}
          onRequestDelete={() => setArmed('left')}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setArmed(null)}
        />
        <View style={styles.gutter} aria-hidden>
          <View style={styles.gutterLine} />
          <Text style={styles.gutterText}>or</Text>
          <View style={styles.gutterLine} />
        </View>

        <ItemCard
          item={pair.right}
          side="right"
          sortField={sortField}
          pendingDelete={armed === 'right'}
          onChoose={() => emit('right')}
          onChooseStrong={() => emit('right_strong')}
          onRequestDelete={() => setArmed('right')}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setArmed(null)}
        />
      </View>

      <View style={styles.tray}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Skip this pair"
          onPress={() => emit('skip')}
          style={styles.skip}
        >
          <Text style={styles.skipText}>Skip this pair</Text>
        </Pressable>
        <Text style={styles.shortcuts}>
          Shift + arrow for much better · S skips · D then L or R removes
        </Text>
      </View>
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.notice} dataSet={{ surface: 'panel' }}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: space.lg },
  gutter: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  gutterLine: { flex: 1, width: 1, minHeight: space.lg, backgroundColor: colors.border },
  gutterText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textFaint,
  },
  statusStrip: { gap: space.sm },
  statusRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  status: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  statusPercent: { fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint },
  // Present for screen readers and announcements, but not visually.
  announcement: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  meter: {
    height: 4,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  meterFill: { height: 4, borderRadius: 999, backgroundColor: colors.accent },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space.md,
  },
  tray: {
    alignItems: 'center',
    gap: space.xs,
    paddingTop: space.xs,
  },
  skip: {
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  skipText: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  shortcuts: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    textAlign: 'center',
    color: colors.textFaint,
  },
  notice: {
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noticeTitle: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  noticeBody: { ...typeScale.body, fontFamily: fonts.body, color: colors.textSecondary },
});
