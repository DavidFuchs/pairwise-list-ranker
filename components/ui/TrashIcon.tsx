import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

export interface TrashIconProps {
  /** Defaults to the faint text tone, so the icon sits behind the content. */
  color?: string;
}

/**
 * A trash can drawn from borders rather than a glyph or an SVG dependency:
 * the emoji bin renders as full colour on most platforms, which is far too
 * loud for a control that should stay quiet until it is wanted.
 */
export function TrashIcon({ color = colors.textFaint }: TrashIconProps) {
  return (
    <View style={styles.icon}>
      <View style={[styles.handle, { backgroundColor: color }]} />
      <View style={[styles.lid, { backgroundColor: color }]} />
      <View style={[styles.body, { borderColor: color }]} />
    </View>
  );
}

const STROKE = 1.5;

const styles = StyleSheet.create({
  icon: { alignItems: 'center', width: 14 },
  handle: { width: 6, height: 2, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  lid: { width: 14, height: STROKE, borderRadius: 1, marginTop: 1 },
  body: {
    width: 11,
    height: 9,
    marginTop: 1.5,
    borderWidth: STROKE,
    // The lid already draws the top edge; a second one there reads as a seam.
    borderTopWidth: 0,
    borderBottomLeftRadius: 2,
    borderBottomRightRadius: 2,
  },
});
