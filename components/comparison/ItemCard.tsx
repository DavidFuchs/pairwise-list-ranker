import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ObjectDrilldown } from '@/components/comparison/ObjectDrilldown';
import { FieldPicture } from '@/components/preview/FieldPicture';
import { FieldValue } from '@/components/preview/FieldValue';
import { PreviewButton } from '@/components/preview/PreviewButton';
import { StrongChoiceButton } from '@/components/comparison/StrongChoiceButton';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { selectItemLabel } from '@/lib/state/selectors';
import { formatValue } from '@/lib/renderers';
import { colors, fonts, motion, radius, space, typeScale } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { FieldRenderer } from '@/types/source';

/** The picture beside the title, when a field is drawn as an image. */
const IMAGE_SIZE = 112;

export interface ItemCardProps {
  item: ListItem;
  side: 'left' | 'right';
  sortField?: string;
  /** Fields every card shows as chips, in order, whether or not the item has them. */
  summaryFields?: string[];
  /** How each of summaryFields is drawn; a field absent here is plain text. */
  renderers?: Record<string, FieldRenderer>;
  /** The field holding an Apple Music id, drawn as a play button instead of text. */
  previewField?: string;
  /** The field pictured beside the title, and whether it is an image or a video. */
  pictureField?: string;
  pictureRenderer?: FieldRenderer;
  /**
   * Details are shown or hidden for the pair, not per card: comparing one
   * item's details against the other's summary is not a comparison anyone
   * wants. The deck owns the state.
   */
  expanded?: boolean;
  /**
   * Each card carries its own actions, so a decision is made on the thing being
   * decided about rather than in a detached row of buttons.
   */
  onChoose?: () => void;
  onChooseStrong?: () => void;
  onRequestDelete?: () => void;
  onConfirmDelete?: () => void;
  onCancelDelete?: () => void;
  /** True while this card is waiting for the user to confirm a delete. */
  pendingDelete?: boolean;
}

