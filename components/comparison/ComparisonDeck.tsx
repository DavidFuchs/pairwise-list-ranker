import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardFlexBasis, ItemCard } from '@/components/comparison/ItemCard';
import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { useComparisonShortcuts } from '@/lib/hooks/useComparisonShortcuts';
import { describeCoverage, describeStability, selectItemLabel } from '@/lib/state/selectors';
import type { ActivePair, StabilityReading } from '@/lib/state/selectors';
import { EMPTY_LAYOUT } from '@/lib/renderers';
import type { CardLayout } from '@/lib/renderers';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { ComparisonOutcome } from '@/types/ranking';

export interface DeckProgress {
  activeItems: number;
  comparisons: number;
  skips: number;
  coverage: number;
  earnedCoverage: number;
}

export interface ComparisonDeckProps {
  pair: ActivePair | null;
  progress: DeckProgress;
  /** Which fields the cards draw, and how; see cardLayout. */
  layout?: CardLayout;
  onOutcome: (outcome: ComparisonOutcome) => void;
  onDelete: (itemId: string) => void;
  /** Present only while there is something to take back. */
  onUndo?: () => void;
  /** How the order is shaping up, for the status strip. */
  stability?: StabilityReading;
}

// The inline gutter needs enough room for the vertical rule, the word "or",
// and its horizontal padding. Giving it an explicit minimum also lets the deck
// decide whether two cards plus the gutter can fit before the gutter itself
// changes shape and starts influencing the answer.
const INLINE_GUTTER_MIN_WIDTH = 56;
// Flex-wrap breaks the row once the cards' flex basis no longer fits, so the
// threshold has to use the basis too. Using their smaller minWidth left a band
// of widths where the right card had wrapped but the rule stayed vertical.
function inlineLayoutMinWidth(hasPicture: boolean): number {
  return cardFlexBasis(hasPicture) * 2 + INLINE_GUTTER_MIN_WIDTH + space.md * 2;
}

/**
 * The comparison stage. Each card owns the actions for its own item - choose,
 * much better, remove - so there is no detached bank of buttons to map back
 * onto the two options. Only Skip, which belongs to the pair rather than to
 * either item, sits between them.
 */
export function ComparisonDeck({
  pair,
  progress,
  layout = EMPTY_LAYOUT,
  onOutcome,
  onDelete,
  onUndo,
  stability,
}: ComparisonDeckProps) {
  const [armed, setArmed] = useState<'left' | 'right' | null>(null);
  // Details belong to the pair: seeing one item's fields against the other's
  // summary is not a comparison. One switch shows or hides both.
  const [showDetails, setShowDetails] = useState(false);
  // Whether the pair can fit side by side is a property of the row's own
  // width. Deriving it from where the cards happened to land becomes circular:
  // once a narrow layout makes the gutter span the full row, that full-width
  // gutter keeps the cards stacked even after the viewport widens again.
  const [cardsWidth, setCardsWidth] = useState<number | null>(null);
  /*
   * The tallest the pair has been, so the controls under it only ever move
   * down, and only when a taller pair first appears: card heights follow their
   * content, and a button that shifts between pairs is one the user misses.
   * Kept per width, field setup and details state, since each of those changes
   * what a card can hold.
   */
  const heightKey = [
    cardsWidth === null ? '' : Math.round(cardsWidth),
    showDetails,
    layout.labelField,
    layout.plainFields.join(','),
    layout.pictureFields.join(','),
    layout.mediaFields.join(','),
  ].join('|');
  const [tallest, setTallest] = useState<{ key: string; height: number }>({ key: '', height: 0 });
  const cardsMinHeight = tallest.key === heightKey ? tallest.height : 0;
  const hasPicture = layout.pictureFields.length > 0;
  const stacked = cardsWidth !== null && cardsWidth < inlineLayoutMinWidth(hasPicture);

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

  const { awaitingSide, clearAwaitingSide } = useComparisonShortcuts({
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
    onUndo,
  });

  // A pointer answering the pair abandons a D that is still waiting for its
  // side, so the prompt never outlives the pair it was typed against.
  const choose = useCallback(
    (outcome: ComparisonOutcome) => {
      clearAwaitingSide();
      emit(outcome);
    },
    [clearAwaitingSide, emit],
  );

  if (pair === null) {
    return (
      <Notice
        title="Nothing to compare yet"
        body="Ranking needs at least two items. Import a list or add items to get started."
      />
    );
  }

  const { label: percentLabel, note: coverageNote } = describeCoverage(progress.coverage);
  // Nothing to toggle when the items are bare strings.
  const hasDetails = [pair.left, pair.right].some((item) => hasDetailFields(item, layout.labelField));

  return (
    <View style={styles.stage}>
      <View style={styles.statusStrip} accessibilityLiveRegion="polite">
        <View style={styles.statusRow}>
          <Text style={styles.status}>
            {`${progress.comparisons} comparisons · ${progress.activeItems} items`}
          </Text>
          <Text style={styles.statusPercent}>{percentLabel}</Text>
        </View>
        <Text style={styles.announcement}>
          {`Comparing ${selectItemLabel(pair.left, layout.labelField)} and ${selectItemLabel(pair.right, layout.labelField)}`}
        </Text>
        <ProgressMeter
          coverage={progress.coverage}
          earnedCoverage={progress.earnedCoverage}
          accessibilityLabel="Ranking progress"
        />
        {/* Neutral, not gold: the surplus colour belongs to the meter alone. */}
        {coverageNote !== null && <Text style={styles.coverageNote}>{coverageNote}</Text>}
        {stability !== undefined && <Text style={styles.coverageNote}>{describeStability(stability)}</Text>}
      </View>

      {/* Wraps to stacked cards on narrow screens via plain flex-wrap; a width
          measurement on the row decides whether the gutter should present as a
          vertical divider or a full-width horizontal break. */}
      <View
        style={[styles.cards, stacked && styles.cardsStacked, { minHeight: cardsMinHeight }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCardsWidth(width);
          setTallest((current) =>
            current.key === heightKey && current.height >= height ? current : { key: heightKey, height },
          );
        }}
      >
        <ItemCard
          item={pair.left}
          side="left"
          layout={layout}
          expanded={showDetails}
          compact={stacked && !showDetails}
          pendingDelete={armed === 'left'}
          onChoose={() => choose('left')}
          onChooseStrong={() => choose('left_strong')}
          onRequestDelete={() => setArmed('left')}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setArmed(null)}
        />
        <View style={[styles.gutter, stacked && styles.gutterStacked]} aria-hidden>
          <View style={[styles.gutterLine, stacked && styles.gutterLineStacked]} />
          <Text style={styles.gutterText}>or</Text>
          <View style={[styles.gutterLine, stacked && styles.gutterLineStacked]} />
        </View>

        <ItemCard
          item={pair.right}
          side="right"
          layout={layout}
          expanded={showDetails}
          compact={stacked && !showDetails}
          pendingDelete={armed === 'right'}
          onChoose={() => choose('right')}
          onChooseStrong={() => choose('right_strong')}
          onRequestDelete={() => setArmed('right')}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setArmed(null)}
        />
      </View>

      <View style={styles.tray}>
        <View style={styles.trayActions}>
          {hasDetails && (
            <Pressable
              accessibilityRole="switch"
              accessibilityLabel="Show details on both cards"
              aria-checked={showDetails}
              onPress={() => setShowDetails((open) => !open)}
              style={styles.detailsToggle}
            >
              <Text style={styles.detailsToggleText}>{showDetails ? 'Hide details' : 'Show details'}</Text>
            </Pressable>
          )}

          {/* Always present, so it never pushes Skip aside when it first appears. */}
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Undo last decision"
            disabled={onUndo === undefined}
            aria-disabled={onUndo === undefined}
            onPress={() => {
              if (onUndo === undefined) return;
              setArmed(null);
              onUndo();
            }}
            style={[styles.skip, onUndo === undefined && styles.unavailable]}
          >
            <Text style={styles.skipText}>Undo</Text>
          </Pressable>

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this pair"
            onPress={() => choose('skip')}
            style={styles.skip}
          >
            <Text style={styles.skipText}>Skip this pair</Text>
          </Pressable>
        </View>
        <Text style={styles.shortcuts} accessibilityLiveRegion="polite">
          {shortcutLine(awaitingSide, armed !== null)}
        </Text>
      </View>
    </View>
  );
}

