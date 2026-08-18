import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

export interface TrashIconProps {
  /**
   * Defaults to `--trash-ink`, a variable the surrounding control sets: see the
   * `[data-remove]` rules in themeCss, which turn the can the colour of what it
   * does when it is hovered or focused. The fallback keeps the icon drawn on
   * any surface that never sets it.
   */
  color?: string;
}

/**
 * A trash can drawn from borders rather than a glyph or an SVG dependency:
 * the emoji bin renders as full colour on most platforms, which is far too
 * loud for a control that should stay quiet until it is wanted.
 */
export function TrashIcon({ color = `var(--trash-ink, ${colors.textFaint})` }: TrashIconProps) {
  return (
    <View style={styles.icon}>
      <View style={[styles.handle, { backgroundColor: color }]} />
      <View style={[styles.lid, { backgroundColor: color }]} />
      <View style={[styles.body, { borderColor: color }]} />
    </View>
  );
}

const STROKE = 2;

const styles = StyleSheet.create({
  icon: { alignItems: 'center', width: 15 },
  handle: { width: 7, height: 2.5, borderTopLeftRadius: 1, borderTopRightRadius: 1 },
  lid: { width: 15, height: STROKE, borderRadius: 1, marginTop: 1 },
  body: {
    width: 11.5,
    height: 9,
    marginTop: 1.5,
    borderWidth: STROKE,
    // The lid already draws the top edge; a second one there reads as a seam.
    borderTopWidth: 0,
    borderBottomLeftRadius: 2.5,
    borderBottomRightRadius: 2.5,
  },
});
