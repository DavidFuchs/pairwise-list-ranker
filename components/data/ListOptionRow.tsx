import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPath, MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { describeAnswers } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ListOptionRowProps {
  candidate: ArrayCandidate;
  selected: boolean;
  onPress: () => void;
  /** Answers given on this list so far; nothing is said until there is one. */
  answers?: number;
  /** e.g. "shown by title · already ranked" - what ranking it would get. */
  configLine?: string;
  /** Replaces the item count, for a row that has something better to say. */
  meta?: string;
  /**
   * A control beside the row, such as the switcher's Configure button. It is
   * a sibling of the Pressable rather than a child, so pressing it cannot also
   * count as pressing the row.
   */
  action?: ReactNode;
}

/**
 * One list the document offers, as shown by both pickers: the setup screen's
 * ArrayPicker and the toolbar's ListSwitcher. Keeping it in one place is what
 * makes the two read alike - the switcher is the same row with a Configure
 * button beside it.
 */
export function ListOptionRow({
  candidate,
  selected,
  onPress,
  answers,
  configLine,
  meta,
  action,
}: ListOptionRowProps) {
  const name = formatPath(candidate.path);
  const rankable = candidate.count >= MIN_RANKABLE;
  const countText = `${candidate.count} ${candidate.entryKind === 'object' ? 'objects' : 'texts'}`;

  return (
    <View style={[styles.row, selected && styles.rowSelected, !rankable && styles.rowDisabled]}>
      <Pressable
        role="radio"
        accessibilityLabel={rankable ? `Rank the list at ${name}` : `${name} has too few items to rank`}
        accessibilityState={{ disabled: !rankable }}
        aria-checked={selected}
        disabled={!rankable}
        onPress={onPress}
        style={styles.body}
      >
        <View style={styles.header}>
          <Text style={[styles.path, selected && styles.pathSelected]}>{name}</Text>
          <Text style={styles.meta}>{rankable ? (meta ?? countText) : 'Too few items to rank'}</Text>
        </View>
        {candidate.samples.length > 0 && (
          <Text style={styles.samples} numberOfLines={1}>
            {candidate.samples.join(' · ')}
          </Text>
        )}
        {configLine !== undefined && configLine !== '' && (
          <Text style={styles.config} numberOfLines={1}>
            {configLine}
          </Text>
        )}
        {answers !== undefined && answers > 0 && (
          <Text style={styles.answers}>{describeAnswers(answers)}</Text>
        )}
      </Pressable>
      {action !== undefined && <View style={styles.action}>{action}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    overflow: 'hidden',
  },
  rowSelected: {
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  rowDisabled: { opacity: 0.45 },
  body: {
    flex: 1,
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  path: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  pathSelected: { color: colors.accentStrong },
  meta: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  samples: {
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  config: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  answers: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textFaint,
    marginTop: 2,
  },
  action: {
    justifyContent: 'center',
    paddingRight: space.md,
    paddingLeft: space.sm,
  },
});
