import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

export interface StrongChoiceButtonProps {
  /** The item's label, for the accessible name. */
  label: string;
  onPress: () => void;
}

/**
 * The stronger of the two verdicts, on the card it applies to.
 *
 * It says what it does. An icon alone - a flame, a bolt, a double chevron -
 * reads as decoration to anyone who has not already been told what it means,
 * and this button changes how much the ranking moves, which is not something
 * to leave a first-time user guessing about.
 */
export function StrongChoiceButton({ label, onPress }: StrongChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} is much better`}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      dataSet={{ strong: 'true' }}
      style={styles.button}
    >
      <Text style={styles.label}>Much better</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 34,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  label: {
    fontFamily: fonts.body,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.1,
    color: colors.accentStrong,
  },
});
