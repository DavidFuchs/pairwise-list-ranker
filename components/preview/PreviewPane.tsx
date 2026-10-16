import { StyleSheet, Text, View } from 'react-native';

import { ExportToolbar } from '@/components/preview/ExportToolbar';
import { ProgressFileControls } from '@/components/preview/ProgressFileControls';
import type { ProgressFileControlsProps } from '@/components/preview/ProgressFileControls';
import { PreviewTabs } from '@/components/preview/PreviewTabs';
import { RankedListPreview } from '@/components/preview/RankedListPreview';
import { ReadOnlyCode } from '@/components/preview/ReadOnlyCode';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';
import type { PreviewTab, SourceFormat } from '@/types/source';

export interface PreviewPaneProps {
  tab: PreviewTab;
  tabs: PreviewTab[];
  onTabChange: (tab: PreviewTab) => void;
  ranking: RankedItem<ListItem>[];
  labelField?: string;
  summaryFields?: string[];
  previewField?: string;
  /** The user's document, ranked and serialized for the active tab. */
  exportText: string;
  filename: string;
  format: SourceFormat;
  /** Items deleted during comparison, which the export leaves out. */
  removedCount: number;
  onReorder: (itemId: string, nextOrder: string[]) => void;
  /** When given, the pane offers saving and loading a progress file. */
  progressFile?: ProgressFileControlsProps;
}

/**
 * Read-only by design. Editing happens on the data screen, where re-importing
 * is an explicit act with a summary, rather than a buffer that may or may not
 * have been applied.
 */
export function PreviewPane({
  tab,
  tabs,
  onTabChange,
  ranking,
  labelField,
  summaryFields,
  previewField,
  exportText,
  filename,
  format,
  removedCount,
  onReorder,
  progressFile,
}: PreviewPaneProps) {
  return (
    <View style={styles.pane} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Your data</Text>
        <Text style={styles.subtitle}>
          {tab === 'ranked' ? 'Drag a row to arrange it' : 'Your document, in the new order'}
        </Text>
      </View>

      {removedCount > 0 && (
        <Text style={styles.removed}>
          {`${removedCount} removed ${removedCount === 1 ? 'item is' : 'items are'} excluded from the export.`}
        </Text>
      )}

      <PreviewTabs tab={tab} tabs={tabs} onChange={onTabChange} />

      {progressFile !== undefined && <ProgressFileControls {...progressFile} />}

      {tab === 'ranked' ? (
        <View style={styles.body} accessibilityLabel="Current ranking" role="region">
          <RankedListPreview ranking={ranking} sortField={labelField} summaryFields={summaryFields} previewField={previewField} onReorder={onReorder} />
        </View>
      ) : (
        <View style={styles.body}>
          <ExportToolbar format={format} text={exportText} filename={filename} />
          <ReadOnlyCode text={exportText} label={`${format} export`} />
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
  removed: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  body: { flex: 1, gap: space.md, minHeight: 260 },
});
