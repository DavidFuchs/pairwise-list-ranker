import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { ObjectSchemaHint, LabelFieldCandidate } from '@/lib/import/labelField';

export interface LabelPickerProps {
  candidates: LabelFieldCandidate[];
  schema: ObjectSchemaHint;
  value?: string;
  onChange: (field: string) => void;
}

/**
 * Object lists need a label field before ranking can start. When no safe
 * default exists the app asks here, showing what each choice would look like.
 */
export function LabelPicker({ candidates, schema, value, onChange }: LabelPickerProps) {
  if (candidates.length === 0) {
    return (
      <View style={styles.panel} dataSet={{ surface: 'panel' }}>
        <Text style={styles.heading}>Label field</Text>
        <Text style={styles.prompt}>
          No fields on these objects can be used as a label. Import objects with a text or number
          field.
        </Text>
      </View>
    );
  }

  const hiddenFields = schema.fields.filter((field) => !field.labelCandidate).length;

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.heading}>Label field</Text>

      {value === undefined && (
        <Text style={styles.prompt}>Choose which field should title each card.</Text>
      )}

      <View style={styles.options}>
        {candidates.map((candidate) => {
          const selected = candidate.field === value;
          return (
            <Pressable
              key={candidate.field}
              accessibilityRole="button"
              accessibilityLabel={`Label items by ${candidate.field}`}
              aria-pressed={selected}
              onPress={() => onChange(candidate.field)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <View style={styles.optionHeader}>
                <Text style={[styles.field, selected && styles.fieldSelected]}>
                  {candidate.field}
                </Text>
                {candidate.coverage < 1 && (
                  <Text style={styles.warning}>
                    {`${Math.round(candidate.coverage * schema.itemCount)} of ${schema.itemCount} items`}
                  </Text>
                )}
              </View>
              <Text style={styles.samples} numberOfLines={1}>
                {candidate.samples.join(' · ')}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {hiddenFields > 0 && (
        <Text style={styles.footnote}>
          {`${hiddenFields} more ${hiddenFields === 1 ? 'field is' : 'fields are'} kept on each item and exported, but cannot be a label.`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  prompt: { fontFamily: fonts.body, fontSize: 13, color: colors.accentStrong },
  options: { gap: space.xs },
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
  optionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  field: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  fieldSelected: { color: colors.accentStrong },
  warning: { fontFamily: fonts.body, fontSize: 11, color: colors.warningText },
  samples: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  footnote: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
});
