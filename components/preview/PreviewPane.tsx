import { StyleSheet, Text, View } from 'react-native';

import { ExportToolbar } from '@/components/preview/ExportToolbar';
import { SessionControls } from '@/components/preview/SessionControls';
import type { SessionControlsProps } from '@/components/preview/SessionControls';
import { PreviewTabs } from '@/components/preview/PreviewTabs';
import { RankedListPreview } from '@/components/preview/RankedListPreview';
import { ReadOnlyCode } from '@/components/preview/ReadOnlyCode';
import type { CardLayout } from '@/lib/renderers';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';
import type { PreviewTab, SourceFormat } from '@/types/source';

export interface PreviewPaneProps {
  tab: PreviewTab;
  tabs: PreviewTab[];
  onTabChange: (tab: PreviewTab) => void;
  ranking: RankedItem<ListItem>[];
  /** Which fields the ranked rows read, and how; see cardLayout. */
  layout?: CardLayout;
  /**
   * Whether the list has any decision behind it. Until it does, the ranked
   * view is only the order the list arrived in, and says so.
   */
  decided?: boolean;
  /** True when the user said the list arrived already ranked, so its order is theirs to trust. */
  trustedOrder?: boolean;
  /** The user's document, ranked and serialized for the active tab. */
  exportText: string;
  /**
   * Makes the same text on demand, for exporting from the ranked view, which
   * does not keep it up to date. Falls back to exportText.
   */
  getExportText?: () => string;
  filename: string;
  format: SourceFormat;
  /** Items deleted during comparison, which the export leaves out. */
  removedCount: number;
  onReorder: (itemId: string, nextOrder: string[]) => void;
  /** When given, the pane offers saving and opening a session file. */
  sessionFile?: SessionControlsProps;
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
  layout,
  decided = true,
  trustedOrder = false,
  exportText,
  getExportText,
  filename,
  format,
  removedCount,
  onReorder,
  sessionFile,
}: PreviewPaneProps) {
  return (
    <View style={styles.pane} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title} role="heading" aria-level={2}>
          Your data
        </Text>
        <Text style={styles.subtitle}>
          {tab !== 'ranked'
            ? 'Your document, in the new order'
            : decided
              ? 'Drag a row to arrange it'
              : trustedOrder
                ? 'Your order, as given. Choose between pairs to refine it, or drag a row.'
                : 'Not ranked yet: this is the order you gave. Choose between pairs, or drag a row.'}
        </Text>
      </View>

      {removedCount > 0 && (
        <Text style={styles.removed}>
          {`${removedCount} removed ${removedCount === 1 ? 'item is' : 'items are'} excluded from the export.`}
        </Text>
      )}

      {/* On every tab: taking the result away should never need a detour. */}
      <ExportToolbar
        format={format}
        text={tab === 'ranked' ? (getExportText ?? exportText) : exportText}
        filename={filename}
      />

      <PreviewTabs tab={tab} tabs={tabs} onChange={onTabChange} />

      {tab === 'ranked' ? (
        <View style={styles.body} accessibilityLabel="Current ranking" role="region">
          <RankedListPreview ranking={ranking} layout={layout} decided={decided} onReorder={onReorder} />
        </View>
      ) : (
        <View style={styles.body}>
          <ReadOnlyCode text={exportText} label={`${format} export`} />
        </View>
      )}

      {sessionFile !== undefined && (
        <View style={styles.later}>
          <Text style={styles.laterLabel}>Keep working later, here or in another browser</Text>
          <SessionControls {...sessionFile} />
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
  later: { gap: space.xs, paddingTop: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
  laterLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
