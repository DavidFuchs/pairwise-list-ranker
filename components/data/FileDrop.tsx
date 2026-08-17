import { createElement, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

export interface FileDropProps {
  onFile: (text: string) => void;
}

/**
 * Web-only: React Native has no file input, and this app ships as a static web
 * bundle. The hidden input is the picker; the surrounding View is the drop
 * target.
 */
export function FileDrop({ onFile }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function readFirst(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (file === undefined) return;
    onFile(await file.text());
  }

  return (
    <View
      style={styles.zone}
      // react-native-web forwards unknown props to the DOM node, which is how
      // a React Native View becomes a drop target.
      {...{
        onDragOver: (event: DragEvent) => event.preventDefault(),
        onDrop: (event: DragEvent) => {
          event.preventDefault();
          void readFirst(event.dataTransfer?.files ?? null);
        },
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a file to import"
        onPress={() => inputRef.current?.click()}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Choose a file</Text>
      </Pressable>

      <Text style={styles.hint}>or drop one here</Text>

      {createElement('input', {
        ref: inputRef,
        type: 'file',
        'aria-hidden': true,
        tabIndex: -1,
        style: { display: 'none' },
        onChange: (event: { target: HTMLInputElement }) => void readFirst(event.target.files),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  buttonLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
