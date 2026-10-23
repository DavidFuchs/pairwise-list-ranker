import { StyleSheet, Text, View } from 'react-native';
import { stringify as stringifyYaml } from 'yaml';

import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ComplexItemValue } from '@/types/list';

export interface ObjectDrilldownProps {
  value: ComplexItemValue;
  /** The field already shown as the card title, so it is not repeated here. */
  omitField?: string;
}

/**
 * The expanded detail region of a comparison card: every field that is not the
 * label, with nested structures rendered as YAML rather than flattened away.
 */
export function ObjectDrilldown({ value, omitField }: ObjectDrilldownProps) {
  const fields = Object.entries(value).filter(([key]) => key !== omitField);

  if (fields.length === 0) {
    return <Text style={styles.placeholder}>No other fields on this item.</Text>;
  }

  return (
    <View style={styles.details}>
      {fields.map(([key, entry]) => (
        <View key={key} style={styles.row}>
          <Text style={styles.key}>{key}</Text>
          {renderValue(entry)}
        </View>
      ))}
    </View>
  );
}

function renderValue(entry: unknown) {
  if (entry === null || entry === undefined) {
    return <Text style={styles.placeholder}>None</Text>;
  }

  if (typeof entry === 'string') {
    return entry.trim() === '' ? (
      <Text style={styles.placeholder}>Empty</Text>
    ) : (
      <Text style={styles.value}>{entry}</Text>
    );
  }

  if (typeof entry === 'number' || typeof entry === 'boolean') {
    return <Text style={styles.value}>{String(entry)}</Text>;
  }

  return <Text style={styles.code}>{stringifyYaml(entry, { lineWidth: 0 }).trimEnd()}</Text>;
}

const styles = StyleSheet.create({
  details: { gap: space.sm },
  row: { gap: 2 },
  key: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.textSecondary,
  },
  value: {
    ...typeScale.body,
    fontSize: 14,
    lineHeight: 20,
    fontFamily: fonts.body,
    color: colors.textPrimary,
  },
  placeholder: {
    fontFamily: fonts.body,
    fontSize: 13,
    fontStyle: 'italic',
    color: colors.textSecondary,
  },
  code: {
    ...typeScale.code,
    fontFamily: fonts.mono,
    color: colors.textPrimary,
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.sm,
    padding: space.sm,
  },
});
