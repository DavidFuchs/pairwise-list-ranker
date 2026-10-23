import { StyleSheet, Text, View } from 'react-native';

import type { ProgressDisplay } from '@/lib/state/progress';
import { colors, fonts, radius, space } from '@/lib/theme';

/**
 * How close the order is (docs/ARCHITECTURE.md 6.12): a short bar and the words for
 * where it stands. While items are uncompared the bar is the share already
 * compared; after that it fills in quarters to the level, with a tick between
 * them; a list that started ranked keeps the full compared bar. The bar is
 * decoration for the eye; the words carry the meaning, so a screen reader meets
 * only them.
 */
export function ProgressLine({ progress }: { progress: ProgressDisplay }) {
  return (
    <View style={styles.row}>
      <View testID={`progress-bar-${progress.bar}`} style={styles.track} aria-hidden>
        <View testID="progress-fill" style={[styles.fill, { width: `${progress.share * 100}%` }]} />
        {progress.bar === 'level' &&
          [25, 50, 75].map((at) => <View key={at} style={[styles.tick, { left: `${at}%` }]} />)}
      </View>
      <Text style={styles.text}>{progress.text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space.sm },
  track: {
    width: 120,
    height: 6,
    borderRadius: radius.sm,
    backgroundColor: colors.border,
    overflow: 'hidden',
  },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0, backgroundColor: colors.accent },
  tick: { position: 'absolute', top: 0, bottom: 0, width: 2, backgroundColor: colors.surface },
  text: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary, flexShrink: 1 },
});
