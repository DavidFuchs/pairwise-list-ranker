import { useCallback, useState } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { cardFlexBasis, ItemCard } from '@/components/comparison/ItemCard';
import { ProgressLine } from '@/components/comparison/ProgressLine';
import { RecognizePill } from '@/components/comparison/RecognizePill';
import { useComparisonShortcuts } from '@/lib/hooks/useComparisonShortcuts';
import type { ProgressDisplay } from '@/lib/state/progress';
import { describeAnswers, selectItemLabel } from '@/lib/state/selectors';
import { EMPTY_LAYOUT } from '@/lib/renderers';
import type { CardLayout } from '@/lib/renderers';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { PairOutcome } from '@/types/rankingEvents';

/**
 * What the deck can show: the pair, or, in its place, that the ranking is
 * being restored (a cold build is running) or could not be restored at all.
 * Neither of the last two offers anything to answer.
 */
export type DeckStatus = 'ready' | 'restoring' | 'unrestored';

/** Said in place of the cards, and over the ranked list, while a cold build runs. */
export const RESTORING_TEXT = 'Restoring your ranking…';

/**
 * Said in place of the cards when the engine has nothing left to ask. Only a
 * two-item list reaches this today (the previous pair is never asked again),
 * and the undo is offered only when there is one to take.
 */
function nothingToAskText(activeItems: number, canUndo: boolean): string {
  if (activeItems !== 2) return 'Nothing left to ask right now.';
  return canUndo
    ? 'Both items are ranked. Drag a row to swap them, or undo your answer.'
    : 'Both items are ranked. Drag a row to swap them.';
}

/** Said in place of the cards, and over the ranked list, when no replay worked. */
export const UNRESTORED_TEXT =
  "Couldn't restore your ranking. Your answers are saved; reload the page to try again.";

