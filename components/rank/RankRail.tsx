import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

export interface RankRailProgress {
  activeItems: number;
  comparisons: number;
  skips: number;
  coverage: number;
}

export interface RankRailProps {
  name: string;
  /** e.g. `movies · shown by title · order written back` */
  context: string;
  progress: RankRailProgress;
  removedCount: number;
  onRename: (name: string) => void;
  onEditData: () => void;
  onStartOver: () => void;
}

export function RankRail({
  name,
  context,
  progress,
  removedCount,
  onRename,
  onEditData,
  onStartOver,
}: RankRailProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.rail} dataSet={{ surface: 'panel' }}>
      <TextInput
        accessibilityLabel="List name"
        value={name}
        onChangeText={onRename}
        style={styles.name}
      />

      <Text style={styles.context}>{context}</Text>

      <View style={styles.stats}>
        <Text style={styles.stat}>{`${progress.comparisons} comparisons`}</Text>
        <Text style={styles.stat}>{`${progress.activeItems} items`}</Text>
      </View>

      {removedCount > 0 && (
        <Text style={styles.note}>
          {`${removedCount} removed ${removedCount === 1 ? 'item is' : 'items are'} excluded from the export.`}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Edit data" accessibilityLabel="Edit data" onPress={onEditData} size="sm" />

        {confirming ? (
          <>
            <Text style={styles.warning}>
              This clears this list from the browser. Your exported files are untouched.
            </Text>
            <Button
              label="Keep it"
              accessibilityLabel="Keep this list"
              variant="ghost"
              size="sm"
              onPress={() => setConfirming(false)}
            />
            <Button
              label="Start over"
              accessibilityLabel="Confirm start over"
              variant="danger"
              size="sm"
              onPress={() => {
                setConfirming(false);
                onStartOver();
              }}
            />
          </>
        ) : (
          <Button
            label="Start over"
            accessibilityLabel="Start over"
            variant="ghost"
            size="sm"
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  name: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
    borderRadius: radius.sm,
  },
  context: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.dangerText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
