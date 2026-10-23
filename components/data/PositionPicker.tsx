import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PositionFieldCandidate } from '@/lib/import/positionField';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface PositionPickerProps {
  candidates: PositionFieldCandidate[];
  value?: string;
  onChange: (field: string | undefined) => void;
}

/**
 * The optional second role: a field to rewrite with 1..N on export. Opt-in,
 * because writing into the user's data is a bigger promise than reordering it.
 */
export function PositionPicker({ candidates, value, onChange }: PositionPickerProps) {
  if (candidates.length === 0) return null;

  return (
    <View style={styles.group} role="radiogroup" aria-label="Where to write the new order">
      <Text style={styles.heading} role="heading" aria-level={3}>
        Write the new order into
      </Text>
      <Text style={styles.hint}>
        Optional. The order of the list carries the ranking either way, but you can explicitly write the order
        into a field of your choice.
      </Text>

      <View style={styles.options}>
        <Pressable
          role="radio"
          accessibilityLabel="Do not write the order into any field"
          aria-checked={value === undefined}
          onPress={() => onChange(undefined)}
          style={[styles.option, value === undefined && styles.optionSelected]}
        >
          <Text style={[styles.field, value === undefined && styles.fieldSelected]}>None</Text>
        </Pressable>

        {candidates.map((candidate) => {
          const selected = candidate.field === value;

          return (
            <Pressable
              key={candidate.field}
              role="radio"
              accessibilityLabel={`Write the new order into ${candidate.field}`}
              aria-checked={selected}
              onPress={() => onChange(candidate.field)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.field, selected && styles.fieldSelected]}>{candidate.field}</Text>
            </Pressable>
          );
        })}
      </View>
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
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  field: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  fieldSelected: { color: colors.accentStrong, fontWeight: '600' },
});
