import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { ObjectSchemaHint } from '@/lib/import/labelField';
import { cleanRenderers, rendererOptionsFor } from '@/lib/renderers';
import { MAX_SUMMARY_FIELDS } from '@/types/source';
import type { FieldRenderer } from '@/types/source';

export interface SummaryFieldPickerProps {
  schema: ObjectSchemaHint;
  /** The title field, which is already on the card and so is not offered. */
  labelField: string;
  value: string[];
  renderers?: Record<string, FieldRenderer>;
  onChange: (fields: string[], renderers: Record<string, FieldRenderer> | undefined) => void;
}

/**
 * Which fields every comparison card shows under its title. Left empty, each
 * card picks whatever short fields it happens to have, so two cards in a pair
 * can disagree; choosing here makes them show the same ones.
 */
export function SummaryFieldPicker({
  schema,
  labelField,
  value,
  renderers,
  onChange,
}: SummaryFieldPickerProps) {
  const fields = schema.fields.filter((field) => field.field !== labelField);
  if (fields.length === 0) return null;

  const full = value.length >= MAX_SUMMARY_FIELDS;

  const toggle = (field: string) => {
    if (value.includes(field)) {
      const next = value.filter((entry) => entry !== field);
      onChange(next, cleanRenderers(renderers, next));
    } else if (!full) onChange([...value, field], renderers);
  };

  // Picking a special renderer implies showing the field, if there is room.
  const render = (field: string, renderer: FieldRenderer | undefined) => {
    const { [field]: _dropped, ...rest } = renderers ?? {};
    const nextRenderers = renderer === undefined ? rest : { ...rest, [field]: renderer };
    const next = value.includes(field) || full ? value : [...value, field];
    onChange(next, cleanRenderers(nextRenderers, next));
  };

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.heading}>Card details</Text>
      <Text style={styles.prompt}>
        {`Choose up to ${MAX_SUMMARY_FIELDS} fields to always show on each card while ranking, and how each is drawn.`}
      </Text>

      <View style={styles.rows}>
        {fields.map((field) => {
          const selected = value.includes(field.field);
          const disabled = full && !selected;
          const order = value.indexOf(field.field) + 1;
          const options = rendererOptionsFor(field.types);
          const current = renderers?.[field.field];
          return (
            <View key={field.field} style={styles.row}>
              <Pressable
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

              {options.length > 1 && (
                <View style={styles.renderers}>
                  <Text style={styles.renderLabel}>as</Text>
                  {options.map((option) => {
                    const active = option.id === current;
                    return (
                      <Pressable
                        key={option.id ?? 'default'}
                        accessibilityRole="button"
                        accessibilityLabel={`Draw ${field.field} as ${option.label}`}
                        aria-pressed={active}
                        disabled={disabled && option.id !== undefined}
                        onPress={() => render(field.field, option.id)}
                        style={[styles.renderer, active && styles.optionSelected]}
                      >
                        <Text style={[styles.rendererText, active && styles.fieldSelected]}>{option.label}</Text>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>
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
  rows: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  renderers: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
  renderLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  renderer: {
    paddingVertical: 2,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  rendererText: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
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
