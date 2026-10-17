import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { copyText, downloadText } from '@/lib/browser/exportActions';
import { mimeTypeFor } from '@/lib/export/filenames';
import { colors, fonts, space } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export interface ExportToolbarProps {
  format: SourceFormat;
  /**
   * The file's contents, or a way to make them when asked: serializing a large
   * document on every comparison would be wasted on a view that shows a list.
   */
  text: string | (() => string);
  filename: string;
}

const FEEDBACK_MS = 1800;

/**
 * Taking the result away: the user's own document with the list in its new
 * order. Download leads, since a file is what most people came for; editing
 * happens on the data screen, not here.
 */
export function ExportToolbar({ format, text, filename }: ExportToolbarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const contents = () => (typeof text === 'function' ? text() : text);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button
          label="Download ranked list"
          accessibilityLabel={`Download ranked list as ${filename}`}
          variant="primary"
          size="sm"
          onPress={() => {
            const ok = downloadText(filename, contents(), mimeTypeFor(format));
            setFeedback(ok ? 'Downloaded' : 'Download unavailable');
          }}
        />
        <Button
          label="Copy"
          accessibilityLabel={`Copy the ranked ${format} to the clipboard`}
          variant="secondary"
          size="sm"
          onPress={() => {
            void copyText(contents()).then((ok) => setFeedback(ok ? 'Copied' : 'Copy unavailable'));
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
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  filename: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
