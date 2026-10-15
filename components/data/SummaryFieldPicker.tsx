import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { ObjectSchemaHint } from '@/lib/import/labelField';
import { MAX_SUMMARY_FIELDS } from '@/types/source';

export interface SummaryFieldPickerProps {
  schema: ObjectSchemaHint;
  /** The title field, which is already on the card and so is not offered. */
  labelField: string;
  value: string[];
  onChange: (fields: string[]) => void;
}

/**
 * Which fields every comparison card shows under its title. Left empty, each
 * card picks whatever short fields it happens to have, so two cards in a pair
 * can disagree; choosing here makes them show the same ones.
 */
export function SummaryFieldPicker({ schema, labelField, value, onChange }: SummaryFieldPickerProps) {
  const fields = schema.fields.filter((field) => field.field !== labelField);
  if (fields.length === 0) return null;

  const full = value.length >= MAX_SUMMARY_FIELDS;

  const toggle = (field: string) => {
    if (value.includes(field)) onChange(value.filter((entry) => entry !== field));
    else if (!full) onChange([...value, field]);
  };

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.heading}>Card details</Text>
      <Text style={styles.prompt}>
        {`Choose up to ${MAX_SUMMARY_FIELDS} fields to always show on each card while ranking.`}
      </Text>

      <View style={styles.options}>
        {fields.map((field) => {
          const selected = value.includes(field.field);
          const disabled = full && !selected;
          const order = value.indexOf(field.field) + 1;
          return (
            <Pressable
              key={field.field}
              accessibilityRole="button"
              accessibilityLabel={`Show ${field.field} on cards`}
              aria-pressed={selected}
              disabled={disabled}
              onPress={() => toggle(field.field)}
              style={[styles.option, selected && styles.optionSelected, disabled && styles.disabled]}
            >
              <Text style={[styles.field, selected && styles.fieldSelected]}>
                {selected ? `${order}. ${field.field}` : field.field}
              </Text>
              {field.coverage < 1 && (
                <Text style={styles.warning}>{`${Math.round(field.coverage * 100)}%`}</Text>
              )}
            </Pressable>
          );
        })}
      </View>
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
  prompt: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  disabled: { opacity: 0.45 },
  field: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  fieldSelected: { color: colors.accentStrong, fontWeight: '600' },
  warning: { fontFamily: fonts.body, fontSize: 11, color: colors.warningText },
});
