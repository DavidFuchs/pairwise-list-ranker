import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPath } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ArrayPickerProps {
  candidates: ArrayCandidate[];
  value: string[] | null;
  onChange: (path: string[]) => void;
}

/**
 * Only asked when the document holds more than one rankable list. A single
 * candidate is chosen for the user, so the common case shows no control.
 */
export function ArrayPicker({ candidates, value, onChange }: ArrayPickerProps) {
  if (candidates.length < 2) return null;

  const selectedKey = value === null ? null : value.join('.');

  return (
    <View style={styles.group} role="radiogroup" aria-label="Which list to rank">
      <Text style={styles.heading}>Rank which list?</Text>

      {candidates.map((candidate) => {
        const key = candidate.path.join('.');
        const selected = key === selectedKey;

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
          </Pressable>
        );
      })}
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
});
