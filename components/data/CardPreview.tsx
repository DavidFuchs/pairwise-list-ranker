import { useState } from 'react';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { CARD_ACTIONS_HEIGHT, ItemCard } from '@/components/comparison/ItemCard';
import { cardLayout } from '@/lib/renderers';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { ItemValue, ListItem } from '@/types/list';
import type { FieldRoles } from '@/types/source';

/** More than any screen fits, and few enough that drawing them stays cheap. */
const MAX_FILL_CARDS = 12;

/**
 * Room around the cards inside the clipping area, for a hovered card's lift
 * and shadow. The bottom borrows the panel's own padding, which the shadow
 * may spill into but a card may not.
 */
const LIFT_ROOM = { top: space.sm, side: space.lg, bottom: space.lg };

/**
 * What the ranking screen keeps in view besides a stacked pair's cards: the
 * header above them (its phone height, two rows, so a note is early rather
 * than late), the "or" between them and the Undo and Skip row under them, as
 * measured there.
 */
const STACKED_PAIR_CHROME = 110 + 23 + 59;

export interface CardPreviewProps {
  /** The list's entries: objects show their chosen fields, plain items their text. */
  entries: ItemValue[];
  roles: FieldRoles;
  /**
   * Takes the height it is given and shows as many whole cards as fit in it.
   * Without it, the panel shows one card at its own height.
   */
  fill?: boolean;
  /** Draws the compact cards a stacked pair uses; see ItemCard. */
  compact?: boolean;
}

/** A stand-in item: the card only reads the value, and the id drives its fade-in. */
function previewItem(value: ItemValue, index: number): ListItem {
  return { id: `preview-${index}`, listId: 'preview', value, active: true, createdAt: '', updatedAt: '' };
}

/**
 * Cards exactly as the rank screen will draw them, from the field settings as
 * they stand. Stepping through the entries shows how an item missing a field,
 * or with a longer title, comes out before any ranking starts.
 */
