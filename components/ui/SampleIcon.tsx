import { StyleSheet, View } from 'react-native';

import { colors } from '@/lib/theme';

export interface SampleIconProps {
  /**
   * Defaults to `--sample-ink`, a variable the surrounding control sets: see
   * the `[data-sample]` rules in themeCss, which turn the sparkle the accent
   * colour once it is hovered or focused. The fallback keeps the icon drawn
   * on any surface that never sets it.
   */
  color?: string;
}

/**
 * A small plus, drawn from two crossed bars rather than an emoji glyph: the
 * emoji sparkle renders in full colour on most platforms, which is too loud
 * for a control that should stay quiet until it is wanted. Kept upright
 * rather than rotated to a diagonal cross, which at this size reads as a
 * close/delete "x" sitting right next to a tab label.
 */
export function SampleIcon({ color = `var(--sample-ink, ${colors.textFaint})` }: SampleIconProps) {
  return (
    <View style={styles.icon}>
      <View style={[styles.bar, styles.barHorizontal, { backgroundColor: color }]} />
      <View style={[styles.bar, styles.barVertical, { backgroundColor: color }]} />
    </View>
  );
}

const SIZE = 10;

const styles = StyleSheet.create({
  icon: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  bar: { position: 'absolute', borderRadius: 1 },
  barHorizontal: { width: SIZE, height: 1.5 },
  barVertical: { width: 1.5, height: SIZE },
});
