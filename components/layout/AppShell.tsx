import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useRef, useState } from 'react';
import {
  Image,
  Modal as RNModal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { ExternalChangeNotice } from '@/components/layout/ExternalChangeNotice';
import { HowItWorksModal } from '@/components/layout/HowItWorksModal';
import { SPLIT_DIVIDER_WIDTH, SplitDivider } from '@/components/layout/SplitDivider';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { Button } from '@/components/ui/Button';
import { GitHubIcon } from '@/components/ui/GitHubIcon';
import { useScreenFocused } from '@/lib/hooks/useScreenFocused';
import { SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, useSidebarWidth } from '@/lib/hooks/useSidebarWidth';
import { colors, fonts, radius, space } from '@/lib/theme';

import appIcon from '../../assets/icon.png';

const REPO_URL = 'https://github.com/DavidFuchs/pairwise-list-ranker';

export interface AppShellProps {
  /** Shown beside the wordmark. */
  listName?: string;
  /**
   * Said only when something is wrong with saving, such as a list too large
   * for the browser to keep. Saving that works needs no announcement.
   */
  saveWarning?: string;
  /** Omitted where there is nothing to reset yet. */
  onReset?: () => void;
  /**
   * What starting over would throw away, said in the prompt before it does,
   * e.g. "Your 12 comparisons will be lost." Omitted when nothing would be.
   */
  resetCost?: string;
  /**
   * Offered in the start-over prompt as the way to keep that work first.
   * Returns what happened, for the prompt to show.
   */
  onSaveBeforeReset?: () => string;
  rail?: ReactNode;
  stage: ReactNode;
  preview: ReactNode;
  /**
   * Turns the whole page into a drop target for a dragged-in file, with a
   * full-screen overlay while the drag is over it. Also keeps the browser
   * from opening a dropped file in place of the app.
   */
  onFileDrop?: (file: File) => void;
  /** What the drop overlay says a release will do. */
  dropTitle?: string;
  /**
   * Held at the bottom of the window, under the scrolling page, once the
   * columns stack: there the sidebar's own action would sit below everything
   * else, several screens down. Components inside can check useShellDocking
   * to leave out their copy.
   */
  dock?: ReactNode;
}

/**
 * True while the shell is showing its dock, so whatever the dock holds can
 * leave out its own copy of it. Outside a shell, nothing is docked.
 */
const DockingContext = createContext(false);

export function useShellDocking(): boolean {
  return useContext(DockingContext);
}

/** The stage never gets narrower than this while the sidebar sits beside it. */
const STAGE_MIN_WIDTH = 320;
const RAIL_WIDTH = 260;
/** The sidebar never gets shorter than this, however short the window. */
const PREVIEW_MIN_HEIGHT = 520;

/**
 * A split view: the stage on the left, the sidebar on the right, and a
 * draggable divider between them. The split is decided from the body's own
 * measured width; when the stage and the narrowest sidebar no longer fit side
 * by side, the sidebar drops below the stage instead. Until that first
 * measurement (the static build, the first frame after hydration) the regions
 * fall back to flex-wrap at the default width, so the page that loads already
 * looks like the split it is about to become.
 */
export function AppShell({
  listName,
  saveWarning,
  onReset,
  resetCost,
  onSaveBeforeReset,
  rail,
  stage,
  preview,
  onFileDrop,
  dropTitle = 'Drop to import',
  dock,
}: AppShellProps) {
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetSaveNote, setResetSaveNote] = useState<string | null>(null);
  const [howItWorksOpen, setHowItWorksOpen] = useState(false);
  const [fileDragActive, setFileDragActive] = useState(false);
  // dragenter/dragleave fire as the pointer crosses every child element, not
  // just the page's own edges, so a bare boolean flickers - a depth counter
  // only reaches zero once the drag has actually left the window.
  const dragDepth = useRef(0);
  const focused = useScreenFocused();

  const { width: savedSidebarWidth, setWidth: saveSidebarWidth } = useSidebarWidth();
  // Held locally while a drag is under way so every pixel of it doesn't go
  // through localStorage; saved once when the drag settles.
  const [draggingSidebarWidth, setDraggingSidebarWidth] = useState<number | null>(null);
  const [bodyWidth, setBodyWidth] = useState<number | null>(null);
  // The height under the header, which the split view's columns fill.
  const [viewportHeight, setViewportHeight] = useState<number | null>(null);

  const railSpace = rail != null ? RAIL_WIDTH + space.lg : 0;
  const maxSidebarWidth =
    bodyWidth === null ? SIDEBAR_MIN_WIDTH : bodyWidth - railSpace - STAGE_MIN_WIDTH - SPLIT_DIVIDER_WIDTH;
  const layout: 'pending' | 'split' | 'stacked' =
    bodyWidth === null ? 'pending' : maxSidebarWidth >= SIDEBAR_MIN_WIDTH ? 'split' : 'stacked';
  // The saved width is what the user asked for; a window too narrow for it
  // squeezes the sidebar for now without forgetting that choice.
  const sidebarWidth = Math.max(
    SIDEBAR_MIN_WIDTH,
    Math.min(maxSidebarWidth, draggingSidebarWidth ?? savedSidebarWidth),
  );

  // An armed start-over is a question about now. Escape, or a press anywhere
  // outside the prompt, answers it with "keep", so it never waits for a click
  // the user has long since stopped thinking about.
  useEffect(() => {
    if (!confirmingReset || !focused || Platform.OS !== 'web') return;
    const disarm = () => {
      setConfirmingReset(false);
      setResetSaveNote(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') disarm();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Element | null;
      if (target?.closest?.('[data-reset-prompt]') == null) disarm();
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('pointerdown', onPointerDown, true);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('pointerdown', onPointerDown, true);
    };
  }, [confirmingReset, focused]);

  useEffect(() => {
    if (onFileDrop === undefined || Platform.OS !== 'web') return;
    // A screen kept mounted behind the one in front takes no drops, and shows no drag overlay (below).
    if (!focused) {
      dragDepth.current = 0;
      return;
    }

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
      onFileDrop(file);
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
  }, [onFileDrop, focused]);

  const docking = dock != null && layout === 'stacked';

  return (
    <DockingContext.Provider value={docking}>
      <View style={styles.root} dataSet={{ surface: 'canvas' }}>
        <View
          style={styles.header}
          role="banner"
          dataSet={confirmingReset ? { resetPrompt: 'true' } : undefined}
        >
          <View style={styles.brand}>
            <Image source={appIcon} accessibilityElementsHidden alt="" style={styles.logo} />
            <View style={styles.brandText}>
              <Text style={styles.wordmark} role="heading" aria-level={1}>
                Pairwise
              </Text>
              {listName !== undefined && (
                <Text style={styles.listName} numberOfLines={1}>
                  {listName}
                </Text>
              )}
            </View>
          </View>

          <View style={styles.headerActions} dataSet={{ headerActions: 'true' }}>
            {saveWarning !== undefined && (
              <Text role="status" style={styles.saveWarning}>
                {saveWarning}
              </Text>
            )}
            <Button
              label="How it works"
              accessibilityLabel="How this app works"
              variant="ghost"
              size="sm"
              onPress={() => setHowItWorksOpen(true)}
            />
            <ThemeToggle />
            {onReset !== undefined && <View style={styles.headerDivider} dataSet={{ wideOnly: 'true' }} />}
            {onReset === undefined ? null : confirmingReset ? (
              <>
                <Button
                  label="Keep this list"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    setConfirmingReset(false);
                    setResetSaveNote(null);
                  }}
                />
                <Button
                  label="Start over"
                  accessibilityLabel="Confirm start over"
                  variant="dangerStrong"
                  size="sm"
                  onPress={() => {
                    setConfirmingReset(false);
                    setResetSaveNote(null);
                    onReset();
                  }}
                />
              </>
            ) : (
              // Quiet until pressed: the red belongs to the confirmation, where
              // the list is actually at stake, not to every visit to the page.
              <Button
                label="Start over"
                accessibilityLabel="Start over"
                variant="ghost"
                size="sm"
                onPress={() => setConfirmingReset(true)}
              />
            )}
            <Pressable
              href={REPO_URL}
              hrefAttrs={{ target: '_blank', rel: 'noopener noreferrer' }}
              accessibilityRole="link"
              accessibilityLabel="View source on GitHub"
              dataSet={{ github: 'true', wideOnly: 'true' }}
              style={styles.githubLink}
            >
              <GitHubIcon />
            </Pressable>
          </View>
        </View>

        <ExternalChangeNotice />

        {confirmingReset && (
          <View style={styles.resetPrompt} dataSet={{ resetPrompt: 'true' }} role="alert">
            <Text style={styles.resetWarning}>
              {resetCost === undefined ? '' : `${resetCost} `}
              This clears the list held in this browser. Files you already exported are untouched.
            </Text>
            {onSaveBeforeReset !== undefined && resetCost !== undefined && (
              <View style={styles.resetSave}>
                <Button
                  label="Save session first"
                  variant="secondary"
                  size="sm"
                  onPress={() => setResetSaveNote(onSaveBeforeReset())}
                />
                {resetSaveNote !== null && <Text style={styles.resetNote}>{resetSaveNote}</Text>}
              </View>
            )}
          </View>
        )}

        <HowItWorksModal visible={howItWorksOpen} onClose={() => setHowItWorksOpen(false)} />

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollBody}
          onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        >
          <View
            style={[
              styles.body,
              layout === 'split' && styles.bodySplit,
              layout === 'stacked' && styles.bodyStacked,
            ]}
            onLayout={(event) => setBodyWidth(event.nativeEvent.layout.width)}
          >
            {rail != null && (
              <View style={[styles.rail, layout === 'split' && styles.railSplit]}>{rail}</View>
            )}

            <View
              style={[
                styles.stage,
                layout === 'split' && styles.stageSplit,
                layout === 'stacked' && styles.stageStacked,
              ]}
              role="main"
            >
              {stage}
            </View>

            {/* The divider resizes the sidebar, so it sits inside the sidebar's
                landmark: between the two it would be content outside any. The
                wrapper is there in every layout, so the sidebar is never
                remounted when the split comes and goes. */}
            <View
              style={[
                styles.sidebar,
                layout === 'split' && styles.sidebarSplit,
                layout === 'stacked' && styles.sidebarStacked,
              ]}
              role="complementary"
            >
              {layout === 'split' && (
                <SplitDivider
                  width={sidebarWidth}
                  min={SIDEBAR_MIN_WIDTH}
                  max={maxSidebarWidth}
                  onResize={setDraggingSidebarWidth}
                  onCommit={(width) => {
                    setDraggingSidebarWidth(null);
                    saveSidebarWidth(width);
                  }}
                  onReset={() => {
                    setDraggingSidebarWidth(null);
                    saveSidebarWidth(SIDEBAR_DEFAULT_WIDTH);
                  }}
                />
              )}

              <View
                style={[
                  styles.preview,
                  layout === 'split' && [
                    { width: sidebarWidth },
                    viewportHeight !== null && {
                      height: Math.max(PREVIEW_MIN_HEIGHT, viewportHeight - space.lg * 2),
                    },
                  ],
                  // A docked sidebar has handed its action to the dock, so it can
                  // run its full length with the page rather than scroll inside it.
                  docking && styles.previewFitsContent,
                ]}
              >
                {preview}
              </View>
            </View>
          </View>
        </ScrollView>

        {docking && <View style={styles.dock}>{dock}</View>}

        {onFileDrop !== undefined && (
          <RNModal
            visible={fileDragActive && focused}
            transparent
            animationType="none"
            onRequestClose={() => {}}
          >
            <View style={styles.dropOverlay} pointerEvents="none">
              <View style={styles.dropCard}>
                <Text style={styles.dropTitle}>{dropTitle}</Text>
                <Text style={styles.dropSubtitle}>Release anywhere on the page</Text>
              </View>
            </View>
          </RNModal>
        )}
      </View>
    </DockingContext.Provider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  dock: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
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
  brand: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  brandText: { flexDirection: 'row', alignItems: 'baseline', gap: space.md, flexShrink: 1 },
  logo: { width: 32, height: 32, borderRadius: 8, flexShrink: 0 },
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
  // Wraps rather than overflowing: on a phone the actions are wider than the
  // screen, and a row that cannot wrap scrolls the whole page sideways.
  headerActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    flexShrink: 1,
    minWidth: 0,
    alignItems: 'center',
    gap: space.sm,
  },
  headerDivider: { width: 1, height: 20, backgroundColor: colors.border },
  githubLink: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
  },
  saveWarning: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  resetPrompt: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    backgroundColor: colors.dangerSoft,
  },
  resetWarning: { flexShrink: 1, fontFamily: fonts.body, fontSize: 12, color: colors.dangerText },
  resetSave: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  resetNote: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  // Reserve the scrollbar's width so it appearing never re-wraps the layout.
  scroll: { scrollbarGutter: 'stable' } as object,
  scrollBody: { padding: space.lg },
  // The pending layout: flex-wrap with the sidebar at its default width, so
  // the static page matches the split it hydrates into.
  body: { flexDirection: 'row', flexWrap: 'wrap', gap: space.lg, alignItems: 'flex-start' },
  // The divider is the gutter between stage and sidebar, so no gap here.
  bodySplit: { flexWrap: 'nowrap', gap: 0 },
  // nowrap: a wrapping column sizes each line to its widest content, so a long
  // unbroken sample would push the sidebar past the screen instead of truncating.
  bodyStacked: { flexDirection: 'column', flexWrap: 'nowrap', alignItems: 'stretch' },
  rail: { flexGrow: 1, flexShrink: 1, flexBasis: RAIL_WIDTH, minWidth: 240, maxWidth: 340, gap: space.md },
  railSplit: { flexGrow: 0, flexShrink: 0, width: RAIL_WIDTH, marginRight: space.lg },
  stage: { flexGrow: 1, flexShrink: 1, flexBasis: 0, minWidth: STAGE_MIN_WIDTH, gap: space.lg },
  // As tall as the sidebar beside it, so a panel that flexes can fill the column.
  stageSplit: { minWidth: 0, alignSelf: 'stretch' },
  // In a column, flex-basis would size height rather than width.
  stageStacked: { flexBasis: 'auto', flexGrow: 0, minWidth: 0 },
  sidebar: {
    flexGrow: 0,
    flexShrink: 1,
    flexBasis: SIDEBAR_DEFAULT_WIDTH,
    minWidth: SIDEBAR_MIN_WIDTH,
  },
  // The divider and the panel side by side, the divider running the full
  // height of the row as the gutter between stage and sidebar.
  sidebarSplit: { flexDirection: 'row', flexShrink: 0, flexBasis: 'auto', minWidth: 0, alignSelf: 'stretch' },
  sidebarStacked: { flexShrink: 0, flexBasis: 'auto', minWidth: 0 },
  preview: {
    minHeight: PREVIEW_MIN_HEIGHT,
    // Until the space under the header is measured; the split view then
    // fills it exactly, down to the bottom of the window.
    height: '85vh' as unknown as number,
  },
  previewFitsContent: { height: 'auto' as unknown as number, minHeight: 0 },
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
