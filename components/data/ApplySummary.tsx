import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { ImportDiff } from '@/lib/import/diff';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ApplySummaryProps {
  diff: ImportDiff;
  onCancel: () => void;
  onConfirm: () => void;
}

function plural(count: number): string {
  return count === 1 ? 'item' : 'items';
}

/** Applying edits mid-run is safe, so it says exactly what it will do first. */
export function ApplySummary({ diff, onCancel, onConfirm }: ApplySummaryProps) {
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

      <Text style={styles.line}>
        {`${diff.kept.length} ${plural(diff.kept.length)} unchanged - rankings kept`}
      </Text>

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

      {!diff.reordered && diff.added.length === 0 && diff.removed.length === 0 ? (
        <Text style={styles.note}>Nothing changed - applying will leave the list as it is.</Text>
      ) : (
        <Text style={styles.note}>{`${diff.keptComparisons} comparisons kept`}</Text>
      )}

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
