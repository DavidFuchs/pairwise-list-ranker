import { useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';

import { isImageLink } from '@/lib/renderers';
import { colors, radius } from '@/lib/theme';

export interface FieldImageProps {
  /** The raw field value: an image address, or anything else for an empty frame. */
  value: unknown;
  size: number;
  /** What the picture is of, for the accessible name. */
  label: string;
}

/**
 * A field value pictured. An item without a usable address - missing, not an
 * image, or failing to load - keeps an empty frame of the same size, so the
 * two cards of a pair and the rows of a list still line up.
 */
export function FieldImage({ value, size, label }: FieldImageProps) {
  const uri = isImageLink(value) ? value.trim() : undefined;
  // Held by address, so an item that swaps to a new picture tries again.
  const [failed, setFailed] = useState<string | null>(null);
  const frame = [styles.frame, { width: size, height: size, borderRadius: size >= 64 ? radius.md : radius.sm }];

  if (uri === undefined || failed === uri) return <View style={frame} aria-hidden />;

  return (
    <Image
      source={{ uri }}
      accessibilityLabel={label}
      resizeMode="cover"
      onError={() => setFailed(uri)}
      style={frame}
    />
  );
}

const styles = StyleSheet.create({
  frame: { flexShrink: 0, backgroundColor: colors.surfaceMuted },
});
