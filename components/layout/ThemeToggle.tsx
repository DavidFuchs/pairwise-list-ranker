import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useThemePreference } from '@/lib/hooks/useThemePreference';
import type { ThemePreference } from '@/lib/hooks/useThemePreference';
import { colors, fonts, radius, space } from '@/lib/theme';

const OPTIONS: { value: ThemePreference; glyph: string; label: string }[] = [
  { value: 'system', glyph: '◐', label: 'Match system theme' },
  { value: 'light', glyph: '☀', label: 'Use the light theme' },
  { value: 'dark', glyph: '☾', label: 'Use the dark theme' },
];

export function ThemeToggle() {
  const { preference, setPreference } = useThemePreference();

  return (
    <View style={styles.group} dataSet={{ surface: 'sunken' }}>
      {OPTIONS.map((option) => {
        const selected = option.value === preference;
        return (
          <Pressable
            key={option.value}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            aria-pressed={selected}
            onPress={() => setPreference(option.value)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <Text style={[styles.glyph, selected && styles.glyphSelected]}>{option.glyph}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: 2,
    padding: 2,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  option: {
    minWidth: 30,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space.xs,
    paddingHorizontal: 6,
    borderRadius: radius.sm,
  },
  optionSelected: { backgroundColor: colors.surface, borderColor: colors.accentSoftBorder },
  glyph: { fontFamily: fonts.body, fontSize: 13, color: colors.textFaint },
  glyphSelected: { color: colors.accentStrong },
});
