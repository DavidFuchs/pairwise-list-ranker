import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { readTextFile } from '@/lib/browser/fileText';

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
  /**
   * A chosen file, when it should be told apart from typing - a saved session,
   * say. Defaults to reading it as text into onChange, leaving out a file that
   * is not text.
   */
  onFile?: (file: File) => void;
  override: FormatOverride;
  onOverrideChange: (next: FormatOverride) => void;
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

export function SourceInput({
  value,
  onChange,
  onFile,
  onSample,
  override,
  onOverrideChange,
  issues,
  availableOverrides = OVERRIDES.map((option) => option.key),
}: SourceInputProps) {
  const visibleOverrides = OVERRIDES.filter((option) => availableOverrides.includes(option.key));
  const [samplesOpen, setSamplesOpen] = useState(false);

  // An open menu is dismissed by Escape or a press anywhere outside it.
  useEffect(() => {
    if (!samplesOpen || Platform.OS !== 'web') return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSamplesOpen(false);
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-sample-menu]') == null) setSamplesOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [samplesOpen]);
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title} role="heading" aria-level={2}>
            Add your list
          </Text>
          <Text style={styles.subtitle}>
            Paste it, type it, or drop a file. One item per line, or any YAML or JSON.
          </Text>
        </View>

        {/* One control rather than a chip per sample: the chips, each with its
            own description, wrapped to several lines on a laptop. */}
        <View style={styles.samples} dataSet={{ sampleMenu: 'true' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Try a sample list"
            aria-expanded={samplesOpen}
            onPress={() => setSamplesOpen(!samplesOpen)}
            style={styles.samplesToggle}
          >
            <Text style={styles.sampleLabel}>Try a sample</Text>
            <Text style={styles.sampleDetail}>{samplesOpen ? '▴' : '▾'}</Text>
          </Pressable>
          {samplesOpen && (
            <View style={styles.samplesMenu} role="menu">
              {SAMPLES.map((sample) => (
                <Pressable
                  key={sample.id}
                  role="menuitem"
                  accessibilityLabel={`Load the ${sample.label.toLowerCase()} sample`}
                  accessibilityHint={`Replaces the text below with ${sample.detail}`}
                  onPress={() => {
                    setSamplesOpen(false);
                    if (onSample === undefined) onChange(sample.text);
                    else onSample(sample);
                  }}
                  dataSet={{ sample: 'button' }}
                  style={styles.sampleChoice}
                >
                  <Text style={styles.sampleLabel}>{sample.label}</Text>
                  <Text style={styles.sampleDetail}>{sample.detail}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
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
        <FileDrop
          onFile={
            onFile ??
            ((file) =>
              void readTextFile(file).then((read) => {
                if ('text' in read) onChange(read.text);
              }))
          }
        />

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
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: space.sm,
    // Above the editor, so the open sample menu floats over it.
    zIndex: 1,
  },
  headerText: { gap: 2, flexShrink: 1 },
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
  samples: { position: 'relative' },
  samplesToggle: {
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
  // Floats over the editor instead of pushing it down.
  samplesMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    marginTop: space.xs,
    minWidth: 280,
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    boxShadow: '0 12px 28px -12px rgba(16, 17, 20, 0.35)',
  },
  sampleChoice: {
    flexDirection: 'column',
    gap: 2,
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
  },
  sampleLabel: { fontFamily: fonts.body, fontSize: 12, fontWeight: '600', color: colors.textPrimary },
  sampleDetail: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
  issue: { fontFamily: fonts.body, fontSize: 13, color: colors.dangerText },
});
