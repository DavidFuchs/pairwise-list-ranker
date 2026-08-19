import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ItemCard } from "@/components/comparison/ItemCard";
import { ProgressMeter } from "@/components/ui/ProgressMeter";
import { useComparisonShortcuts } from "@/lib/hooks/useComparisonShortcuts";
import { describeCoverage, selectItemLabel } from "@/lib/state/selectors";
import type { ActivePair } from "@/lib/state/selectors";
import { colors, fonts, radius, space, typeScale } from "@/lib/theme";
import { isComplexItemValue } from "@/types/list";
import type { ListItem } from "@/types/list";
import type { ComparisonOutcome } from "@/types/ranking";

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
  sortField?: string;
  onOutcome: (outcome: ComparisonOutcome) => void;
  onDelete: (itemId: string) => void;
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
  sortField,
  onOutcome,
  onDelete,
}: ComparisonDeckProps) {
  const [armed, setArmed] = useState<"left" | "right" | null>(null);
  // Details belong to the pair: seeing one item's fields against the other's
  // summary is not a comparison. One switch shows or hides both.
  const [showDetails, setShowDetails] = useState(false);

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
        onDelete(side === "left" ? pair.left.id : pair.right.id);
      }
      return null;
    });
  }, [onDelete, pair]);

  const { awaitingSide, clearAwaitingSide } = useComparisonShortcuts({
    enabled: pair !== null,
    armed: armed !== null,
    onChoose: useCallback(
      (side, strong) =>
        emit(strong ? (`${side}_strong` as ComparisonOutcome) : side),
      [emit],
    ),
    onSkip: useCallback(() => emit("skip"), [emit]),
    onArmDelete: useCallback((side) => setArmed(side), []),
    onConfirmDelete: confirmDelete,
    onCancelDelete: useCallback(() => setArmed(null), []),
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

  const { label: percentLabel, note: coverageNote } = describeCoverage(
    progress.coverage,
  );
  // Nothing to toggle when the items are bare strings.
  const hasDetails = [pair.left, pair.right].some((item) =>
    hasDetailFields(item, sortField),
  );

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
          {`Comparing ${selectItemLabel(pair.left, sortField)} and ${selectItemLabel(pair.right, sortField)}`}
        </Text>
        <ProgressMeter
          coverage={progress.coverage}
          earnedCoverage={progress.earnedCoverage}
          accessibilityLabel="Ranking progress"
        />
        {/* Neutral, not gold: the surplus colour belongs to the meter alone. */}
        {coverageNote !== null && (
          <Text style={styles.coverageNote}>{coverageNote}</Text>
        )}
      </View>

      {/* Wraps to stacked cards on narrow screens without measuring anything. */}
      <View style={styles.cards}>
        <ItemCard
          item={pair.left}
          side="left"
          sortField={sortField}
          expanded={showDetails}
          pendingDelete={armed === "left"}
          onChoose={() => choose("left")}
          onChooseStrong={() => choose("left_strong")}
          onRequestDelete={() => setArmed("left")}
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
          expanded={showDetails}
          pendingDelete={armed === "right"}
          onChoose={() => choose("right")}
          onChooseStrong={() => choose("right_strong")}
          onRequestDelete={() => setArmed("right")}
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
              <Text style={styles.detailsToggleText}>
                {showDetails ? "Hide details" : "Show details"}
              </Text>
            </Pressable>
          )}

          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Skip this pair"
            onPress={() => choose("skip")}
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
  if (armed) return "Enter removes · Esc keeps";
  if (awaitingSide)
    return "Removing: press L or R for a side · any other key cancels";
  return "Arrow keys choose · shift + arrow for much better · S skips · D then L or R removes";
}

/** Whether an item carries anything beyond the field that titles its card. */
function hasDetailFields(
  item: ListItem,
  sortField: string | undefined,
): boolean {
  if (!isComplexItemValue(item.value)) return false;
  return Object.keys(item.value).some((key) => key !== sortField);
}

function Notice({ title, body }: { title: string; body: string }) {
  return (
    <View style={styles.notice} dataSet={{ surface: "panel" }}>
      <Text style={styles.noticeTitle}>{title}</Text>
      <Text style={styles.noticeBody}>{body}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { gap: space.lg },
  trayActions: { flexDirection: "row", alignItems: "center", gap: space.sm },
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
    alignItems: "center",
    justifyContent: "center",
    gap: space.sm,
    paddingHorizontal: space.xs,
  },
  gutterLine: {
    flex: 1,
    width: 1,
    minHeight: space.lg,
    backgroundColor: colors.border,
  },
  gutterText: {
    fontFamily: fonts.body,
    fontSize: 11,
    letterSpacing: 0.4,
    color: colors.textFaint,
  },
  statusStrip: { gap: space.sm },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
    position: "absolute",
    width: 1,
    height: 1,
    overflow: "hidden",
    opacity: 0,
  },
  cards: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
    justifyContent: "center",
    gap: space.md,
  },
  tray: {
    alignItems: "center",
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
    fontWeight: "600",
    color: colors.textSecondary,
  },
  shortcuts: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    color: colors.textFaint,
  },
  notice: {
    gap: space.sm,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  noticeTitle: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  noticeBody: {
    ...typeScale.body,
    fontFamily: fonts.body,
    color: colors.textSecondary,
  },
});
