import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

import { colors, fonts, space } from '@/lib/theme';

export interface RecognizePillProps {
  onCantDecide: () => void;
  armed: boolean;
  onArm: () => void;
  /** Marks both cards: "Don't recognize either". */
  onMarkAll: () => void;
  markAllLabel: string;
  onCancel: () => void;
}

const ARM_LABEL = "Don't recognize…";
const CANCEL_LABEL = 'Cancel';

/**
 * Below this window width the halves take less padding: at full padding the
 * pair's pill is wider than a 320px phone leaves between its gutters.
 */
const NARROW_WINDOW = 400;

/**
 * One control in two halves. Unarmed it reads "Can't decide" | "Don't recognize…";
 * pressing the second half arms it in place, and the halves become the mark-all action and
 * Cancel.
 *
 * Nothing moves under the pointer between the two presses, so a second click
 * where the first one was is Cancel, never "mark all". Each half is as wide as
 * the widest label it can show, so the second half stays where it was, the
 * same width, whatever the tray around it does.
 *
 * It never runs off a narrow screen: it is never wider than its row, and when
 * even the tighter padding does not fit, the halves share the room and their
 * labels wrap, both states alike, so neither half moves between them.
 */
export function RecognizePill({
  onCantDecide,
  armed,
  onArm,
  onMarkAll,
  markAllLabel,
  onCancel,
}: RecognizePillProps) {
  const firstLabels = ["Can't decide", markAllLabel];
  const first = armed
    ? { label: markAllLabel, onPress: onMarkAll }
    : { label: "Can't decide", onPress: onCantDecide };
  const second = armed ? { label: CANCEL_LABEL, onPress: onCancel } : { label: ARM_LABEL, onPress: onArm };
  const half = [styles.half, useWindowDimensions().width < NARROW_WINDOW && styles.halfNarrow];

  return (
    <View style={styles.footprint}>
      <View style={[styles.pill, armed && styles.pillArmed]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={first.label}
          onPress={first.onPress}
          style={[half, armed && styles.halfArmed]}
        >
          <Text style={[styles.text, armed && styles.textArmed]}>{first.label}</Text>
          <Widest labels={firstLabels} />
        </Pressable>
        <View style={[styles.divider, armed && styles.dividerArmed]} aria-hidden />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={second.label}
          onPress={second.onPress}
          style={half}
        >
          <Text style={styles.text}>{second.label}</Text>
          <Widest labels={[ARM_LABEL, CANCEL_LABEL]} />
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Every label a half can show, at no height: the half takes the widest one's
 * width, so changing its label never resizes it. Hidden from screen readers,
 * which read the half's own label.
 */
function Widest({ labels }: { labels: string[] }) {
  return (
    <View style={styles.widest} aria-hidden dataSet={{ widest: 'true' }}>
      {labels.map((label) => (
        <Text key={label} style={styles.text}>
          {label}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Never wider than the row it sits in; what does not fit is shared out below.
  footprint: { flexDirection: 'row', alignItems: 'stretch', flexShrink: 1, maxWidth: '100%' },
  pill: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'stretch',
    overflow: 'hidden',
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillArmed: { borderColor: colors.accent },
  half: {
    flexShrink: 1,
    minWidth: 0,
    justifyContent: 'center',
    paddingVertical: space.sm,
    paddingHorizontal: space.lg,
  },
  halfNarrow: { paddingHorizontal: space.sm },
  halfArmed: { backgroundColor: colors.accentSoft },
  widest: { height: 0, overflow: 'hidden' },
  divider: { width: 1, backgroundColor: colors.border },
  dividerArmed: { backgroundColor: colors.accent },
  text: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
    color: colors.textSecondary,
  },
  textArmed: { color: colors.accentStrong },
});
