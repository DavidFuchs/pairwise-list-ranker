import { Pressable, StyleSheet, View } from 'react-native';

import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { colors, motion, radius } from '@/lib/theme';

export interface SwitchProps {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
}

const TRACK_WIDTH = 44;
const TRACK_HEIGHT = 24;
const THUMB_SIZE = 18;
const THUMB_INSET = 3;

/** A true binary on/off control, for settings that are a single yes/no. */
export function Switch({ value, onChange, accessibilityLabel }: SwitchProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      role="switch"
      accessibilityLabel={accessibilityLabel}
      aria-checked={value}
      onPress={() => onChange(!value)}
      style={[styles.track, value && styles.trackOn]}
    >
      <View
        style={[
          styles.thumb,
          !reducedMotion && { transitionDuration: `${motion.tapMs}ms` },
          value && styles.thumbOn,
        ]}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    justifyContent: 'center',
    transitionProperty: 'background-color, border-color',
    transitionDuration: `${motion.tapMs}ms`,
  },
  trackOn: { backgroundColor: colors.accent, borderColor: colors.accentStrong },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: colors.surface,
    transform: [{ translateX: THUMB_INSET }],
    transitionProperty: 'transform',
  },
  thumbOn: { transform: [{ translateX: TRACK_WIDTH - THUMB_SIZE - THUMB_INSET }] },
});
