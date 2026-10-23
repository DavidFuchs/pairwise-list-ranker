import { Pressable, StyleSheet, Text, View } from 'react-native';

import { DownloadButton } from '@/components/preview/DownloadButton';
import { SessionControls } from '@/components/preview/SessionControls';
import type { SessionControlsProps } from '@/components/preview/SessionControls';
import { PreviewTabs, TAB_LABELS } from '@/components/preview/PreviewTabs';
import { RankedListPreview } from '@/components/preview/RankedListPreview';
import { ReadOnlyCode } from '@/components/preview/ReadOnlyCode';
import { RESTORING_TEXT, UNRESTORED_TEXT } from '@/components/comparison/ComparisonDeck';
import type { DeckStatus } from '@/components/comparison/ComparisonDeck';
import type { CardLayout } from '@/lib/renderers';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ListItem } from '@/types/list';
import type { PreviewTab, SourceFormat } from '@/types/source';

const SETUP_LABEL = 'List setup';
// The text form of the gear: some platforms draw the bare character as an emoji.
const GEAR = '\u2699\uFE0E';

/**
 * A native tooltip on the web, where the icon alone does not say what it opens.
 * React Native Web passes no `title` through, so it is set on the element.
 */
function tooltip(text: string) {
  return (node: unknown) => {
    if (node instanceof HTMLElement) node.setAttribute('title', text);
  };
}

export interface PreviewPaneProps {
  tab: PreviewTab;
  tabs: PreviewTab[];
  onTabChange: (tab: PreviewTab) => void;
  ranked: ListItem[];
  /** Items marked as not recognized, after the ranking. */
  unrecognized?: ListItem[];
  /** Whether the ranking is ready, being restored, or could not be restored. */
  status?: DeckStatus;
  /** Which fields the ranked rows read, and how; see cardLayout. */
  layout?: CardLayout;
  /**
   * Whether the list has any decision behind it. Until it does, the ranked
   * view is only the order the list arrived in, and says so.
   */
  decided?: boolean;
  /** True when the user said the list arrived already ranked, so its order is theirs to trust. */
  trustedOrder?: boolean;
  /** The user's document, ranked and serialized for the active tab; empty while restoring. */
  exportText: string;
  /**
   * Makes the document in a format on demand: for a download from the ranked
   * view, which does not keep the text up to date, and for a format other
   * than the tab's, which has none.
   */
  getExportText: (format: SourceFormat) => string;
  /** The tab's format, or the format the source arrived in on the ranked tab. */
  format: SourceFormat;
  /** Items deleted during comparison, which the export leaves out. */
  removedCount: number;
  onReorder: (itemId: string, nextOrder: string[]) => void;
  /** Removes an item from its row, as a card's remove control does. */
  onRemove?: (itemId: string) => void;
  /** When given, the header offers a gear that opens the list's setup. */
  onOpenSetup?: () => void;
  /** When given, the pane offers saving and opening a session file. */
  sessionFile?: SessionControlsProps;
}

/**
 * Read-only by design. The list's fields are changed in list setup, which the
 * gear opens; the data itself is not edited here.
 */
export function PreviewPane({
  tab,
  tabs,
  onTabChange,
  ranked,
  unrecognized,
  status = 'ready',
  layout,
  decided = true,
  trustedOrder = false,
  exportText,
  getExportText,
  format,
  removedCount,
  onReorder,
  onRemove,
  onOpenSetup,
  sessionFile,
}: PreviewPaneProps) {
  return (
    <View style={styles.pane} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={styles.title} role="heading" aria-level={2}>
            Your data
          </Text>
          {onOpenSetup !== undefined && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={SETUP_LABEL}
              ref={tooltip(SETUP_LABEL)}
              onPress={onOpenSetup}
              style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
            >
              <Text style={styles.gearIcon} aria-hidden>
                {GEAR}
              </Text>
            </Pressable>
          )}
        </View>
        {/* Not while restoring or unrestored: the body says what is going on, and there is no order to drag. */}
        {status === 'ready' && (
          <Text style={styles.subtitle}>
            {tab !== 'ranked'
              ? 'Your document, in the new order'
              : decided
                ? 'Drag a row to arrange it'
                : trustedOrder
                  ? 'Your order, as given. Choose between pairs to refine it, or drag a row.'
                  : 'Not ranked yet: this is the order you gave. Choose between pairs, or drag a row.'}
          </Text>
        )}
      </View>

      {removedCount > 0 && (
        <Text style={styles.removed}>
          {`${removedCount} removed ${removedCount === 1 ? 'item is' : 'items are'} excluded from the export.`}
        </Text>
      )}

      {/* On every tab: taking the result away should never need a detour. */}
      <DownloadButton
        format={format}
        formats={tabs.filter((option): option is SourceFormat => option !== 'ranked')}
        getText={(chosen) =>
          chosen === format && tab !== 'ranked' && status === 'ready' ? exportText : getExportText(chosen)
        }
      />

      <PreviewTabs tab={tab} tabs={tabs} onChange={onTabChange} />

      {tab === 'ranked' ? (
        <View style={styles.body} accessibilityLabel="Current ranking" role="region">
          <RankedListPreview
            ranked={ranked}
            unrecognized={unrecognized}
            status={status}
            layout={layout}
            onReorder={onReorder}
            onRemove={onRemove}
          />
        </View>
      ) : (
        <View style={styles.body}>
          {status !== 'ready' ? (
            <Text style={styles.subtitle}>{status === 'restoring' ? RESTORING_TEXT : UNRESTORED_TEXT}</Text>
          ) : (
            <ReadOnlyCode
              text={exportText}
              label={`${format} export`}
              copyLabel={`Copy ${TAB_LABELS[format]} to the clipboard`}
            />
          )}
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
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  gear: {
    minWidth: 36,
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  gearPressed: { backgroundColor: colors.accentSoft },
  // The text gear draws small and thin for its font size; this matches the weight of the row trash can.
  gearIcon: { fontSize: 26, lineHeight: 28, color: colors.textSecondary },
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
