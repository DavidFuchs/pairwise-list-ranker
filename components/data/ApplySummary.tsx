import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { ImportDiff, SettingsDiff } from '@/lib/import/diff';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ApplySummaryProps {
  diff: ImportDiff;
  settings: SettingsDiff;
  onCancel: () => void;
  onConfirm: () => void;
}

function plural(count: number): string {
  return count === 1 ? 'item' : 'items';
}

/**
 * One line per setting the user answered differently, each naming what the
 * new answer does rather than repeating the answer back. Only the order
 * setting reaches the ranking; the other two reach the cards and the export.
 */
function settingsLines(settings: SettingsDiff): string[] {
  const lines: string[] = [];

  if (settings.order === 'seeded') {
    lines.push(
      'Order setting changed to best to worst - ratings restart from the order the list is in now, instead of flat',
    );
  }
  if (settings.order === 'flattened') {
    lines.push(
      'Order setting changed to no particular order - ratings restart flat, instead of from the order the list is in',
    );
  }

  if (settings.label !== null) {
    lines.push(
      settings.label.to === undefined
        ? 'Cards no longer show a chosen field'
        : `Cards now show “${settings.label.to}”`,
    );
  }

  if (settings.summary !== undefined) {
    lines.push(
      settings.summary.to.length === 0
        ? 'Cards will pick their own details'
        : `Cards will always show ${settings.summary.to.join(', ')}`,
    );
  }

  if (settings.writeBack !== null) {
    lines.push(
      settings.writeBack.to === undefined
        ? `Export will no longer number your items in “${settings.writeBack.from}”`
        : `Export will now number your items in “${settings.writeBack.to}”`,
    );
  }

  return lines;
}

/**
 * Applying edits mid-run is safe, so it says exactly what it will do first.
 * Data and setup are edited by the same press but are not the same thing:
 * entry counts are shown only when entries actually moved, so an edit that
 * only answered the setup questions differently never reads as one that
 * rewrote the list.
 */
export function ApplySummary({ diff, settings, onCancel, onConfirm }: ApplySummaryProps) {
  const dataChanged = diff.reordered || diff.added.length > 0 || diff.removed.length > 0;
  // Every starting rating is derived again from the order setting, so the
  // standings move even though every comparison behind them survives.
  const reseeded = settings.order !== 'unchanged';

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.title}>Applying your edits</Text>

      {diff.reordered && (
        <Text style={styles.line}>
          {diff.keptComparisons > 0
            ? `Order changed - it becomes the starting order, but your ${diff.keptComparisons} comparisons still decide the ranking`
            : 'Order changed - the list will follow your text'}
        </Text>
      )}

      {dataChanged && (
        <Text style={styles.line}>
          {reseeded
            ? `${diff.kept.length} ${plural(diff.kept.length)} unchanged`
            : `${diff.kept.length} ${plural(diff.kept.length)} unchanged - rankings kept`}
        </Text>
      )}

      {diff.added.length > 0 && (
        <Text style={styles.line}>
          {`${diff.added.length} ${plural(diff.added.length)} added - not yet ranked`}
        </Text>
      )}

      {diff.removed.length > 0 && (
        <Text style={styles.line}>
          {`${diff.removed.length} ${plural(diff.removed.length)} removed`}
        </Text>
      )}

      {settingsLines(settings).map((line) => (
        <Text key={line} style={styles.line}>
          {line}
        </Text>
      ))}

      <Text style={styles.note}>{note(diff, settings, dataChanged, reseeded)}</Text>

      <View style={styles.actions}>
        <Button label="Cancel" accessibilityLabel="Cancel" variant="ghost" onPress={onCancel} />
        <Button
          label="Apply edits"
          accessibilityLabel="Apply edits"
          variant="primary"
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

/** The one line about what happens to the comparisons already recorded. */
function note(
  diff: ImportDiff,
  settings: SettingsDiff,
  dataChanged: boolean,
  reseeded: boolean,
): string {
  if (!dataChanged && !settings.changed) {
    return 'Nothing changed - applying will leave the list as it is.';
  }

  if (reseeded) {
    return diff.keptComparisons > 0
      ? `Your ${diff.keptComparisons} comparisons are kept and replayed, but the ranking numbers will shift.`
      : 'Nothing has been compared yet, so the new order setting decides the ranking.';
  }

  return `${diff.keptComparisons} comparisons kept`;
}

const styles = StyleSheet.create({
  panel: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  line: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
