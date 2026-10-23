import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { stopPreview, useIsPlaying } from '@/lib/preview/playback';
import { togglePreviewOf, usePreviewSources } from '@/lib/preview/previewSources';
import type { PreviewSource } from '@/lib/renderers';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface PreviewButtonProps {
  /** Where to look for a clip, in order: the first that has one is played. */
  sources: PreviewSource[];
  /** What the preview is of, for the accessible name. */
  label: string;
  /** A round icon for dense rows; the card gets a labelled button. */
  compact?: boolean;
  /** Drawn while no preview is known - still looking, or there is none. */
  placeholder?: ReactNode;
}

/**
 * A play button for a 30-second preview, from the first source that has one.
 * It draws nothing until a preview is known to exist, so an item with no
 * preview anywhere simply has no button.
 */
export function PreviewButton({ sources, label, compact = false, placeholder = null }: PreviewButtonProps) {
  const found = usePreviewSources(sources);
  const key = found?.key ?? '';
  const playing = useIsPlaying(key);

  // A card that is replaced or scrolled away must not keep playing.
  useEffect(() => () => stopPreview(key), [key]);

  if (found === null || found === undefined) return <>{placeholder}</>;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${playing ? 'Stop preview of' : 'Play preview of'} ${label}`}
      aria-pressed={playing}
      onPress={(event) => {
        // The card and the row around this are controls of their own.
        event.stopPropagation();
        togglePreviewOf(found);
      }}
      style={[styles.button, compact ? styles.compact : styles.labelled, playing && styles.active]}
    >
      <Text style={[styles.glyph, playing && styles.glyphActive]}>{playing ? '■' : '▶'}</Text>
      {!compact && (
        <Text style={[styles.text, playing && styles.glyphActive]}>{playing ? 'Stop' : 'Preview'}</Text>
      )}
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
