import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { copyText, downloadText } from '@/lib/browser/exportActions';
import { mimeTypeFor } from '@/lib/export/filenames';
import { colors, fonts, space } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export interface ExportToolbarProps {
  format: SourceFormat;
  text: string;
  filename: string;
}

const FEEDBACK_MS = 1800;

/** Copy and download only. Editing happens on the data screen, not here. */
export function ExportToolbar({ format, text, filename }: ExportToolbarProps) {
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
          accessibilityLabel={`Copy the ${format} to the clipboard`}
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
  filename: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
