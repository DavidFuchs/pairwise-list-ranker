import type { ReactNode } from 'react';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { HowItWorksModal } from '@/components/layout/HowItWorksModal';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { GitHubIcon } from '@/components/ui/GitHubIcon';
import { colors, fonts, radius, space } from '@/lib/theme';

const REPO_URL = 'https://github.com/DavidFuchs/pairwise-list-ranker';

export interface AppShellProps {
  listName: string;
  statusText: string;
  /** Omitted on the data screen, where there is nothing to reset yet. */
  onReset?: () => void;
  /**
   * Replaces the plain list-name text with an interactive control, e.g.
   * ListSwitcher on the rank screen. Falls back to plain text when omitted,
   * since not every screen has other lists to jump between.
   */
  listSwitcher?: ReactNode;
  rail?: ReactNode;
  stage: ReactNode;
  preview: ReactNode;
}

/**
 * The three regions size themselves with flex-basis and wrap: three columns
 * when there is room, then the preview drops below, then everything stacks.
 * Doing this in flexbox rather than from a measured window width keeps the
 * static build and the hydrated page rendering the same markup.
 */
export function AppShell({
  listName,
  statusText,
  onReset,
  listSwitcher,
  rail,
  stage,
  preview,
}: AppShellProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);

  return (
    <View style={styles.root} dataSet={{ surface: 'canvas' }}>
      <View style={styles.header} role="banner">
        <View style={styles.brand}>
          <Text style={styles.wordmark}>Pairwise</Text>
          {listSwitcher ?? (
            <Text style={styles.listName} numberOfLines={1}>
              {listName}
            </Text>
          )}
        </View>

        <View style={styles.headerActions}>
          <Text style={styles.status}>{statusText}</Text>
          <Button
            label="How it works"
            accessibilityLabel="How this app works"
            variant="ghost"
            size="sm"
            onPress={() => setHowItWorksOpen(true)}
          />
          <ThemeToggle />
          {onReset !== undefined && <View style={styles.headerDivider} />}
          {onReset === undefined ? null : confirmingReset ? (
            <>
              <Button
                label="Cancel"
                accessibilityLabel="Keep this list"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmingReset(false)}
              />
              <Button
                label="Start over"
                accessibilityLabel="Confirm start over"
                variant="dangerStrong"
                size="sm"
                onPress={() => {
                  setConfirmingReset(false);
                  onReset();
                }}
              />
            </>
          ) : (
            <Button
              label="Start over"
              accessibilityLabel="Start over"
              variant="danger"
              size="sm"
              onPress={() => setConfirmingReset(true)}
            />
          )}
          <Pressable
            href={REPO_URL}
            hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
            accessibilityRole="link"
            accessibilityLabel="View source on GitHub"
            dataSet={{ github: 'true' }}
            style={styles.githubLink}
          >
            <GitHubIcon />
          </Pressable>
        </View>
      </View>

      {confirmingReset && (
        <Text style={styles.resetWarning}>
          This clears the list held in this browser. Files you already exported are untouched.
        </Text>
      )}

      <HowItWorksModal visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />

      <ScrollView contentContainerStyle={styles.scrollBody}>
        <View style={styles.body}>
          {rail != null && <View style={styles.rail}>{rail}</View>}

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
  headerDivider: { width: 1, height: 20, backgroundColor: colors.border },
  githubLink: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  status: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  resetWarning: {
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    fontFamily: fonts.body,
    fontSize: 12,
    color: colors.dangerText,
    backgroundColor: colors.dangerSoft,
  },
  scrollBody: { padding: space.lg },
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, alignItems: 'flex-start' },
  rail: { flexGrow: 1, flexShrink: 1, flexBasis: 260, minWidth: 240, maxWidth: 340, gap: space.md },
  // Stage claims spare width first so the rank screen's two comparison cards
  // stay side by side (they need ~620px to avoid wrapping); past its cap the
  // spare space goes to the preview card so its controls (e.g. the
  // order-picker buttons) have room to sit on one line.
  stage: { flexGrow: 2, flexShrink: 1, flexBasis: 420, minWidth: 320, maxWidth: 640, gap: space.lg },
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 400, minWidth: 360, minHeight: 520 },
});
