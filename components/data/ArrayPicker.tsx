import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ProgressMeter } from '@/components/ui/ProgressMeter';
import { formatPath } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { describeCoverage } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ArrayPickerProps {
  candidates: ArrayCandidate[];
  value: string[] | null;
  onChange: (path: string[]) => void;
  /** Path key ("a.b", joined with ".") to ranking coverage for every
   *  candidate that already has progress behind it - each list in the
   *  document keeps its own, so more than one can show a meter. */
  rankedCoverages?: Record<string, number>;
}

/**
 * Only asked when the document holds more than one rankable list. A single
 * candidate is chosen for the user, so the common case shows no control.
 */
export function ArrayPicker({
  candidates,
  value,
  onChange,
  rankedCoverages = {},
}: ArrayPickerProps) {
  if (candidates.length < 2) return null;

  const selectedKey = value === null ? null : value.join('.');

  return (
    <View style={styles.group} role="radiogroup" aria-label="Which list to rank">
      <Text style={styles.heading}>Rank which list?</Text>

      {candidates.map((candidate) => {
        const key = candidate.path.join('.');
        const selected = key === selectedKey;
        const coverage = rankedCoverages[key];

        return (
          <Pressable
            key={key}
            role="radio"
            accessibilityLabel={`Rank the list at ${formatPath(candidate.path)}`}
            aria-checked={selected}
            onPress={() => onChange(candidate.path)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <View style={styles.header}>
              <Text style={[styles.path, selected && styles.pathSelected]}>
                {formatPath(candidate.path)}
              </Text>
              <Text style={styles.count}>
                {`${candidate.count} ${candidate.entryKind === 'object' ? 'objects' : 'texts'}`}
              </Text>
            </View>
            <Text style={styles.samples} numberOfLines={1}>
              {candidate.samples.join(' · ')}
            </Text>
            {coverage !== undefined && (
              <View style={styles.progressRow}>
                <View style={styles.progressBar}>
                  <ProgressMeter
                    coverage={coverage}
                    accessibilityLabel={`Ranking progress for ${formatPath(candidate.path)}`}
                  />
                </View>
                <Text style={styles.progressLabel}>{describeCoverage(coverage).label}</Text>
              </View>
            )}
          </Pressable>
        );
      })}

      <Text style={styles.hint}>
        You can rank each list separately and switch between them anytime — on the ranking screen,
        click the list name in the top-left corner. Nothing is lost when you switch.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  option: {
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  path: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pathSelected: { color: colors.accentStrong },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  samples: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  progressBar: { flex: 1 },
  progressLabel: { fontFamily: fonts.mono, fontSize: 11, color: colors.textFaint },
  hint: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
