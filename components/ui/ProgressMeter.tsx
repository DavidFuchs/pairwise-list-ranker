import { StyleSheet, View } from 'react-native';

import { describeCoverage } from '@/lib/state/selectors';
import { colors } from '@/lib/theme';

export interface ProgressMeterProps {
  /** 1 is the estimate, not the maximum; above it the bar plates itself gold. */
  coverage: number;
  /** Omitted by decorative copies, which are announced by their surroundings. */
  accessibilityLabel?: string;
}

const HEIGHT = 4;

/**
 * The ranking meter, shared so the how-it-works diagram teaches the real
 * control rather than a lookalike that can drift away from it.
 *
 * Past the estimate the green run is already full, so the surplus is laid over
 * it as a second coat rather than beside it, and the gold carries a slow sheen
 * - the one ambient animation in the app, and the only signal that work past
 * the estimate is still landing.
 */
export function ProgressMeter({ coverage, accessibilityLabel }: ProgressMeterProps) {
  const { filled, surplus, valueText } = describeCoverage(coverage);
  const decorative = accessibilityLabel === undefined;

  return (
    <View
      style={styles.track}
      // A valuenow above valuemax is not a valid progressbar, so the surplus
      // travels in valuetext instead of breaking the contract.
      role={decorative ? undefined : 'progressbar'}
      aria-valuenow={decorative ? undefined : filled}
      aria-valuemin={decorative ? undefined : 0}
      aria-valuemax={decorative ? undefined : 100}
      aria-valuetext={decorative ? undefined : valueText}
      aria-label={accessibilityLabel}
    >
      <View style={[styles.fill, { width: `${filled}%` }]} dataSet={{ fill: 'meter' }} />
      {surplus > 0 && (
        <View style={[styles.surplus, { width: `${surplus}%` }]} dataSet={{ fill: 'surplus' }} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: 'hidden',
  },
  fill: { height: HEIGHT, borderRadius: 999, backgroundColor: colors.accent },
  // Sits on top of the full green run rather than beside it.
  surplus: {
    position: 'absolute',
    left: 0,
    top: 0,
    height: HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.surplus,
  },
});
