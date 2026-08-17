import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ObjectDrilldown } from '@/components/comparison/ObjectDrilldown';
import { StrongChoiceButton } from '@/components/comparison/StrongChoiceButton';
import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, motion, radius, space, typeScale } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';

/** Values longer than this belong in the details panel, not in a summary chip. */
const CHIP_MAX_LENGTH = 20;

const MAX_CHIPS = 3;

export interface ItemCardProps {
  item: ListItem;
  side: 'left' | 'right';
  sortField?: string;
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

  const label = selectItemLabel(item, sortField);
  const fields = isComplexItemValue(item.value) ? Object.entries(item.value) : [];
  const detailFields = fields.filter(([key]) => key !== sortField);
  const chips = detailFields.filter(([, value]) => isChipValue(value)).slice(0, MAX_CHIPS);
  const interactive = onChoose !== undefined;
  const canChoose = interactive && !pendingDelete;

  return (
    <Animated.View style={[styles.card, { opacity }]} dataSet={{ surface: 'card' }}>
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
      <View style={styles.topRow}>
        <Text style={styles.title} numberOfLines={4}>
          {label}
        </Text>

        {interactive && !pendingDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            onPress={(event) => {
              event.stopPropagation();
              onRequestDelete?.();
            }}
            style={styles.removeButton}
          >
            <Text style={styles.removeGlyph}>×</Text>
          </Pressable>
        )}
      </View>

      {/* The chips are a summary of the details, so they step aside for them. */}
      {!expanded && chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map(([key, value]) => (
            <View key={key} style={styles.chip}>
              <Text style={styles.chipText}>{`${key}: ${String(value)}`}</Text>
            </View>
          ))}
        </View>
      )}

      {expanded && detailFields.length > 0 && isComplexItemValue(item.value) && (
        <View style={styles.detailsBlock}>
          <ObjectDrilldown value={item.value} omitField={sortField} />
        </View>
      )}

      {interactive && (
        <View style={styles.footer}>
          {pendingDelete ? (
            <View style={styles.confirm}>
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
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Text style={styles.hint} dataSet={{ hint: 'choose' }}>
                Click to choose
              </Text>

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

function isChipValue(value: unknown): boolean {
  if (typeof value === 'number' || typeof value === 'boolean') return true;
  return typeof value === 'string' && value.length <= CHIP_MAX_LENGTH && value.trim() !== '';
}

const styles = StyleSheet.create({
  card: {
    flexGrow: 1,
    flexShrink: 1,
    flexBasis: 280,
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
  removeGlyph: { fontFamily: fonts.body, fontSize: 15, lineHeight: 18, color: colors.textFaint },
  title: {
    flex: 1,
    ...typeScale.cardTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    letterSpacing: -0.3,
    color: colors.textPrimary,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  chip: {
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
    minHeight: 40,
  },
  /** Revealed on hover by themeCss; kept visible under reduced motion. */
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, opacity: 0 },
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
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  confirmCancelText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  confirmDelete: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: radius.sm,
    backgroundColor: colors.danger,
  },
  confirmDeleteText: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: 'var(--danger-on-fill)' },
});
