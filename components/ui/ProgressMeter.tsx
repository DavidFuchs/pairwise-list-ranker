import { StyleSheet, View } from "react-native";

import { describeCoverage } from "@/lib/state/selectors";
import { colors } from "@/lib/theme";

export interface ProgressMeterProps {
  /** 1 is the estimate, not the maximum; above it the bar plates itself gold. */
  coverage: number;
  /**
   * The same reading without the credit an already-ranked import is handed.
   * Defaults to the coverage, which hatches nothing.
   */
  earnedCoverage?: number;
  /** Omitted by decorative copies, which are announced by their surroundings. */
  accessibilityLabel?: string;
}

const HEIGHT = 4;

/**
 * The ranking meter, shared so the how-it-works diagram teaches the real
 * control rather than a lookalike that can drift away from it.
 *
 * Past the estimate the accent run is already full, so the surplus is laid over
 * it as a second coat rather than beside it, and the gold carries a slow sheen
 * - the one ambient animation in the app, and the only signal that work past
 * the estimate is still landing.
 *
 * The three runs tile rather than stack: solid accent for what comparisons
 * earned, hatched accent for what an already-ranked import was credited without
 * earning, then gold laid over the earned end as it goes past the estimate. So
 * a fresh ranked import reads as a full bar of hatching, and every comparison
 * turns a little of it solid.
 */
export function ProgressMeter({
  coverage,
  earnedCoverage,
  accessibilityLabel,
}: ProgressMeterProps) {
  const { filled, claimed, surplus, valueText } = describeCoverage(
    coverage,
    earnedCoverage,
  );
  const decorative = accessibilityLabel === undefined;

  return (
    <View
      style={styles.track}
      // A valuenow above valuemax is not a valid progressbar, so the surplus
      // travels in valuetext instead of breaking the contract.
      role={decorative ? undefined : "progressbar"}
      aria-valuenow={decorative ? undefined : filled}
      aria-valuemin={decorative ? undefined : 0}
      aria-valuemax={decorative ? undefined : 100}
      aria-valuetext={decorative ? undefined : valueText}
      aria-label={accessibilityLabel}
    >
      <View
        style={[styles.fill, { width: `${filled - claimed}%` }]}
        dataSet={{ fill: "meter" }}
      />
      {claimed > 0 && (
        <View
          style={[
            styles.claimed,
            { left: `${filled - claimed}%`, width: `${claimed}%` },
          ]}
          dataSet={{ fill: "claimed" }}
        />
      )}
      {surplus > 0 && (
        <View
          style={[styles.surplus, { width: `${surplus}%` }]}
          dataSet={{ fill: "surplus" }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    overflow: "hidden",
  },
  fill: { height: HEIGHT, borderRadius: 999, backgroundColor: colors.accent },
  // Sits at the far end of the accent run, where the earned part stops. The
  // hatching itself is a data-fill rule, since a repeating gradient has no
  // React Native style equivalent.
  claimed: { position: "absolute", top: 0, height: HEIGHT, borderRadius: 999 },
  // Sits on top of the full accent run rather than beside it.
  surplus: {
    position: "absolute",
    left: 0,
    top: 0,
    height: HEIGHT,
    borderRadius: 999,
    backgroundColor: colors.surplus,
  },
});
