import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { ComparisonOutcome } from '@/types/ranking';

export interface ComparisonActionsProps {
  leftLabel: string;
  rightLabel: string;
  onOutcome: (outcome: ComparisonOutcome) => void;
  onDelete: (side: 'left' | 'right') => void;
  disabled?: boolean;
}

/**
 * Deletion is armed by a first press and only fires on confirmation, so a
 * mis-tap during fast comparison rounds cannot destroy an item.
 */
export function ComparisonActions({
  leftLabel,
  rightLabel,
  onOutcome,
  onDelete,
  disabled = false,
}: ComparisonActionsProps) {
  const [armed, setArmed] = useState<'left' | 'right' | null>(null);

  const choose = (outcome: ComparisonOutcome) => () => {
    setArmed(null);
    onOutcome(outcome);
  };

  const armedLabel = armed === 'left' ? leftLabel : rightLabel;

  return (
    <View style={styles.container}>
      <View style={styles.winnerRow}>
        <Button
          label={`Choose ${leftLabel}`}
          accessibilityLabel={`Choose ${leftLabel}`}
          variant="primary"
          disabled={disabled}
          onPress={choose('left')}
          style={styles.grow}
        />
        <Button
          label="Skip"
          accessibilityLabel="Skip this pair"
          variant="secondary"
          disabled={disabled}
          onPress={choose('skip')}
        />
        <Button
          label={`Choose ${rightLabel}`}
          accessibilityLabel={`Choose ${rightLabel}`}
          variant="primary"
          disabled={disabled}
          onPress={choose('right')}
          style={styles.grow}
        />
      </View>

      <View style={styles.strongRow}>
        <Button
          label="Much better"
          accessibilityLabel={`${leftLabel} is much better`}
          variant="emphasis"
          size="sm"
          disabled={disabled}
          onPress={choose('left_strong')}
          style={styles.grow}
        />
        <Button
          label="Much better"
          accessibilityLabel={`${rightLabel} is much better`}
          variant="emphasis"
          size="sm"
          disabled={disabled}
          onPress={choose('right_strong')}
          style={styles.grow}
        />
      </View>

      {armed === null ? (
        <View style={styles.deleteRow}>
          <Button
            label="Delete"
            accessibilityLabel={`Delete ${leftLabel}`}
            variant="danger"
            size="sm"
            disabled={disabled}
            onPress={() => setArmed('left')}
          />
          <Text style={styles.deleteHint}>Removing an item never ranks the pair</Text>
          <Button
            label="Delete"
            accessibilityLabel={`Delete ${rightLabel}`}
            variant="danger"
            size="sm"
            disabled={disabled}
            onPress={() => setArmed('right')}
          />
        </View>
      ) : (
        <View style={styles.confirmRow}>
          <Text style={styles.confirmText}>{`Delete "${armedLabel}" from the list?`}</Text>
          <View style={styles.confirmActions}>
            <Button
              label="Cancel"
              accessibilityLabel={`Keep ${armedLabel}`}
              variant="ghost"
              size="sm"
              onPress={() => setArmed(null)}
            />
            <Button
              label="Delete item"
              accessibilityLabel={`Confirm deleting ${armedLabel}`}
              variant="danger"
              size="sm"
              onPress={() => {
                const side = armed;
                setArmed(null);
                onDelete(side);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.sm },
  grow: { flex: 1 },
  winnerRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  strongRow: { flexDirection: 'row', gap: space.sm },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  deleteHint: {
    flex: 1,
    textAlign: 'center',
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.textSecondary,
  },
  confirmRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: '#F0D2D2',
    backgroundColor: '#FEF6F6',
  },
  confirmText: {
    flex: 1,
    fontFamily: fonts.body,
    fontSize: 13,
    color: colors.danger,
    fontWeight: '600',
  },
  confirmActions: { flexDirection: 'row', gap: space.xs },
});
