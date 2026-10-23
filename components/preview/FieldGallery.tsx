import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldPicture } from '@/components/preview/FieldPicture';
import type { Picture } from '@/lib/renderers';
import { colors, fonts, radius } from '@/lib/theme';

export interface FieldGalleryProps {
  /** Every picture the item's picture fields give, in the card's order. */
  pictures: Picture[];
  size: number;
  label: string;
}

/**
 * The card's one picture slot, shared by every field drawn as a picture. The
 * first picture shows first; with more than one, arrows under it page
 * through the rest, wrapping at either end. An item with none keeps an empty
 * frame, so the two cards of a pair still line up.
 *
 * Mount it keyed by item, so a new item starts again at its first picture.
 */
export function FieldGallery({ pictures, size, label }: FieldGalleryProps) {
  const [index, setIndex] = useState(0);
  const count = pictures.length;
  const position = Math.min(index, Math.max(0, count - 1));
  const shown = pictures[position];

  if (count <= 1) return <FieldPicture picture={shown} size={size} label={label} />;

  const step = (by: -1 | 1) => setIndex((position + by + count) % count);

  return (
    <View style={[styles.gallery, { width: size }]}>
      <FieldPicture picture={shown} size={size} label={`${label}, picture ${position + 1} of ${count}`} />
      <View style={styles.pager}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Previous picture of ${label}`}
          onPress={(event) => {
            // The card around this is a control of its own.
            event.stopPropagation();
            step(-1);
          }}
          style={styles.arrow}
        >
          <Text style={styles.glyph}>‹</Text>
        </Pressable>
        <Text style={styles.count}>{`${position + 1}/${count}`}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Next picture of ${label}`}
          onPress={(event) => {
            event.stopPropagation();
            step(1);
          }}
          style={styles.arrow}
        >
          <Text style={styles.glyph}>›</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  gallery: { flexShrink: 0, gap: 4 },
  pager: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  arrow: {
    width: 28,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  glyph: { fontFamily: fonts.body, fontSize: 15, lineHeight: 17, color: colors.textSecondary },
  count: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
