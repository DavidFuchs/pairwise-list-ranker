import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, space } from '@/lib/theme';

/** Something to say about a file just opened, or a question to ask before using it. */
export type FileNoticeState =
  | { message: string }
  | {
      confirm: string;
      onConfirm: () => void;
      /** The confirming button, and how it is spoken; a saved session by default. */
      confirmLabel?: string;
      confirmAccessibilityLabel?: string;
    };

export interface FileNoticeProps {
  notice: FileNoticeState;
  onDismiss: () => void;
}

/** Sits under the source box, where the file it is about was just dropped or chosen. */
export function FileNotice({ notice, onDismiss }: FileNoticeProps) {
  const asking = 'confirm' in notice;
  return (
    <View style={[styles.notice, asking && styles.asking]} accessibilityRole="alert">
      <Text style={[styles.text, asking && styles.askingText]}>
        {asking ? notice.confirm : notice.message}
      </Text>
      <View style={styles.actions}>
        {asking ? (
          <>
            <Button label="Keep current" variant="ghost" size="sm" onPress={onDismiss} />
            <Button
              label={notice.confirmLabel ?? 'Replace'}
              accessibilityLabel={notice.confirmAccessibilityLabel ?? 'Replace with the saved session'}
              variant="dangerStrong"
              size="sm"
              onPress={notice.onConfirm}
            />
          </>
        ) : (
          <Button label="OK" accessibilityLabel="Dismiss" variant="ghost" size="sm" onPress={onDismiss} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  asking: { borderColor: colors.dangerSoftBorder, backgroundColor: colors.dangerSoft },
  text: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  askingText: { color: colors.dangerText },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.sm },
});
