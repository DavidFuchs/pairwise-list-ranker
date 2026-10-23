import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { TAB_LABELS } from '@/components/preview/PreviewTabs';
import { downloadText } from '@/lib/browser/exportActions';
import { exportFilename, mimeTypeFor } from '@/lib/export/filenames';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export interface DownloadButtonProps {
  /** What the main button downloads. */
  format: SourceFormat;
  /** Every format the document can be taken away in, the main one included. */
  formats: SourceFormat[];
  /**
   * The file's contents for a format, made when asked: serializing a large
   * document on every comparison would be wasted on a view that shows a list.
   */
  getText: (format: SourceFormat) => string;
}

const FEEDBACK_MS = 1800;

/** Mid-sentence, so the plain list is not capitalized as its tab is. */
function formatName(format: SourceFormat): string {
  return format === 'list' ? 'plain list' : TAB_LABELS[format];
}

/**
 * Taking the result away: the user's own document with the list in its new
 * order. The main button names the format it downloads; the caret beside it
 * offers the others, laid out as the field picker's drawing menu is.
 */
export function DownloadButton({ format, formats, getText }: DownloadButtonProps) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  const download = (chosen: SourceFormat) => {
    const ok = downloadText(exportFilename(chosen), getText(chosen), mimeTypeFor(chosen));
    setFeedback(ok ? 'Downloaded' : 'Download unavailable');
    setOpen(false);
  };

  const hasMenu = formats.length > 1;

  return (
    <View style={styles.container}>
      <View style={styles.split}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Download ${formatName(format)} as ${exportFilename(format)}`}
          dataSet={{ fill: 'accent' }}
          onPress={() => download(format)}
          style={[styles.main, !hasMenu && styles.mainAlone]}
        >
          <Text style={styles.label} role={feedback === null ? undefined : 'status'}>
            {feedback ?? `Download ${formatName(format)}`}
          </Text>
        </Pressable>
        {hasMenu && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Choose a download format"
            aria-expanded={open}
            dataSet={{ fill: 'accent' }}
            onPress={() => setOpen(!open)}
            style={styles.caret}
          >
            <Text style={styles.glyph}>{open ? '▴' : '▾'}</Text>
          </Pressable>
        )}
      </View>

      {open && hasMenu && (
        <View style={styles.menu} role="menu">
          {formats.map((option) => (
            <Pressable
              key={option}
              role="menuitem"
              accessibilityLabel={`Download ${formatName(option)}`}
              onPress={() => download(option)}
              style={[styles.choice, option === format && styles.choiceActive]}
            >
              <Text style={styles.choiceName}>{TAB_LABELS[option]}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  split: { flexDirection: 'row', alignItems: 'stretch' },
  main: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    borderWidth: 1,
    borderColor: colors.accentStrong,
    borderTopLeftRadius: radius.md,
    borderBottomLeftRadius: radius.md,
    backgroundColor: colors.accent,
    userSelect: 'none',
  },
  mainAlone: { borderTopRightRadius: radius.md, borderBottomRightRadius: radius.md },
  caret: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderLeftColor: colors.accentContrast,
    borderColor: colors.accentStrong,
    borderTopRightRadius: radius.md,
    borderBottomRightRadius: radius.md,
    backgroundColor: colors.accent,
    userSelect: 'none',
  },
  label: { fontFamily: fonts.body, fontSize: 14, lineHeight: 18, fontWeight: '600', color: colors.surface },
  glyph: { fontFamily: fonts.body, fontSize: 15, color: colors.surface },
  menu: {
    gap: space.xs,
    padding: space.sm,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  choice: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  choiceActive: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  choiceName: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
});