export interface ComparisonDeckProps {
  /** The pair to ask about, left then right; null when there is nothing to compare. */
  pair: readonly [ListItem, ListItem] | null;
  /** Answers so far, for the status strip (docs/ARCHITECTURE.md 6.12). */
  answers: number;
  status?: DeckStatus;
  /**
   * Active items in the list. With two or more and no pair, the engine has
   * nothing left to ask, which is not the same as having nothing to rank.
   */
  activeItems?: number;
  /** Which fields the cards draw, and how; see cardLayout. */
  layout?: CardLayout;
  onOutcome: (outcome: PairOutcome) => void;
  onDelete: (itemId: string) => void;
  /** Sets the given items aside as not recognized: one item, or both, as one action. */
  onMarkUnrecognized: (itemIds: string[]) => void;
  /** Present only while there is something to take back on this list. */
  onUndo?: () => void;
  /**
   * The list the step Undo would take back belongs to, when that is not this
   * one (docs/ARCHITECTURE.md 10.3): Undo then names it and does nothing here.
   */
  undoElsewhere?: string;
  /**
   * Ends the status line, right-aligned, such as a control that belongs with the status. On the
   * line rather than above it, since every row above the cards is one more
   * thing between a short window and the controls under them.
   */
  trailing?: ReactNode;
  /** A quiet line under the count about how close the order is (docs/ARCHITECTURE.md 6.12). */
  progress?: ProgressDisplay | null;
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
 * Whether a pair this wide stacks, and so draws its cards compact. Exported
 * for the setup screen, whose stage is as wide as this one will be, so its
 * card preview can draw the cards the ranking screen will.
 */
export function pairStacks(width: number, hasPicture: boolean): boolean {
  return width < inlineLayoutMinWidth(hasPicture);
}

/**
 * The comparison stage. Each card owns the actions for its own item - choose,
 * much better, remove - so there is no detached bank of buttons to map back
 * onto the two options. Only Can't decide and Don't recognize…, which belong to
 * the pair rather than to either item, sit between them.
 */
export function ComparisonDeck({
  pair: shownPair,
  answers,
  status = 'ready',
  activeItems = 0,
  layout = EMPTY_LAYOUT,
  onOutcome,
  onDelete,
  onMarkUnrecognized,
  onUndo,
  undoElsewhere,
  trailing,
  progress,
}: ComparisonDeckProps) {
  // Nothing half-built is ever answerable: unless the ranking is ready there is no pair.
  const pair = status === 'ready' ? shownPair : null;
  const [armed, setArmed] = useState<'left' | 'right' | null>(null);
  // "Don't recognize…" armed: the next press of a card, or L, R or B, marks.
  // Never armed together with a delete; arming either clears the other.
  const [recognizeArmed, setRecognizeArmed] = useState(false);
  const [progressHeight, setProgressHeight] = useState(0);
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
  const heightKeyAt = (width: number | null) =>
    [
      width === null ? '' : Math.round(width),
      showDetails,
      layout.labelField,
      layout.plainFields.join(','),
      layout.pictureFields.join(','),
      layout.mediaFields.join(','),
    ].join('|');
  const heightKey = heightKeyAt(cardsWidth);
  const [tallest, setTallest] = useState<{ key: string; height: number }>({ key: '', height: 0 });
  const cardsMinHeight = tallest.key === heightKey ? tallest.height : 0;
  const hasPicture = layout.pictureFields.length > 0;
  const stacked = cardsWidth !== null && pairStacks(cardsWidth, hasPicture);

  const emit = useCallback(
    (outcome: PairOutcome) => {
      setArmed(null);
      onOutcome(outcome);
    },
    [onOutcome],
  );

  const armDelete = useCallback((side: 'left' | 'right') => {
    setRecognizeArmed(false);
    setArmed(side);
  }, []);

  const confirmDelete = useCallback(() => {
    setArmed((side) => {
      if (side !== null && pair !== null) {
        onDelete(side === 'left' ? pair[0].id : pair[1].id);
      }
      return null;
    });
  }, [onDelete, pair]);

  // A delete armed against a pair that has gone (the ranking went back to
  // restoring, say) must not wait to fire on whatever pair comes next.
  // Adjusted during render, React's pattern for state that follows a prop.
  const [armedPair, setArmedPair] = useState(pair);
  if (armedPair !== pair) {
    setArmedPair(pair);
    setArmed(null);
    setRecognizeArmed(false);
  }

  const markRecognize = useCallback(
    (target: 'left' | 'right' | 'both') => {
      setRecognizeArmed(false);
      if (pair === null) return;
      const [first, second] = pair;
      onMarkUnrecognized(
        target === 'left' ? [first.id] : target === 'right' ? [second.id] : [first.id, second.id],
      );
    },
    [onMarkUnrecognized, pair],
  );

  const armRecognize = useCallback(() => {
    setArmed(null);
    setRecognizeArmed(true);
  }, []);
  const cancelRecognize = useCallback(() => setRecognizeArmed(false), []);

  const { awaitingSide, clearAwaitingSide } = useComparisonShortcuts({
    // Undo still works with no pair to answer, never while restoring.
    enabled: status === 'ready' && (pair !== null || onUndo !== undefined),
    canAnswer: pair !== null,
    armed: armed !== null,
    recognizeArmed,
    onChoose: useCallback((side, strong) => emit(strong ? (`${side}_strong` as PairOutcome) : side), [emit]),
    onCantDecide: useCallback(() => emit('draw'), [emit]),
    onArmDelete: armDelete,
    onConfirmDelete: confirmDelete,
    onCancelDelete: useCallback(() => setArmed(null), []),
    onArmRecognize: armRecognize,
    onMarkRecognize: markRecognize,
    onCancelRecognize: cancelRecognize,
    onUndo,
  });

  // A pointer answering the pair abandons a D that is still waiting for its
  // side, so the prompt never outlives the pair it was typed against.
  const choose = useCallback(
    (outcome: PairOutcome) => {
      clearAwaitingSide();
      emit(outcome);
    },
    [clearAwaitingSide, emit],
  );

  // The same goes for arming "don't recognize…" by pointer.
  const armRecognizeByPointer = useCallback(() => {
    clearAwaitingSide();
    armRecognize();
  }, [clearAwaitingSide, armRecognize]);

  if (status === 'restoring') {
    // The strip says so, and nothing stands in for the cards: there is nothing to do but wait.
    return (
      <View style={styles.stage}>
        <View style={styles.statusRow} accessibilityLiveRegion="polite">
          <Text style={[styles.status, styles.statusGrow]}>{RESTORING_TEXT}</Text>
          {trailing}
        </View>
      </View>
    );
  }

  if (pair === null) {
    return (
      <View style={styles.stage}>
        {/* The count stays true with no pair on offer, so it stays. */}
        {(trailing !== undefined || answers > 0) && (
          <View style={styles.statusRow}>
            {answers > 0 ? (
              <Text style={[styles.status, styles.statusGrow]}>{describeAnswers(answers)}</Text>
            ) : (
              <View style={styles.statusGrow} />
            )}
            {trailing}
          </View>
        )}
        {status === 'unrestored' ? (
          <Notice body={UNRESTORED_TEXT} />
        ) : activeItems >= 2 ? (
          <Notice body={nothingToAskText(activeItems, onUndo !== undefined)} />
        ) : (
          <Notice
            title="Nothing to compare yet"
            body="Ranking needs at least two items. Import a list or add items to get started."
          />
        )}
        {onUndo !== undefined && (
          <View style={styles.tray}>
            <UndoButton onUndo={onUndo} />
          </View>
        )}
      </View>
    );
  }

  const [left, right] = pair;
  // Nothing to toggle when the items are bare strings.
  const hasDetails = pair.some((item) => hasDetailFields(item, layout.labelField));

  return (
    <View style={styles.stage}>
      <View style={styles.statusStrip} accessibilityLiveRegion="polite">
        <View style={styles.statusRow}>
          <Text style={[styles.status, styles.statusGrow]}>{describeAnswers(answers)}</Text>
          {trailing}
        </View>
        <Text style={styles.announcement}>
          {`Comparing ${selectItemLabel(left, layout.labelField)} and ${selectItemLabel(right, layout.labelField)}`}
        </Text>
      </View>
      {progress !== undefined && (
        // The line's room is kept once it has been shown, so the controls below do not move up when it
        // goes (a list that gets no level after the first stage) or gets shorter (a level is briefer
        // than the first stage's words, which can wrap on a phone).
        <View
          style={{ minHeight: progressHeight }}
          onLayout={(event) => {
            const { height } = event.nativeEvent.layout;
            setProgressHeight((kept) => Math.max(kept, height));
          }}
        >
          {progress !== null && <ProgressLine progress={progress} />}
        </View>
      )}

      {/* Wraps to stacked cards on narrow screens via plain flex-wrap; a width
          measurement on the row decides whether the gutter should present as a
          vertical divider or a full-width horizontal break. */}
      <View
        style={[styles.cards, stacked && styles.cardsStacked, { minHeight: cardsMinHeight }]}
        onLayout={(event) => {
          const { width, height } = event.nativeEvent.layout;
          setCardsWidth(width);
          // Keyed by the width just measured: the render's own key may still
          // be the one from before this width was known, as on the first
          // layout, and a height filed under it would never be used.
          const key = heightKeyAt(width);
          setTallest((current) =>
            current.key === key && current.height >= height ? current : { key, height },
          );
        }}
      >
        <ItemCard
          item={left}
          side="left"
          layout={layout}
          expanded={showDetails}
          compact={stacked}
          pendingDelete={armed === 'left'}
          recognizeArmed={recognizeArmed}
          onChoose={() => (recognizeArmed ? markRecognize('left') : choose('left'))}
          onChooseStrong={() => choose('left_strong')}
          onRequestDelete={() => armDelete('left')}
          onConfirmDelete={confirmDelete}
          onCancelDelete={() => setArmed(null)}
        />
        <View style={[styles.gutter, stacked && styles.gutterStacked]} aria-hidden>
          <View style={[styles.gutterLine, stacked && styles.gutterLineStacked]} />
          {/* Stacked cards drop their own hint bar to save height, so while armed
              the gutter, already a row of its own, says what a press does. */}
          <Text style={styles.gutterText}>
            {stacked && recognizeArmed ? "Tap the one you don't recognize" : 'or'}
          </Text>
          <View style={[styles.gutterLine, stacked && styles.gutterLineStacked]} />
        </View>

        <ItemCard
          item={right}
          side="right"
          layout={layout}
          expanded={showDetails}
          compact={stacked}
          pendingDelete={armed === 'right'}
          recognizeArmed={recognizeArmed}
          onChoose={() => (recognizeArmed ? markRecognize('right') : choose('right'))}
          onChooseStrong={() => choose('right_strong')}
          onRequestDelete={() => armDelete('right')}
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

          {/* Always present, so it never pushes Can't decide aside when it first appears. */}
          <UndoButton
            elsewhere={undoElsewhere}
            onUndo={
              onUndo === undefined
                ? undefined
                : () => {
                    setArmed(null);
                    setRecognizeArmed(false);
                    onUndo();
                  }
            }
          />

          <RecognizePill
            onCantDecide={() => choose('draw')}
            armed={recognizeArmed}
            onArm={armRecognizeByPointer}
            onMarkAll={() => markRecognize('both')}
            markAllLabel="Don't recognize either"
            onCancel={cancelRecognize}
          />
        </View>
        <Text style={styles.shortcuts} accessibilityLiveRegion="polite">
          {shortcutLine(awaitingSide, armed !== null, recognizeArmed) ?? <ShortcutKeys />}
        </Text>
      </View>
    </View>
  );
}

/**
 * Takes back the last change; shown unavailable when there is none here, and
 * naming the list it belongs to when that is another one.
 */
function UndoButton({ onUndo, elsewhere }: { onUndo: (() => void) | undefined; elsewhere?: string }) {
  const label = onUndo === undefined && elsewhere !== undefined ? `Undo is on the ${elsewhere} list` : 'Undo';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label === 'Undo' ? 'Undo last change' : label}
      disabled={onUndo === undefined}
      aria-disabled={onUndo === undefined}
      onPress={() => onUndo?.()}
      style={[styles.skip, onUndo === undefined && styles.unavailable]}
    >
      <Text style={styles.skipText}>{label}</Text>
    </Pressable>
  );
}