export function CardPreview({ entries, roles, fill = false, compact = false }: CardPreviewProps) {
  const { height: windowHeight } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [areaHeight, setAreaHeight] = useState<number | null>(null);
  const [heights, setHeights] = useState<Record<number, number>>({});
  // Before there is a list, the panel holds its place and says what will appear,
  // so the editor beside it does not narrow the moment one arrives.
  if (entries.length === 0) {
    return (
      <View style={[styles.panel, fill && styles.panelFill]} dataSet={{ surface: 'panel' }}>
        <View style={styles.heading}>
          <Text style={styles.title} role="heading" aria-level={2}>
            Card previews
          </Text>
          <Text style={styles.subtitle}>How each item will look while you rank.</Text>
        </View>
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>Your items will show here as cards.</Text>
        </View>
      </View>
    );
  }

  // A list edited down to fewer entries keeps the preview on one that exists.
  const start = Math.min(index, entries.length - 1);
  const layout = cardLayout(roles);
  const step = (by: -1 | 1) => setIndex((start + by + entries.length) % entries.length);

  // Every card is drawn and measured, but only those that fit whole are seen:
  // a card cut off at the bottom would misrepresent the card it previews.
  // Compact cards are measured too, out of sight, to tell whether two of them
  // will fit the ranking screen together.
  const drawn = fill || compact ? Math.min(entries.length, MAX_FILL_CARDS) : 1;
  // Where each card ends, from the heights of those above it: a view reports
  // when its size changes, not when a taller card above pushes it down.
  const bottomOf = (slot: number) => {
    let bottom = space.md * slot;
    for (let above = 0; above <= slot; above += 1) bottom += heights[above] ?? Infinity;
    return bottom;
  };
  const fits = (slot: number) =>
    slot === 0 || (areaHeight !== null && bottomOf(slot) <= areaHeight - LIFT_ROOM.top - LIFT_ROOM.bottom);
  let visible = 0;
  if (fill) while (visible < drawn && fits(visible)) visible += 1;
  else visible = 1;

  // The two tallest cards measured, with the actions a ranking card adds. A
  // stacked pair taller than the window means scrolling between the two
  // options, which is worth knowing while the fields can still change.
  const tallest = Array.from({ length: drawn }, (_, slot) => heights[slot] ?? 0)
    .sort((a, b) => b - a)
    .slice(0, 2);
  const pairHeight = tallest.reduce((sum, height) => sum + height + CARD_ACTIONS_HEIGHT, 0);
  const tooTall = compact && drawn > 1 && pairHeight + STACKED_PAIR_CHROME > windowHeight;

  const range = visible > 1 ? `${start + 1}-${((start + visible - 1) % entries.length) + 1}` : `${start + 1}`;

  return (
    <View style={[styles.panel, fill && styles.panelFill]} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <View style={styles.heading}>
          <Text style={styles.title} role="heading" aria-level={2}>
            Card previews
          </Text>
          <Text style={styles.subtitle}>How each item will look while you rank.</Text>
          {tooTall && (
            <Text style={styles.tall}>
              Some pairs will not fit on this screen together, so you will scroll to compare them. Fewer
              fields keep both cards in view.
            </Text>
          )}
        </View>
        {entries.length > visible && (
          <View style={styles.stepper}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview the previous item"
              onPress={() => step(-1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepGlyph}>‹</Text>
            </Pressable>
            <Text style={styles.count}>{`${range} of ${entries.length}`}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Preview the next item"
              onPress={() => step(1)}
              style={styles.stepButton}
            >
              <Text style={styles.stepGlyph}>›</Text>
            </Pressable>
          </View>
        )}
      </View>

      <View
        style={fill ? styles.area : undefined}
        // Always listening, even showing one card: react-native-web only
        // watches a view whose handler was there when it mounted, so one
        // added when the preview starts filling would never report.
        onLayout={(event) => setAreaHeight(event.nativeEvent.layout.height)}
      >
        <View style={[styles.cards, fill && styles.cardsFill]}>
          {Array.from({ length: drawn }, (_, slot) => {
            const at = (start + slot) % entries.length;
            const shown = slot < visible;
            return (
              <View
                key={slot}
                style={[styles.card, !shown && styles.cardHidden, !shown && !fill && styles.cardMeasured]}
                aria-hidden={!shown}
                onLayout={(event) => {
                  const { height } = event.nativeEvent.layout;
                  setHeights((current) =>
                    current[slot] === height ? current : { ...current, [slot]: height },
                  );
                }}
              >
                <ItemCard
                  item={previewItem(entries[at]!, at)}
                  side="left"
                  layout={layout}
                  compact={compact}
                  titleLevel={3}
                />
              </View>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  panelFill: { flex: 1, minHeight: 0 },
  placeholder: {
    flex: 1,
    minHeight: 160,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
  },
  placeholderText: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary, textAlign: 'center' },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  heading: { gap: 2, flexShrink: 1 },
  title: { fontFamily: fonts.heading, fontSize: 15, fontWeight: '600', color: colors.textPrimary },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  tall: {
    marginTop: space.xs,
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 17,
    color: colors.warningText,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  stepButton: { width: 30, height: 28, alignItems: 'center', justifyContent: 'center' },
  stepGlyph: { fontFamily: fonts.body, fontSize: 16, color: colors.textSecondary },
  count: {
    minWidth: 56,
    textAlign: 'center',
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
  cards: { gap: space.md },
  // The height left in the panel, whatever the cards inside would ask for,
  // widened by the lift room so the clip falls outside a hovered card.
  area: {
    flex: 1,
    minHeight: 0,
    overflow: 'hidden',
    marginTop: -LIFT_ROOM.top,
    marginHorizontal: -LIFT_ROOM.side,
    marginBottom: -LIFT_ROOM.bottom,
  },
  // Out of the flow, so drawing every card to measure it never makes the
  // column taller; the ones that do not fit are clipped by the area.
  cardsFill: { position: 'absolute', top: LIFT_ROOM.top, left: LIFT_ROOM.side, right: LIFT_ROOM.side },
  // As wide as the panel: the screen sizes the panel to match a card of a pair.
  card: { flexDirection: 'row' },
  cardHidden: { opacity: 0, pointerEvents: 'none' },
  // Measured at the shown card's width without taking room below it.
  cardMeasured: { position: 'absolute', top: 0, left: 0, right: 0 },
});
