import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

const SAMPLES: { label: string; body: string }[] = [
  {
    label: 'YAML',
    body: '- Tacos\n- Ramen\n- Curry',
  },
  {
    label: 'JSON',
    body: '[{"title": "Arrival", "year": 2016}]',
  },
  {
    label: 'Markdown',
    body: '# Dinners\n\n- Tacos\n- Ramen',
  },
];

/** First-run onboarding: everything starts from pasted or imported data. */
export function EmptyState() {
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.title}>Start with a list</Text>
      <Text style={styles.body}>
        Paste a list into the YAML, JSON, or Markdown tab of the preview pane, then press Import.
        Simple lists of text and lists of objects both work.
      </Text>

      <View style={styles.samples}>
        {SAMPLES.map((sample) => (
          <View key={sample.label} style={styles.sample}>
            <Text style={styles.sampleLabel}>{sample.label}</Text>
            <Text style={styles.sampleBody}>{sample.body}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.footnote}>
        Everything stays in this browser. Exporting a file is how you keep or move your ranking.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  title: {
    ...typeScale.appTitle,
    fontSize: 26,
    lineHeight: 30,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  body: { ...typeScale.body, fontFamily: fonts.body, color: colors.textSecondary, maxWidth: 560 },
  samples: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  sample: {
    flexGrow: 1,
    flexBasis: 160,
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  sampleLabel: {
    fontFamily: fonts.mono,
    fontSize: 10,
    letterSpacing: 1,
    color: colors.textSecondary,
  },
  sampleBody: { fontFamily: fonts.mono, fontSize: 12, lineHeight: 18, color: colors.textPrimary },
  footnote: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
