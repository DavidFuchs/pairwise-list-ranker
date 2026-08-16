import { StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ParseIssue } from '@/lib/validation/listSchemas';
import type { TextFormat } from '@/types/list';

export interface TextFormatEditorProps {
  format: TextFormat;
  value: string;
  onChange: (text: string) => void;
  issues: ParseIssue[];
}

/**
 * A decoupled text buffer: editing here never touches the live list. Parse
 * problems are reported next to the text, and the text is never rewritten out
 * from under the user.
 */
export function TextFormatEditor({ format, value, onChange, issues }: TextFormatEditorProps) {
  return (
    <View style={styles.container}>
      <TextInput
        multiline
        value={value}
        onChangeText={onChange}
        accessibilityLabel={`${format} source`}
        spellCheck={false}
        autoCapitalize="none"
        autoCorrect={false}
        style={[styles.input, issues.length > 0 && styles.inputInvalid]}
        dataSet={{ surface: 'sunken' }}
      />

      {issues.length > 0 && (
        <View style={styles.issues} accessibilityRole="alert">
          {issues.map((issue, index) => (
            <Text key={`${issue.path}-${index}`} style={styles.issue}>
              {formatIssue(issue)}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

function formatIssue(issue: ParseIssue): string {
  const where = issue.line !== undefined ? `Line ${issue.line}` : issue.path;
  return where === '' ? issue.message : `${where}: ${issue.message}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: space.sm },
  input: {
    flex: 1,
    minHeight: 240,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    color: colors.textPrimary,
    ...typeScale.code,
    fontFamily: fonts.mono,
    textAlignVertical: 'top',
  },
  inputInvalid: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  issues: {
    gap: space.xs,
    padding: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.dangerSoftBorder,
    backgroundColor: colors.dangerSoft,
  },
  issue: {
    fontFamily: fonts.mono,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dangerText,
  },
});
