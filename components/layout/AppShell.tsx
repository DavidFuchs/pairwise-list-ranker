import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

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
  /**
   * Turns the whole page into a drop target for a dragged-in file, with a
   * full-screen overlay while the drag is over it. Omitted on screens with
   * nothing to import into, e.g. the rank screen.
   */
  onFileDrop?: (text: string) => void;
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
  onFileDrop,
}: AppShellProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  // dragenter/dragleave fire as the pointer crosses every child element, not
  // just the page's own edges, so a bare boolean flickers - a depth counter
  // only reaches zero once the drag has actually left the window.
  const dragDepth = useRef(0);

  useEffect(() => {
    if (onFileDrop === undefined || Platform.OS !== 'web') return;

    const isFileDrag = (event: DragEvent) =>
      event.dataTransfer !== null && Array.from(event.dataTransfer.types).includes('Files');

    const onDragEnter = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current += 1;
      setFileDragActive(true);
    };
    const onDragOver = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
    };
    const onDragLeave = (event: DragEvent) => {
      // Leaving the browser window entirely (not just crossing into a child
      // element) reports no related target - the browser won't send a
      // matching dragenter to balance the count from here, and no `drop`
      // will ever follow once the pointer is outside the page. Reset
      // outright rather than decrementing, or the overlay would be stuck
      // until an unrelated later drag happened to bring the count back down.
      if (event.relatedTarget === null) {
        dragDepth.current = 0;
        setFileDragActive(false);
        return;
      }
      if (!isFileDrag(event)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setFileDragActive(false);
    };
    const onDrop = (event: DragEvent) => {
      if (!isFileDrag(event)) return;
      event.preventDefault();
      dragDepth.current = 0;
      setFileDragActive(false);
      const file = event.dataTransfer?.files[0];
      if (file === undefined) return;
      void file.text().then(onFileDrop);
    };

    // Alt-tabbing away mid-drag (into the OS or another app) doesn't
    // reliably send a dragleave to balance the count either - blur is the
    // catch-all for "the drag left some way we didn't get a dragleave for".
    const onBlur = () => {
      dragDepth.current = 0;
      setFileDragActive(false);
    };

    window.addEventListener('dragenter', onDragEnter);
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('dragleave', onDragLeave);
    window.addEventListener('drop', onDrop);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('dragenter', onDragEnter);
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('dragleave', onDragLeave);
      window.removeEventListener('drop', onDrop);
      window.removeEventListener('blur', onBlur);
    };
  }, [onFileDrop]);

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
                label="Confirm"
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

      {onFileDrop !== undefined && (
        <RNModal visible={fileDragActive} transparent animationType="none" onRequestClose={() => {}}>
          <View style={styles.dropOverlay} pointerEvents="none">
            <View style={styles.dropCard}>
              <Text style={styles.dropTitle}>Drop to import</Text>
              <Text style={styles.dropSubtitle}>Release anywhere on the page</Text>
            </View>
          </View>
        </RNModal>
      )}
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
  // Stage and preview share spare width 2:1 (flex-basis 0 puts all of it up
  // for grabs), so preview settles at roughly a third of the row and stage
  // the rest, with no leftover gap. Their minWidths are the wrap floor: once
  // either can't shrink any further, the row wraps to a stacked layout.
  stage: { flexGrow: 2, flexShrink: 1, flexBasis: 0, minWidth: 320, gap: space.lg },
  preview: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: 300, minHeight: 520 },
  dropOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xl,
    backgroundColor: colors.overlay,
  },
  dropCard: {
    alignItems: 'center',
    gap: space.xs,
    paddingVertical: space.xl,
    paddingHorizontal: space.xxl,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.accentStrong,
    backgroundColor: colors.accentSoft,
  },
  dropTitle: {
    fontFamily: fonts.heading,
    fontSize: 22,
    fontWeight: '700',
    color: colors.accentStrong,
  },
  dropSubtitle: { fontFamily: fonts.body, fontSize: 14, color: colors.textSecondary },
});
