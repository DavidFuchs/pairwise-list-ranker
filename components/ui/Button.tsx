import { Pressable, StyleSheet, Text } from 'react-native';
import type { StyleProp, ViewStyle } from 'react-native';

import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { colors, fonts, motion, radius, space } from '@/lib/theme';

export type ButtonVariant = 'primary' | 'emphasis' | 'secondary' | 'ghost' | 'danger';

export interface ButtonProps {
  label: string;
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: 'sm' | 'md';
  disabled?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * The button hierarchy from UX.md: primary picks a winner, emphasis marks a
 * much-better win without shouting louder than primary, ghost/secondary carry
 * neutral actions, danger stays quiet until it is armed.
 */
export function Button({
  label,
  onPress,
  variant = 'secondary',
  size = 'md',
  disabled = false,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const reducedMotion = useReducedMotion();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      dataSet={variant === 'primary' ? { fill: 'accent' } : undefined}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sizeSm : styles.sizeMd,
        variantStyles[variant],
        !reducedMotion && { transitionDuration: `${motion.tapMs}ms` },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, size === 'sm' ? styles.labelSm : null, labelStyles[variant]]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: 'transparent',
    transitionProperty: 'background-color, border-color, transform, opacity',
    userSelect: 'none',
  },
  sizeMd: { paddingVertical: 13, paddingHorizontal: space.lg, minHeight: 46 },
  sizeSm: { paddingVertical: 8, paddingHorizontal: space.md, minHeight: 36 },
  pressed: { transform: [{ scale: 0.985 }], opacity: 0.92 },
  disabled: { opacity: 0.45 },
  label: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelSm: { fontSize: 13, lineHeight: 18 },
});

const variantStyles = StyleSheet.create({
  primary: { backgroundColor: colors.accent, borderColor: colors.accentStrong },
  emphasis: { backgroundColor: colors.accentSoft, borderColor: colors.accentSoftBorder },
  secondary: { backgroundColor: colors.surface, borderColor: colors.border },
  ghost: { backgroundColor: 'transparent', borderColor: 'transparent' },
  danger: { backgroundColor: colors.surface, borderColor: colors.dangerSoftBorder },
});

const labelStyles = StyleSheet.create({
  primary: { color: colors.surface },
  emphasis: { color: colors.accentStrong },
  secondary: { color: colors.textPrimary },
  ghost: { color: colors.textSecondary },
  danger: { color: colors.danger },
});