/**
 * The line under the tray reports the shortcut the user is halfway through
 * rather than the whole set: a two-step shortcut with an invisible first step
 * is a dead end, and a confirmation whose keys are unstated is another.
 */
function shortcutLine(awaitingSide: boolean, armed: boolean, recognizeArmed: boolean): string | null {
  if (armed) return 'Enter removes · Esc keeps';
  if (awaitingSide) return 'Removing: press L or R for a side · any other key cancels';
  if (recognizeArmed) return "K then L, R or B: don't recognize";
  return null;
}

/** Keys, and what they do, for the shortcut line. */
type Shortcut = [keys: string[], action: string];

/** The whole set, keys drawn as keys so the line reads as help, not fine print. */
const SHORTCUTS: Shortcut[] = [
  [['←', '→'], 'choose'],
  [['Shift'], '+ arrow for much better'],
  [['S'], "can't decide"],
  [['K'], "then L, R or B: don't recognize"],
  [['D'], 'then L or R removes'],
  [['Ctrl/Cmd', 'Z'], 'undoes'],
];

/** The shortcut line's keys. */
function ShortcutKeys() {
  return SHORTCUTS.map(([keys, action], index) => (
    <Text key={action}>
      {index > 0 && <Text style={styles.shortcutSep}>{'  ·  '}</Text>}
      {keys.map((key, at) => (
        <Text key={key}>
          {at > 0 && ' '}
          {/* Padded with no-break spaces, so a line never breaks inside a keycap and leaves half its border behind. */}
          <Text style={styles.keycap} dataSet={{ keycap: 'true' }}>{`\u00a0${key}\u00a0`}</Text>
        </Text>
      ))}
      {` ${action}`}
    </Text>
  ));
}

/** Whether an item carries anything beyond the field that titles its card. */
function hasDetailFields(item: ListItem, sortField: string | undefined): boolean {
  if (!isComplexItemValue(item.value)) return false;
  return Object.keys(item.value).some((key) => key !== sortField);
}

/** A panel standing in for the cards when there is nothing to answer. */
function Notice({ title, body }: { title?: string; body: string }) {
  return (
    <View style={styles.notice} dataSet={{ surface: 'panel' }}>
      {title !== undefined && <Text style={styles.noticeTitle}>{title}</Text>}
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: space.lg },
  trayActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
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
  // Wraps, so on a phone the control that ends the line drops under the
  // count rather than squeezing it into a column.
  statusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  statusGrow: { flexGrow: 1, flexShrink: 1, flexBasis: 'auto' },
  status: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.4,
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
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 19,
    textAlign: 'center',
    color: colors.textSecondary,
  },
  shortcutSep: { color: colors.textFaint },
  keycap: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderBottomWidth: 2,
    borderRadius: 4,
    backgroundColor: colors.surface,
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
