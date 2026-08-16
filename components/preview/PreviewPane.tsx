import { StyleSheet, Text, View } from 'react-native';

import { FormatTabs } from '@/components/editor/FormatTabs';
import { ImportToolbar } from '@/components/editor/ImportToolbar';
import { TextFormatEditor } from '@/components/editor/TextFormatEditor';
import { RankedListPreview } from '@/components/preview/RankedListPreview';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ParseIssue } from '@/lib/validation/listSchemas';
import type { ExportFormat, ListItem, TextFormat } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

export interface PreviewPaneProps {
  mode: ExportFormat;
  onModeChange: (mode: ExportFormat) => void;
  ranking: RankedItem<ListItem>[];
  sortField?: string;
  /** The current list serialized in the active text format. */
  exportText: string;
  filename: string;
  /** Unsaved editor text, if the user has typed something. */
  draft?: string;
  onDraftChange: (text: string) => void;
  onApply: () => void;
  issues: ParseIssue[];
}

export function PreviewPane({
  mode,
  onModeChange,
  ranking,
  sortField,
  exportText,
  filename,
  draft,
  onDraftChange,
  onApply,
  issues,
}: PreviewPaneProps) {
  const isTextMode = mode !== 'gui';

  return (
    <View style={styles.pane} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Preview</Text>
        <Text style={styles.subtitle}>
          {isTextMode ? 'Edit and import, or copy and download' : 'Live ranking · not exportable'}
        </Text>
      </View>

      <FormatTabs mode={mode} onChange={onModeChange} />

      {isTextMode ? (
        <View style={styles.body}>
          <ImportToolbar
            format={mode as TextFormat}
            text={draft ?? exportText}
            filename={filename}
            canApply={draft !== undefined}
            onApply={onApply}
          />
          <TextFormatEditor
            format={mode as TextFormat}
            value={draft ?? exportText}
            onChange={onDraftChange}
            issues={issues}
          />
        </View>
      ) : (
        <View style={styles.body} accessibilityLabel="Current ranking" role="region">
          <RankedListPreview ranking={ranking} sortField={sortField} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
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
  body: { flex: 1, gap: space.md, minHeight: 260 },
});
