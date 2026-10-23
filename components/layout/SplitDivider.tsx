import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { colors, space } from '@/lib/theme';

/** Arrow keys move the divider this far; with Shift held, four times as far. */
const KEY_STEP = 16;

export interface SplitDividerProps {
  /** The sidebar's current width, which the divider sits against. */
  width: number;
  min: number;
  max: number;
  /** Fired on every pointer move, so the layout follows the drag live. */
  onResize: (width: number) => void;
  /** Fired once the drag or key press settles, for anything worth saving. */
  onCommit: (width: number) => void;
  /** Double-click, or Enter while focused, puts the default width back. */
  onReset: () => void;
}

/**
 * The draggable rule between the stage and the sidebar. The sidebar sits to
 * its right, so dragging left widens it. Listeners go straight on the DOM
 * node: pointer capture keeps a fast drag from escaping the strip, and arrow
 * keys stop here so they never reach the window-level comparison shortcuts.
 */
export function SplitDivider({ width, min, max, onResize, onCommit, onReset }: SplitDividerProps) {
  const ref = useRef<View>(null);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [dragging, setDragging] = useState(false);

  // The listeners are bound once; the latest props reach them through a ref
  // rather than rebinding on every pixel of a drag. Refreshed in a layout
  // effect, which runs before the browser can deliver the next event.
  const latest = useRef({ width, min, max, onResize, onCommit, onReset });
  useLayoutEffect(() => {
    latest.current = { width, min, max, onResize, onCommit, onReset };
  });

  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = ref.current as unknown as HTMLElement | null;
    if (node === null) return;

    const clamp = (value: number) =>
      Math.round(Math.min(latest.current.max, Math.max(latest.current.min, value)));

    let drag: { pointerId: number; startX: number; startWidth: number; current: number } | null = null;

    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      node.setPointerCapture(event.pointerId);
      drag = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startWidth: latest.current.width,
        current: latest.current.width,
      };
      setDragging(true);
      // Without these the drag selects text across the page and the cursor
      // flickers back to an arrow whenever it outruns the strip.
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    };
    const onPointerMove = (event: PointerEvent) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      const next = clamp(drag.startWidth - (event.clientX - drag.startX));
      if (next === drag.current) return;
      drag.current = next;
      latest.current.onResize(next);
    };
    const endDrag = (event: PointerEvent) => {
      if (drag === null || event.pointerId !== drag.pointerId) return;
      const settled = drag.current;
      drag = null;
      setDragging(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      latest.current.onCommit(settled);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      const step = event.shiftKey ? KEY_STEP * 4 : KEY_STEP;
      const { width: current } = latest.current;
      let next: number | null = null;
      if (event.key === 'ArrowLeft') next = current + step;
      else if (event.key === 'ArrowRight') next = current - step;
      else if (event.key === 'Home') next = latest.current.max;
      else if (event.key === 'End') next = latest.current.min;
      else if (event.key === 'Enter') {
        event.preventDefault();
        event.stopPropagation();
        latest.current.onReset();
        return;
      } else return;

      event.preventDefault();
      event.stopPropagation();
      const clamped = clamp(next);
      latest.current.onResize(clamped);
      latest.current.onCommit(clamped);
    };
    const onDoubleClick = () => latest.current.onReset();

    node.addEventListener('pointerdown', onPointerDown);
    node.addEventListener('pointermove', onPointerMove);
    node.addEventListener('pointerup', endDrag);
    node.addEventListener('pointercancel', endDrag);
    node.addEventListener('keydown', onKeyDown);
    node.addEventListener('dblclick', onDoubleClick);
    return () => {
      node.removeEventListener('pointerdown', onPointerDown);
      node.removeEventListener('pointermove', onPointerMove);
      node.removeEventListener('pointerup', endDrag);
      node.removeEventListener('pointercancel', endDrag);
      node.removeEventListener('keydown', onKeyDown);
      node.removeEventListener('dblclick', onDoubleClick);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, []);

  const active = dragging || focused;

  return (
    <View
      ref={ref}
      role="separator"
      aria-orientation="vertical"
      aria-label="Resize sidebar"
      aria-valuenow={width}
      aria-valuemin={min}
      aria-valuemax={max}
      focusable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={styles.strip}
    >
      <View style={[styles.rule, (hovered || active) && styles.ruleHot, active && styles.ruleActive]} />
      <View style={[styles.grip, (hovered || active) && styles.gripHot, active && styles.gripActive]} />
    </View>
  );
}

/** Wide enough to grab comfortably; it doubles as the gap between columns. */
export const SPLIT_DIVIDER_WIDTH = space.lg;

const styles = StyleSheet.create({
  strip: {
    width: SPLIT_DIVIDER_WIDTH,
    alignSelf: 'stretch',
    alignItems: 'center',
    cursor: 'col-resize',
    touchAction: 'none',
    outlineStyle: 'none',
  } as object,
  rule: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
    backgroundColor: colors.border,
  },
  ruleHot: { backgroundColor: colors.borderStrong },
  ruleActive: { width: 2, backgroundColor: colors.accent },
  // A short pill that says "grab here" without shouting when idle. Sticky, so
  // it stays level with the middle of the sidebar as the page scrolls rather
  // than sitting at the midpoint of a column that may run far below the fold.
  grip: {
    position: 'sticky' as 'absolute',
    top: '38vh' as unknown as number,
    marginTop: '38vh' as unknown as number,
    width: 6,
    height: 36,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  gripHot: { borderColor: colors.borderStrong, backgroundColor: colors.surfaceMuted },
  gripActive: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
});
