import { createElement } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import type { SortFieldCandidate } from '@/lib/import/sortField';
import { colors, fonts, radius, space } from '@/lib/theme';

interface FieldSelectProps {
  value: string;
  fields: SortFieldCandidate[];
  onChange: (field: string) => void;
}

/**
 * The field to sort by. A native select on the web, like FileDrop's input (React
 * Native has no host component for one); elsewhere the fields are radios.
 */
export function FieldSelect({ value, fields, onChange }: FieldSelectProps) {
  if (Platform.OS !== 'web') {
    return (
      <View style={styles.fields} role="radiogroup" aria-label="Sort field">
        {fields.map((candidate) => {
          const checked = candidate.field === value;
          return (
            <Pressable
              key={candidate.field}
              role="radio"
              accessibilityLabel={candidate.field}
              aria-checked={checked}
              onPress={() => onChange(candidate.field)}
              style={[styles.field, checked && styles.fieldSelected]}
            >
              <Text style={[styles.label, checked && styles.labelSelected]}>{candidate.field}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }
  return createElement(
    'select',
    {
      'aria-label': 'Sort field',
      value,
      style: selectStyle,
      onChange: (event: { target: { value: string } }) => onChange(event.target.value),
    },
    fields.map((candidate) =>
      createElement('option', { key: candidate.field, value: candidate.field }, candidate.field),
    ),
  );
}

const selectStyle = {
  minWidth: 0,
  maxWidth: '100%',
  padding: `${space.xs}px ${space.sm}px`,
  borderRadius: radius.md,
  border: `1px solid ${colors.border}`,
  backgroundColor: colors.surfaceSunken,
  color: colors.textPrimary,
  fontFamily: fonts.mono,
  fontSize: 13,
};

const styles = StyleSheet.create({
  fields: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  field: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  fieldSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  label: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  labelSelected: { color: colors.accentStrong, fontWeight: '600' },
});
