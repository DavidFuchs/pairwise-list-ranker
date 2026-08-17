import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, space } from '@/lib/theme';

export interface StrongChoiceButtonProps {
  /** The item's label, for the accessible name. */
  label: string;
  onPress: () => void;
}

/**
 * "Much better", as a single tap target on the card it applies to. Always
 * visible rather than revealed on hover, so it survives touch. The emoji
 * carries the warmth, which keeps the interface at exactly one saturated
 * accent.
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
      <Text style={styles.glyph}>🔥</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  glyph: { fontSize: 18, lineHeight: 24, paddingTop: space.xs / 2 },
});
