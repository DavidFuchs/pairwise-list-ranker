import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stopPreview, togglePreview, useIsPlaying, usePreviewUrl } from '@/lib/preview/applePreview';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface PreviewButtonProps {
  /** The raw field value: an Apple Music track id. */
  value: unknown;
  /** What the preview is of, for the accessible name. */
  label: string;
  /** A round icon for dense rows; the card gets a labelled button. */
  compact?: boolean;
  /** Drawn while no preview is known - still looking, or there is none. */
  placeholder?: ReactNode;
}

/**
 * A play button for a 30-second Apple Music preview. It draws nothing until a
 * preview is known to exist, so an item with no preview simply has no button.
 */
export function PreviewButton({ value, label, compact = false, placeholder = null }: PreviewButtonProps) {
  const id = typeof value === 'string' || typeof value === 'number' ? String(value).trim() : '';
  const url = usePreviewUrl(id === '' ? undefined : id);
  const playing = useIsPlaying(id);

  // A card that is replaced or scrolled away must not keep playing.
  useEffect(() => () => stopPreview(id), [id]);

  if (typeof url !== 'string') return <>{placeholder}</>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Stop preview of' : 'Play preview of'} ${label}`}
      aria-pressed={playing}
      onPress={(event) => {
        // The card and the row around this are controls of their own.
        event.stopPropagation();
        togglePreview(id, url);
      }}
      style={[styles.button, compact ? styles.compact : styles.labelled, playing && styles.active]}
    >
      <Text style={[styles.glyph, playing && styles.glyphActive]}>{playing ? '■' : '▶'}</Text>
      {!compact && <Text style={[styles.text, playing && styles.glyphActive]}>{playing ? 'Stop' : 'Preview'}</Text>}
    </Pressable>
  );
}

/**
 * The compact button's look with nothing behind it: what a play button will
 * be, shown while no preview is known.
 */
export function PreviewButtonPlaceholder() {
  return (
    <View style={[styles.button, styles.compact]} aria-hidden>
      <Text style={styles.glyph}>▶</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  compact: { width: 28, height: 28, borderRadius: 999 },
  labelled: {
    alignSelf: 'flex-start',
    minHeight: 32,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
  },
  active: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  glyph: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  glyphActive: { color: colors.accentStrong },
  text: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
