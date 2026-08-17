import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

export interface ReadOnlyCodeProps {
  text: string;
  label: string;
}

export function ReadOnlyCode({ text, label }: ReadOnlyCodeProps) {
  return (
    <ScrollView style={styles.scroll} accessibilityLabel={label} role="region">
      <Text style={styles.code} selectable>
        {text}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 240,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  code: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.textPrimary },
});
