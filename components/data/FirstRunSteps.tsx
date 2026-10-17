import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

const STEPS: [title: string, body: string][] = [
  ['Add a list', 'Paste it, type it, drop a file, or try a sample. Plain lines, YAML and JSON all work.'],
  ['Pick between two', 'Each round shows two items. Choose the better one; the order sharpens as you go.'],
  ['Take it away', 'Download your document with the list in its new order, in the format it came in.'],
];

/**
 * What the app is for, said where the first screen would otherwise be empty:
 * the panel that fills in once there is a list to read.
 */
export function FirstRunSteps() {
  return (
    <View style={styles.container}>
      <Text style={styles.lead}>
        Pairwise puts a list in order by asking you about two items at a time, instead of sorting the whole
        thing at once.
      </Text>
      {STEPS.map(([title, body], index) => (
        <View key={title} style={styles.step}>
          <View style={styles.number}>
            <Text style={styles.numberText}>{index + 1}</Text>
          </View>
          <View style={styles.stepBody}>
            <Text style={styles.stepTitle}>{title}</Text>
            <Text style={styles.stepText}>{body}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.md },
  lead: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, color: colors.textPrimary },
  step: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  number: {
    width: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
  },
  numberText: { fontFamily: fonts.mono, fontSize: 12, fontWeight: '600', color: colors.accentStrong },
  stepBody: { flex: 1, gap: 2 },
  stepTitle: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  stepText: { fontFamily: fonts.body, fontSize: 12, lineHeight: 17, color: colors.textSecondary },
});
