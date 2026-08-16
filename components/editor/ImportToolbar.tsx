import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { mimeTypeFor } from '@/lib/formats';
import { copyText, downloadText } from '@/lib/browser/exportActions';
import { colors, fonts, space } from '@/lib/theme';
import type { TextFormat } from '@/types/list';

export interface ImportToolbarProps {
  format: TextFormat;
  text: string;
  filename: string;
  canApply: boolean;
  onApply: () => void;
}

const FEEDBACK_MS = 1800;

export function ImportToolbar({ format, text, filename, canApply, onApply }: ImportToolbarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button
          label="Copy"
          accessibilityLabel={`Copy ${format} to the clipboard`}
          variant="secondary"
          size="sm"
          onPress={() => {
            void copyText(text).then((ok) => setFeedback(ok ? 'Copied' : 'Copy unavailable'));
          }}
        />
        <Button
          label="Download"
          accessibilityLabel={`Download ${filename}`}
          variant="secondary"
          size="sm"
          onPress={() => {
            const ok = downloadText(filename, text, mimeTypeFor(format));
            setFeedback(ok ? 'Downloaded' : 'Download unavailable');
          }}
        />
        <Button
          label="Import"
          accessibilityLabel={`Import the edited ${format}`}
          variant="primary"
          size="sm"
          disabled={!canApply}
          onPress={onApply}
        />
      </View>

      <Text style={styles.filename} numberOfLines={1}>
        {feedback ?? filename}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  filename: {
    fontFamily: fonts.mono,
    fontSize: 11,
    color: colors.textSecondary,
  },
});
