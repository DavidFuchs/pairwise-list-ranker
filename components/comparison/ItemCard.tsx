import { useEffect, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { ObjectDrilldown } from '@/components/comparison/ObjectDrilldown';
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
  onChoose,
  onChooseStrong,
  onRequestDelete,
  onConfirmDelete,
  onCancelDelete,
  pendingDelete = false,
}: ItemCardProps) {
  const [expanded, setExpanded] = useState(false);
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

  return (
    <Animated.View
      style={[styles.card, { opacity }]}
      dataSet={{ surface: 'card' }}
      accessibilityLabel={`${side === 'left' ? 'Left' : 'Right'} option: ${label}`}
    >
      <View style={styles.topRow}>
        <Text style={styles.side}>{side === 'left' ? 'LEFT' : 'RIGHT'}</Text>
        {interactive && !pendingDelete && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Delete ${label}`}
            onPress={onRequestDelete}
            style={styles.removeButton}
          >
            <Text style={styles.removeGlyph}>×</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.title} numberOfLines={4}>
        {label}
      </Text>

      {chips.length > 0 && (
        <View style={styles.chipRow}>
          {chips.map(([key, value]) => (
            <View key={key} style={styles.chip}>
              <Text style={styles.chipText}>{`${key}: ${String(value)}`}</Text>
            </View>
          ))}
        </View>
      )}

      {detailFields.length > 0 && (
        <View style={styles.detailsBlock}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`${expanded ? 'Hide' : 'Show'} details for ${label}`}
            accessibilityState={{ expanded }}
            onPress={() => setExpanded((open) => !open)}
            style={styles.detailsToggle}
          >
            <Text style={styles.detailsToggleText}>
              {expanded ? 'Hide details' : 'Show details'}
            </Text>
            <Text style={styles.detailsChevron}>{expanded ? '–' : '+'}</Text>
          </Pressable>

          {expanded && isComplexItemValue(item.value) && (
            <ObjectDrilldown value={item.value} omitField={sortField} />
          )}
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
                  onPress={onCancelDelete}
                  style={styles.confirmCancel}
                >
                  <Text style={styles.confirmCancelText}>Keep</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm deleting ${label}`}
                  onPress={onConfirmDelete}
                  style={styles.confirmDelete}
                >
                  <Text style={styles.confirmDeleteText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Choose ${label}`}
                onPress={onChoose}
                style={styles.choose}
                dataSet={{ fill: 'accent' }}
              >
                <Text style={styles.chooseText} numberOfLines={1}>
                  Choose
                </Text>
                <Text style={styles.chooseArrow}>→</Text>
              </Pressable>

              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${label} is much better`}
                onPress={onChooseStrong}
                style={styles.strong}
              >
                <Text style={styles.strongText}>Much better</Text>
              </Pressable>
            </>
          )}
        </View>
      )}
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
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  side: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1.6,
    color: colors.textFaint,
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
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  detailsToggleText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    color: colors.accentStrong,
  },
  detailsChevron: { fontFamily: fonts.mono, fontSize: 13, color: colors.accentStrong },
  // Pinned to the bottom so both cards line their actions up, whatever height
  // their content takes.
  footer: {
    marginTop: 'auto',
    paddingTop: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: space.sm,
  },
  choose: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    minHeight: 46,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
  },
  chooseText: {
    fontFamily: fonts.body,
    fontSize: 15,
    fontWeight: '600',
    color: colors.accentContrast,
  },
  chooseArrow: { fontFamily: fonts.body, fontSize: 14, color: colors.accentContrast },
  strong: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  strongText: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.2,
    color: colors.accentStrong,
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
