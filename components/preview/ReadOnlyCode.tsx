import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { copyText } from '@/lib/browser/exportActions';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ReadOnlyCodeProps {
  text: string;
  label: string;
  /** Names the copy icon for assistive tech, e.g. "Copy YAML to the clipboard". */
  copyLabel: string;
}

const FEEDBACK_MS = 1800;

/** Two overlapping outlines: drawn rather than typed, since no font has one glyph every platform shares. */
function CopyIcon() {
  return (
    <View style={styles.icon} aria-hidden>
      <View style={styles.iconBack} />
      <View style={styles.iconFront} />
    </View>
  );
}

export function ReadOnlyCode({ text, label, copyLabel }: ReadOnlyCodeProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.frame}>
      <ScrollView style={styles.scroll} accessibilityLabel={label} role="region">
        <Text style={styles.code} selectable>
          {text}
        </Text>
      </ScrollView>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={copyLabel}
        onPress={() => {
          void copyText(text).then((ok) => setFeedback(ok ? 'Copied' : 'Copy unavailable'));
        }}
        style={({ pressed }) => [styles.copy, pressed && styles.copyPressed]}
      >
        {feedback === null ? (
          <CopyIcon />
        ) : (
          <Text style={styles.feedback} role="status">
            {feedback}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { flex: 1, minHeight: 240 },
  scroll: {
    flex: 1,
    padding: space.md,
    // Clear of the copy icon, so a long first line does not run under it.
    paddingRight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  code: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.textPrimary },
  // Over the box rather than in its scroll, so it stays put while the text moves.
  // Inset past the scrollbar, which widens under the pointer and would cut under it.
  copy: {
    position: 'absolute',
    top: space.sm,
    right: space.md,
    minWidth: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  copyPressed: { opacity: 0.7 },
  feedback: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  icon: { width: 16, height: 16 },
  iconBack: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
  },
  iconFront: {
    position: 'absolute',
    top: 5,
    left: 5,
    width: 10,
    height: 10,
    borderRadius: 2,
    borderWidth: 1.5,
    borderColor: colors.textSecondary,
    backgroundColor: colors.surface,
  },
});
