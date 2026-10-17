import { createElement, useRef } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { TEXT_FILE_ACCEPT } from '@/lib/browser/fileText';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface FileDropProps {
  /** The file chosen; reading it, and refusing what is not text, is the caller's. */
  onFile: (file: File) => void;
}

/**
 * Web-only: React Native has no file input, and this app ships as a static web
 * bundle. The hidden input is the picker; dropping a file is handled by
 * AppShell's page-wide drop target, not here. Rendering
 * `createElement('input', ...)` on native crashes (React Native has no host
 * component named "input"), so this is skipped there.
 */
export function FileDrop({ onFile }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (Platform.OS !== 'web') return null;

  function readFirst(files: FileList | null): void {
    const file = files?.[0];
    if (file !== undefined) onFile(file);
  }

  return (
    <View style={styles.zone}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a file to import"
        onPress={() => inputRef.current?.click()}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Choose a file</Text>
      </Pressable>

      <Text style={styles.hint}>
        or drop one anywhere on the page. A saved session opens where you left off.
      </Text>

      {createElement('input', {
        ref: inputRef,
        type: 'file',
        // Lists come as text, YAML or JSON; the picker offers those first.
        accept: TEXT_FILE_ACCEPT,
        'aria-hidden': true,
        tabIndex: -1,
        style: { display: 'none' },
        onChange: (event: { target: HTMLInputElement }) => readFirst(event.target.files),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Shrinks so the hint wraps inside a narrow panel instead of running past it.
  zone: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1, minWidth: 0 },
  button: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  buttonLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  hint: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
