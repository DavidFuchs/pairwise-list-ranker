import type { ReactNode } from 'react';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, space } from '@/lib/theme';

export interface AppShellProps {
  listName: string;
  statusText: string;
  onReset: () => void;
  rail: ReactNode;
  stage: ReactNode;
  preview: ReactNode;
}

/**
 * The three regions size themselves with flex-basis and wrap: three columns
 * when there is room, then the preview drops below, then everything stacks.
 * Doing this in flexbox rather than from a measured window width keeps the
 * static build and the hydrated page rendering the same markup.
 */
export function AppShell({ listName, statusText, onReset, rail, stage, preview }: AppShellProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);

  return (
    <View style={styles.root}>
      <View style={styles.header} role="banner">
        <View style={styles.brand}>
          <Text style={styles.wordmark}>Pairwise</Text>
          <Text style={styles.listName} numberOfLines={1}>
            {listName}
          </Text>
        </View>

        <View style={styles.headerActions}>
          <Text style={styles.status}>{statusText}</Text>
          {confirmingReset ? (
            <>
              <Button
                label="Cancel"
                accessibilityLabel="Keep the current workspace"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmingReset(false)}
              />
              <Button
                label="Confirm reset"
                accessibilityLabel="Confirm reset workspace"
                variant="danger"
                size="sm"
                onPress={() => {
                  setConfirmingReset(false);
                  onReset();
                }}
              />
            </>
          ) : (
            <Button
              label="Reset"
              accessibilityLabel="Reset workspace"
              variant="ghost"
              size="sm"
              onPress={() => setConfirmingReset(true)}
            />
          )}
        </View>
      </View>

      {confirmingReset && (
        <Text style={styles.resetWarning}>
          This clears the list held in this browser. Files you already exported are untouched.
        </Text>
      )}

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.body}>
          {rail !== null && <View style={styles.rail}>{rail}</View>}

          <View style={styles.stage} role="main">
            {stage}
          </View>

          <View style={styles.preview} role="complementary">
            {preview}
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  brand: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, flexShrink: 1 },
  wordmark: {
    fontFamily: fonts.heading,
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.4,
    color: colors.textPrimary,
  },
  listName: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    flexShrink: 1,
  },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  status: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  resetWarning: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.dangerText,
    backgroundColor: '#FEF6F6',
  },
  scrollBody: { padding: space.lg },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, alignItems: 'flex-start' },
  rail: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 240, maxWidth: 340, gap: space.md },
  // Grows far harder than its neighbours, so spare width goes to the cards.
  stage: { flexGrow: 999, flexShrink: 1, flexBasis: 420, minWidth: 320, gap: space.lg },
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 360, minWidth: 300, minHeight: 520 },
});