export function ItemCard({
  item,
  side,
  sortField,
  summaryFields,
  renderers,
  previewField,
  pictureField,
  pictureRenderer,
  expanded = false,
  onChoose,
  onChooseStrong,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  pendingDelete = false,
}: ItemCardProps) {
  const reducedMotion = useReducedMotion();
  const [opacity] = useState(() => new Animated.Value(1));
  const confirmRef = useRef<View | null>(null);
  const removeRef = useRef<View | null>(null);
  /** True while the confirmation below holds the focus this card took. */
  const tookFocus = useRef(false);

  // Fade the replacement card in after each decision, so the swap reads as a
  // new pair rather than text mutating in place.
  useEffect(() => {
    if (reducedMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: motion.cardSwapMs,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [item.id, opacity, reducedMotion]);

  // The confirmation replaces the button that opened it, which would drop
  // focus onto the document body and restart tabbing from the top of the
  // page. Focus follows the prompt in, and comes back to the trash can when
  // the prompt goes away without taking the card with it.
  useEffect(() => {
    if (pendingDelete) {
      focusNode(confirmRef.current);
      tookFocus.current = true;
    } else if (tookFocus.current) {
      tookFocus.current = false;
      focusNode(removeRef.current);
    }
  }, [pendingDelete]);

  const label = selectItemLabel(item, sortField);
  const fields = isComplexItemValue(item.value) ? Object.entries(item.value) : [];
  const detailFields = fields.filter(([key]) => key !== sortField);
  const raw = (field: string) => (isComplexItemValue(item.value) ? item.value[field] : undefined);
  // Only the fields the user ticked, and every one of them, so both cards of a
  // pair show the same keys and an item without one says so instead of
  // silently dropping it. A false badge is the one line meant to say nothing.
  const chips = (summaryFields ?? []).filter((field) => formatValue(raw(field), renderers?.[field], field) !== null);
  const interactive = onChoose !== undefined;
  const canChoose = interactive && !pendingDelete;

  return (
    <Animated.View
      style={[styles.card, { opacity }]}
      dataSet={{ surface: 'card' }}
    >
      <Pressable
        // Not accessibilityRole="button": the card contains real buttons
        // (delete, confirm/cancel, "Much better"), and a <button> can't
        // legally contain another <button> on web.
        accessibilityLabel={
          canChoose
            ? `Choose ${label}`
            : `${side === 'left' ? 'Left' : 'Right'} option: ${label}`
        }
        disabled={!canChoose}
        onPress={canChoose ? onChoose : undefined}
        style={({ pressed }) => [styles.pressArea, canChoose && pressed && styles.pressed]}
      >
      {/*
        The title leads the card. Which side it is on is self-evident from
        where it sits, so nothing precedes it.
      */}
      {canChoose && (
        <View style={styles.hintBar}>
          <Text style={styles.hint}>Click to choose</Text>
        </View>
      )}

      <View style={styles.headline}>
        {pictureField !== undefined && (
          <FieldPicture value={raw(pictureField)} renderer={pictureRenderer} size={IMAGE_SIZE} label={label} />
        )}
        <View style={styles.headlineBody}>
          <View style={styles.topRow}>
            <Text style={styles.title} numberOfLines={4}>
              {label}
            </Text>

            {previewField !== undefined && <PreviewButton value={raw(previewField)} label={label} compact />}
          </View>

          {/* The fields the user chose stay through the details: they are the
              part asked to always be seen. */}
          {chips.length > 0 && (
            <View style={styles.chipColumn}>
              {chips.map((field) => (
                <View key={field} style={styles.chip}>
                  <FieldValue
                    field={field}
                    value={raw(field)}
                    renderer={renderers?.[field]}
                    withKey
                    textStyle={styles.chipText}
                  />
                </View>
              ))}
            </View>
          )}
        </View>
      </View>

      {expanded && detailFields.length > 0 && isComplexItemValue(item.value) && (
        <View style={styles.detailsBlock}>
          <ObjectDrilldown value={item.value} omitField={sortField} />
        </View>
      )}

      {interactive && (
        <View style={styles.footer}>
          {pendingDelete ? (
            <View
              ref={confirmRef}
              accessibilityRole="alert"
              // Focusable only to receive focus from the code above: it is
              // a prompt, not a stop on the tab route.
              tabIndex={-1}
              style={styles.confirm}
            >
              <Text style={styles.confirmText}>{`Remove "${label}" from the list?`}</Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Keep ${label}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onCancelDelete?.();
                  }}
                  style={styles.confirmCancel}
                >
                  <Text style={styles.confirmCancelText}>Keep</Text>
                  <Text style={styles.confirmKey}>Esc</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm deleting ${label}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onConfirmDelete?.();
                  }}
                  style={styles.confirmDelete}
                >
                  <Text style={styles.confirmDeleteText}>Remove</Text>
                  <Text style={[styles.confirmKey, styles.confirmDeleteKey]}>Enter</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              {/* Bottom left, away from the play button at the top and the
                  strong choice on the right, so neither is ever a slip away
                  from removing the item. */}
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Delete ${label}`}
                onPress={(event) => {
                  event.stopPropagation();
                  onRequestDelete?.();
                }}
                ref={removeRef}
                dataSet={{ remove: 'card' }}
                style={styles.removeButton}
              >
                <TrashIcon />
              </Pressable>

              {onChooseStrong !== undefined && (
                <StrongChoiceButton label={label} onPress={onChooseStrong} />
              )}
            </View>
          )}
        </View>
      )}
      </Pressable>
    </Animated.View>
  );
}

/**
 * Focus is a web notion, and these refs are DOM nodes there. On native the
 * calls are no-ops, which is the right answer: there is no tab route to keep.
 */
function focusNode(node: View | null): void {
  (node as unknown as HTMLElement | null)?.focus?.();
}

/**
 * The width a card asks for before growing. Flex-wrap breaks the line on this
 * figure, not on minWidth, so the deck uses it to decide when the pair stacks.
 */
export const CARD_FLEX_BASIS = 280;

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: CARD_FLEX_BASIS,
    minWidth: 250,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  /**
   * The whole card is the choice, so the press target fills it. Padding lives
   * here rather than on the card so there is no dead border to click.
   */
  pressArea: {
    flex: 1,
    // The card is the tap target, so it keeps a substantial presence even when
    // the item is a bare string with nothing to show but its name. Without it
    // the footer rule rides up under the title and reads as an underline.
    minHeight: 230,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
  },
  pressed: { backgroundColor: colors.accentSoft },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  removeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  title: {
    flex: 1,
    ...typeScale.cardTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  // The picture sits to the left of everything it illustrates; the footer
  // below still spans the card.
  headline: { flexDirection: 'row', alignItems: 'flex-start', gap: space.md },
  headlineBody: { flex: 1, minWidth: 0, gap: space.md },
  // Chosen fields each get a line, so both cards of a pair line up row for row.
  chipColumn: { flexDirection: 'column', alignItems: 'flex-start', gap: space.xs },
  chip: {
    maxWidth: '100%',
    paddingVertical: 4,
    paddingHorizontal: 9,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  chipText: {
    fontFamily: fonts.body,
    fontSize: 12,
    lineHeight: 16,
    color: colors.textSecondary,
  },
  detailsBlock: { gap: space.sm },
  // Pinned to the bottom so both cards line their actions up, whatever height
  // their content takes.
  footer: {
    marginTop: 'auto',
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    minHeight: 40,
  },
  // Above everything it describes, set like the app's other small labels.
  hintBar: {
    alignItems: 'center',
    paddingBottom: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  hint: {
    fontFamily: fonts.body,
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  confirm: {
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  confirmText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.dangerText },
  confirmActions: { flexDirection: 'row', gap: space.xs },
  confirmCancel: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  confirmDelete: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  confirmDeleteText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: 'var(--danger-on-fill)' },
  /**
   * The delete is the one action here that can be reached two ways - the
   * trash can and D then L or R - so the keys that answer it are written on
   * the buttons rather than left to be guessed.
   */
  confirmKey: { fontFamily: fonts.mono, fontSize: 10, color: colors.textFaint },
  confirmDeleteKey: { color: 'var(--danger-on-fill)', opacity: 0.7 },
});