/**
 * The line under the tray reports the shortcut the user is halfway through
 * rather than the whole set: a two-step shortcut with an invisible first step
 * is a dead end, and a confirmation whose keys are unstated is another.
 */
function shortcutLine(awaitingSide: boolean, armed: boolean): string {
  if (armed) return 'Enter removes · Esc keeps';
  if (awaitingSide) return 'Removing: press L or R for a side · any other key cancels';
  return 'Arrow keys choose · shift + arrow for much better · S skips · D then L or R removes · Ctrl/Cmd+Z undoes';
}

/** Whether an item carries anything beyond the field that titles its card. */
function hasDetailFields(item: ListItem, sortField: string | undefined): boolean {
  if (!isComplexItemValue(item.value)) return false;
  return Object.keys(item.value).some((key) => key !== sortField);
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
  trayActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  detailsToggle: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  detailsToggleText: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  gutter: {
    minWidth: INLINE_GUTTER_MIN_WIDTH,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  // Once the cards stack onto separate rows, the divider between them needs
  // to read as a horizontal break rather than a vertical rule left dangling
  // beside the top card.
  gutterStacked: {
    flexDirection: 'row',
    width: '100%',
    minWidth: 0,
    paddingHorizontal: 0,
    paddingVertical: 0,
  },
  gutterLine: {
    flex: 1,
    width: 1,
    minHeight: space.lg,
    backgroundColor: colors.border,
  },
  gutterLineStacked: {
    width: undefined,
    height: 1,
    minHeight: 0,
    minWidth: space.lg,
  },
  gutterText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textFaint,
  },
  statusStrip: { gap: space.sm },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  status: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.textSecondary,
  },
  statusPercent: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
  },
  coverageNote: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.textSecondary,
  },
  // Present for screen readers and announcements, but not visually.
  announcement: {
    position: 'absolute',
    width: 1,
    height: 1,
    overflow: 'hidden',
    opacity: 0,
  },
  cards: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'stretch',
    justifyContent: 'center',
    gap: space.md,
  },
  // Stacked on a phone, every pixel decides whether both cards fit on screen.
  cardsStacked: { gap: space.xs },
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
  unavailable: { opacity: 0.4 },
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
  noticeBody: {
    ...typeScale.body,
    fontFamily: fonts.body,
    color: colors.textSecondary,
  },
});
