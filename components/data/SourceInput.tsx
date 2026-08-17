import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FileDrop } from '@/components/data/FileDrop';
import type { ParseIssue } from '@/lib/import/types';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export type FormatOverride = SourceFormat | 'auto';

export interface SourceInputProps {
  value: string;
  onChange: (text: string) => void;
  override: FormatOverride;
  onOverrideChange: (next: FormatOverride) => void;
  /** The format actually in use, whether detected or forced. */
  format: SourceFormat;
  issues: ParseIssue[];
}

const OVERRIDES: { key: FormatOverride; label: string; accessibilityLabel: string }[] = [
  { key: 'auto', label: 'Auto', accessibilityLabel: 'Detect the format automatically' },
  { key: 'list', label: 'Plain list', accessibilityLabel: 'Read the text as a plain list' },
  { key: 'yaml', label: 'YAML', accessibilityLabel: 'Read the text as YAML' },
  { key: 'json', label: 'JSON', accessibilityLabel: 'Read the text as JSON' },
];

const FORMAT_NAMES: Record<SourceFormat, string> = {
  list: 'a plain list',
  yaml: 'YAML',
  json: 'JSON',
};

export function SourceInput({
  value,
  onChange,
  override,
  onOverrideChange,
  format,
  issues,
}: SourceInputProps) {
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Add your list</Text>
        <Text style={styles.subtitle}>
          Paste it, type it, or drop a file. One item per line, or any YAML or JSON.
        </Text>
      </View>

      <TextInput
        accessibilityLabel="Your list"
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={'Alien\nArrival\nSolaris'}
        placeholderTextColor={colors.textFaint}
        style={styles.editor}
      />

      <View style={styles.controls}>
        <FileDrop onFile={onChange} />

        <View style={styles.overrides} role="radiogroup" aria-label="How to read the text">
          {OVERRIDES.map((option) => {
            const selected = option.key === override;

            return (
              <Pressable
                key={option.key}
                role="radio"
                accessibilityLabel={option.accessibilityLabel}
                aria-checked={selected}
                onPress={() => onOverrideChange(option.key)}
                style={[styles.override, selected && styles.overrideSelected]}
              >
                <Text style={[styles.overrideLabel, selected && styles.overrideLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {value.trim() !== '' && issues.length === 0 && (
        <Text style={styles.detected}>{`Read as ${FORMAT_NAMES[format]}.`}</Text>
      )}

      {issues.map((issue, index) => (
        <Text key={`${issue.path}-${index}`} style={styles.issue}>
          {issue.line === undefined ? issue.message : `Line ${issue.line}: ${issue.message}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { gap: 2 },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  editor: {
    minHeight: 280,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  overrides: { flexDirection: 'row', gap: space.xs },
  override: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  overrideSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  overrideLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  overrideLabelSelected: { color: colors.accentStrong, fontWeight: '600' },
  detected: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  issue: { fontFamily: fonts.body, fontSize: 13, color: colors.dangerText },
});
