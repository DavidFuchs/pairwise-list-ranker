import { Pressable, StyleSheet, Text, View } from 'react-native';

import { MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface OrderPickerProps {
  value: boolean;
  onChange: (alreadyRanked: boolean) => void;
  /** Fewer items than this have no order worth describing, so nothing is asked. */
  itemCount: number;
}

/**
 * Whether the imported order is a trusted best-to-worst ranking, not just an
 * arbitrary sequence. Ranked, initial ratings are seeded from that order
 * instead of starting flat, so comparisons refine it rather than rebuild it.
 *
 * Two named options rather than a switch: an unlabelled off state next to the
 * words "already ranked" reads as a claim about the list, not a choice about
 * it. Naming both orders makes the unchosen one visible.
 */
export function OrderPicker({ value, onChange, itemCount }: OrderPickerProps) {
  if (itemCount < MIN_RANKABLE) return null;

  return (
    <View style={styles.group} role="radiogroup" aria-label="What order the list is in">
      <Text style={styles.heading}>What order is your list in?</Text>

      <View style={styles.options}>
        <Pressable
          role="radio"
          accessibilityLabel="The list is in no particular order"
          aria-checked={!value}
          onPress={() => onChange(false)}
          style={[styles.option, !value && styles.optionSelected]}
        >
          <Text style={[styles.label, !value && styles.labelSelected]}>No particular order</Text>
        </Pressable>

        <Pressable
          role="radio"
          accessibilityLabel="The list is already ranked, best to worst"
          aria-checked={value}
          onPress={() => onChange(true)}
          style={[styles.option, value && styles.optionSelected]}
        >
          <Text style={[styles.label, value && styles.labelSelected]}>Best to worst</Text>
        </Pressable>
      </View>

      <Text style={styles.hint}>
        Choose “Best to worst” if the list is already ranked - we start from that order and let your
        comparisons refine it, instead of ranking from scratch.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  // Both halves claim equal width, so the pair reads as one control rather
  // than as two buttons of whatever size their words happened to need.
  option: {
    flexGrow: 1,
    flexBasis: 130,
    alignItems: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  labelSelected: { color: colors.accentStrong, fontWeight: '600' },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
