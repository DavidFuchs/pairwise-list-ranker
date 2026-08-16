import { StyleSheet, Text, View } from 'react-native';

import { ComparisonActions } from '@/components/comparison/ComparisonActions';
import { ItemCard } from '@/components/comparison/ItemCard';
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
  needsSortField?: boolean;
  onOutcome: (outcome: ComparisonOutcome) => void;
  onDelete: (itemId: string) => void;
}

export function ComparisonDeck({
  pair,
  progress,
  sortField,
  needsSortField = false,
  onOutcome,
  onDelete,
}: ComparisonDeckProps) {
  if (needsSortField) {
    return (
      <Notice
        title="Pick a label field first"
        body="Choose which field of your objects should title each card, and ranking can begin."
      />
    );
  }

  if (pair === null) {
    return (
      <Notice
        title="Nothing to compare yet"
        body="Ranking needs at least two items. Import a list or add items to get started."
      />
    );
  }

  return (
    <View style={styles.stage}>
      <View style={styles.statusStrip}>
        <Text style={styles.status}>
          {`${progress.comparisons} comparisons · ${progress.activeItems} items`}
        </Text>
        <View style={styles.meter}>
          <View style={[styles.meterFill, { width: `${Math.round(progress.coverage * 100)}%` }]} />
        </View>
      </View>

      {/* Wraps to stacked cards on narrow screens without measuring anything. */}
      <View style={styles.cards}>
        <ItemCard item={pair.left} side="left" sortField={sortField} />
        <ItemCard item={pair.right} side="right" sortField={sortField} />
      </View>

      <ComparisonActions
        leftLabel={selectItemLabel(pair.left, sortField)}
        rightLabel={selectItemLabel(pair.right, sortField)}
        onOutcome={onOutcome}
        onDelete={(side) => onDelete(side === 'left' ? pair.left.id : pair.right.id)}
      />
    </View>
  );
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.notice}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: space.lg },
  statusStrip: { gap: space.sm },
  status: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  meter: {
    height: 3,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  meterFill: { height: 3, borderRadius: 999, backgroundColor: colors.accent },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space.md,
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
