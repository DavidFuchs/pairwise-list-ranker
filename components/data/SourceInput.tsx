import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FileDrop } from '@/components/data/FileDrop';
import { SAMPLES } from '@/lib/import/sampleData';
import type { Sample } from '@/lib/import/sampleData';
import type { ParseIssue } from '@/lib/import/types';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export type FormatOverride = SourceFormat | 'auto';

export interface SourceInputProps {
  value: string;
  onChange: (text: string) => void;
  /** A sample was asked for. Defaults to treating its text like typing. */
  onSample?: (sample: Sample) => void;
  /** A chosen file's text, when it should be told apart from typing - a saved session, say. Defaults to onChange. */
  onFile?: (text: string) => void;
  override: FormatOverride;
  onOverrideChange: (next: FormatOverride) => void;
  /** The format actually in use, whether detected or forced. */
  format: SourceFormat;
  issues: ParseIssue[];
  /** Which format tabs the current data honestly supports. */
  availableOverrides?: FormatOverride[];
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
  onFile,
  onSample,
  override,
  onOverrideChange,
  format,
  issues,
  availableOverrides = OVERRIDES.map((option) => option.key),
}: SourceInputProps) {
  const visibleOverrides = OVERRIDES.filter((option) => availableOverrides.includes(option.key));
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Add your list</Text>
        <Text style={styles.subtitle}>
          Paste it, type it, or drop a file. One item per line, or any YAML or JSON.
        </Text>
      </View>

      {/* Named for what they load, so trying the app is one obvious step
          rather than a control hidden on a format tab. */}
      <View style={styles.samples}>
        <Text style={styles.samplesLabel}>No list handy? Try a sample:</Text>
        {SAMPLES.map((sample) => (
          <Pressable
            key={sample.id}
            accessibilityRole="button"
            accessibilityLabel={`Load the ${sample.label.toLowerCase()} sample`}
            accessibilityHint={`Replaces the text below with ${sample.detail}`}
            onPress={() => (onSample === undefined ? onChange(sample.text) : onSample(sample))}
            dataSet={{ sample: 'button' }}
            style={styles.sample}
          >
            <Text style={styles.sampleLabel}>{sample.label}</Text>
            <Text style={styles.sampleDetail}>{sample.detail}</Text>
          </Pressable>
        ))}
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
        <FileDrop onFile={onFile ?? onChange} />

        <View style={styles.overrides} role="radiogroup" aria-label="How to read the text">
          {visibleOverrides.map((option) => {
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
        <Text key={`${issue.path}-${index}`} role="alert" style={styles.issue}>
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
  // Takes whatever height the panel has left, so a long list has room to read.
  editor: {
    flex: 1,
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
  samples: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.sm },
  samplesLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  sample: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.xs,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  sampleLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  sampleDetail: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  detected: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  issue: { fontFamily: fonts.body, fontSize: 13, color: colors.dangerText },
});
