import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RESTORING_TEXT, UNRESTORED_TEXT } from '@/components/comparison/ComparisonDeck';
import type { DeckStatus } from '@/components/comparison/ComparisonDeck';
import { RankedRow, ROW_HEIGHT } from '@/components/preview/RankedRow';
import type { KeyMove } from '@/components/preview/RankedRow';
import {
  edgeScrollStep,
  gapMovesRow,
  insertIndexForUniform,
  moveItem,
  rankedDropGap,
  targetIndexForGap,
} from '@/lib/ranking/reorder';
import { selectItemLabel } from '@/lib/state/selectors';
import { EMPTY_LAYOUT, fieldLabelFor, formatValue, itemPictures, itemPreviewSources } from '@/lib/renderers';
import type { CardLayout, PreviewSource } from '@/lib/renderers';
import { colors, fonts, radius, space } from '@/lib/theme';
import { fieldOf } from '@/types/list';
import type { ListItem } from '@/types/list';

export interface RankedListPreviewProps {
  /** The ranking, best first. Rows carry their rank only, no rating (docs/ARCHITECTURE.md 10.1). */
  ranked: ListItem[];
  /** Items marked as not recognized, shown after the ranking in the order marked. */
  unrecognized?: ListItem[];
  /**
   * While restoring there is nothing to show or drag; unrestored, `ranked` is
   * the items in arrival order, shown as a plain list rather than a ranking.
   */
  status?: DeckStatus;
  /** Which fields each row reads, and how; see cardLayout. */
  layout?: CardLayout;
  onReorder: (itemId: string, nextOrder: string[]) => void;
  /** Removes an item from its row (docs/ARCHITECTURE.md 10.1); absent, rows have no remove control. */
  onRemove?: (itemId: string) => void;
}

/** Short lists render whole: windowing buys nothing and costs a layout pass. */
const VIRTUALIZE_ABOVE = 60;
/** Rows kept mounted beyond each edge, so ordinary scrolling never shows a gap. */
const OVERSCAN = 8;
/** Used until the first layout reports the real height. */
const ASSUMED_VIEWPORT = 600;
const ROW_PITCH = ROW_HEIGHT + space.xs;

const NO_ITEMS: ListItem[] = [];

/**
 * The ranking, and the one place it can be arranged by hand. A manual move is
 * recorded as a placement in the ranking history, between the two rows it was
 * dropped between, and nothing is discarded.
 */
export function RankedListPreview({
  ranked,
  unrecognized = NO_ITEMS,
  status = 'ready',
  layout = EMPTY_LAYOUT,
  onReorder,
  onRemove,
}: RankedListPreviewProps) {
  const orderedIds = useMemo(() => ranked.map((item) => item.id), [ranked]);
  const unrecognizedIds = useMemo(() => unrecognized.map((item) => item.id), [unrecognized]);
  /*
   * The handlers below read the order and the callback when an event fires, not
   * when they were made. They are then the same function for every ranking, so
   * the memoized rows draw again only when their own props change: an answer
   * moves a few items, and every row in the window used to draw again for it.
   */
  const latest = useRef({ orderedIds, unrecognizedIds, onReorder, onRemove });
  useLayoutEffect(() => {
    latest.current = { orderedIds, unrecognizedIds, onReorder, onRemove };
  });
  // The same function for every ranking, as the handlers below are, so rows stay memoized.
  const handleRemove = useCallback((id: string) => latest.current.onRemove?.(id), []);
  /**
   * Nothing moves until the drop. The rows hold still and a line marks the gap
   * the row will drop into, so the list never shifts under the pointer that is
   * aiming at it. A "Didn't recognize" row has a gap only over the ranked
   * rows: null below them, where it would drop nowhere.
   */
  const [dragging, setDragging] = useState<{ id: string; gap: number | null; unrecognized: boolean } | null>(
    null,
  );
  /** Abandons the drag under way, if any, recording nothing. */
  const abandonDrag = useRef<(() => void) | null>(null);

  // A drag begun on a ready ranking must not drop onto one being restored, or
  // one no longer on screen: it is abandoned, and its later pointerup records nothing.
  useEffect(() => {
    if (status !== 'ready') abandonDrag.current?.();
  }, [status]);
  useEffect(() => () => abandonDrag.current?.(), []);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(ASSUMED_VIEWPORT);

  const virtual = orderedIds.length > VIRTUALIZE_ABOVE;
  const windowStart = virtual ? Math.max(0, Math.floor(scrollTop / ROW_PITCH) - OVERSCAN) : 0;
  const windowEnd = virtual
    ? Math.min(orderedIds.length, Math.ceil((scrollTop + viewportHeight) / ROW_PITCH) + OVERSCAN)
    : orderedIds.length;

  const byId = useMemo(() => new Map(ranked.map((item) => [item.id, item])), [ranked]);

  /** Which gap to mark, or null when dropping here would change nothing. */
  const insertionGap = useMemo(() => {
    if (dragging === null || dragging.gap === null) return null;
    // Not in the ranking, a "Didn't recognize" row moves into any gap in it.
    if (dragging.unrecognized) return dragging.gap;
    const from = orderedIds.indexOf(dragging.id);
    if (from < 0 || !gapMovesRow(from, dragging.gap)) return null;
    return dragging.gap;
  }, [dragging, orderedIds]);

  const handleKeyMove = useCallback((id: string, move: KeyMove) => {
    const { orderedIds, unrecognizedIds, onReorder } = latest.current;
    const from = orderedIds.indexOf(id);
    if (from < 0 && unrecognizedIds.includes(id)) {
      // Only back up into the ranking, at its bottom or its top: nothing is reordered under the divider.
      if (orderedIds.length === 0 || (move !== -1 && move !== 'top')) return;
      onReorder(id, move === 'top' ? [id, ...orderedIds] : [...orderedIds, id]);
      return;
    }
    const to = move === 'top' ? 0 : move === 'bottom' ? orderedIds.length - 1 : from + move;
    if (from < 0 || to === from || to < 0 || to >= orderedIds.length) return;
    onReorder(id, moveItem(orderedIds, from, to));
  }, []);

  const handleGrab = useCallback((id: string, startClientY: number, grip: HTMLElement) => {
    // The ranking as it stands at the grab: a drag is aimed at it and dropped onto it.
    const { orderedIds, unrecognizedIds, onReorder } = latest.current;
    const from = orderedIds.indexOf(id);
    // A "Didn't recognize" row is dropped into the ranked rows, and has nowhere to go without them.
    const unrecognized = from < 0 && unrecognizedIds.includes(id);
    if (unrecognized ? orderedIds.length === 0 : from < 0) return;

    /*
     * Measured from the DOM on every move, in the same viewport space the
     * pointer reports. Deriving it from onLayout instead means holding two
     * coordinate systems at once; an earlier attempt did, and every drag
     * silently went to the end of the list. Nothing moves until the drop, so
     * measuring fresh is safe. A windowed list has only some rows mounted,
     * but every row is the same height, so one measured row fixes where all
     * of them are. The "Didn't recognize" rows come after the ranked ones, so
     * the first row mounted is always a ranked one.
     */
    const list = grip.closest('[role="list"]');
    if (list === null) return;

    const gapFor = (clientY: number): number | null => {
      const fallback = unrecognized ? null : 0;
      const first = list.querySelector('[role="listitem"]');
      if (first === null) return fallback;
      const firstIndex = orderedIds.indexOf(first.getAttribute('data-id') ?? '');
      if (firstIndex < 0) return fallback;
      // A ranked row's gap is clamped to the ranked rows; a "Didn't recognize" row's ends at the last of them.
      return (unrecognized ? rankedDropGap : insertIndexForUniform)(
        orderedIds.length,
        firstIndex,
        first.getBoundingClientRect().top,
        ROW_HEIGHT,
        ROW_PITCH,
        clientY,
      );
    };

    setDragging({ id, gap: gapFor(startClientY), unrecognized });

    /*
     * Held near the top or bottom of what scrolls, the list keeps moving, so
     * a row can be carried past the rows on screen. Whatever scrolls is
     * found from the list up: the list itself in the sidebar, or the page
     * once the sidebar sits below the stage and runs its full length.
     */
    const scroller = scrollerOf(list);
    let pointerY = startClientY;
    let frame: number | null = null;

    const edgeScroll = () => {
      frame = null;
      const rect =
        scroller === document.scrollingElement
          ? { top: 0, bottom: window.innerHeight }
          : scroller.getBoundingClientRect();
      const step = edgeScrollStep(pointerY, Math.max(0, rect.top), Math.min(window.innerHeight, rect.bottom));
      if (step === 0) return;
      const before = scroller.scrollTop;
      scroller.scrollTop = before + step;
      if (scroller.scrollTop === before) return;
      // The rows moved under a pointer that did not.
      const gap = gapFor(pointerY);
      setDragging((current) => (current === null ? null : { ...current, gap }));
      frame = requestAnimationFrame(edgeScroll);
    };

    const stop = () => {
      abandonDrag.current = null;
      if (frame !== null) cancelAnimationFrame(frame);
      frame = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onCancel);
    };

    const onMove = (event: PointerEvent) => {
      pointerY = event.clientY;
      const gap = gapFor(event.clientY);
      setDragging((current) => (current === null ? null : { ...current, gap }));
      if (frame === null) frame = requestAnimationFrame(edgeScroll);
    };

    const onUp = (event: PointerEvent) => {
      stop();
      const gap = gapFor(event.clientY);
      setDragging(null);
      if (gap === null) return;
      if (unrecognized) {
        onReorder(id, [...orderedIds.slice(0, gap), id, ...orderedIds.slice(gap)]);
      } else if (gapMovesRow(from, gap)) {
        onReorder(id, moveItem(orderedIds, from, targetIndexForGap(from, gap)));
      }
    };

    const onCancel = () => {
      stop();
      setDragging(null);
    };

    abandonDrag.current = onCancel;
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onCancel);
  }, []);

  if (status === 'restoring') {
    return <Text style={styles.notice}>{RESTORING_TEXT}</Text>;
  }

  if (status === 'unrestored') {
    // The items, but not as a ranking: no positions and nothing to drag.
    return (
      <View style={styles.container}>
        <Text style={styles.notice}>{UNRESTORED_TEXT}</Text>
        <ScrollView style={styles.scroll} contentContainerStyle={styles.list}>
          {ranked.map((item) => (
            <PlainRow key={item.id} item={item} layout={layout} />
          ))}
        </ScrollView>
      </View>
    );
  }

  if (ranked.length === 0 && unrecognized.length === 0) {
    return <Text style={styles.empty}>Nothing here yet. Import a list to see it ranked.</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.listFrame}
        role="list"
        scrollEventThrottle={16}
        onLayout={(event) => setViewportHeight(event.nativeEvent.layout.height)}
        onScroll={(event) => setScrollTop(event.nativeEvent.contentOffset.y)}
      >
        <View
          style={[
            styles.list,
            {
              paddingTop: space.xs + windowStart * ROW_PITCH,
              paddingBottom: space.md + (orderedIds.length - windowEnd) * ROW_PITCH,
            },
          ]}
        >
          {orderedIds.slice(windowStart, windowEnd).map((id, offset) => {
            const index = windowStart + offset;
            const item = byId.get(id);
            if (item === undefined) return null;
            const content = rowContent(item, layout);

            return (
              <RankedRow
                key={id}
                id={id}
                rank={index + 1}
                label={content.label}
                meta={content.meta}
                previewSources={content.previewSources}
                showImage={layout.pictureFields.length > 0}
                imageValue={content.imageValue}
                dragging={dragging?.id === id}
                insertBefore={insertionGap === index}
                insertAfter={insertionGap === orderedIds.length && index === orderedIds.length - 1}
                onGrab={handleGrab}
                onKeyMove={handleKeyMove}
                onRemove={onRemove === undefined ? undefined : handleRemove}
              />
            );
          })}
        </View>
        {unrecognized.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.divider}>Didn&apos;t recognize</Text>
            {unrecognized.map((item, index) => {
              const content = rowContent(item, layout);
              return (
                <RankedRow
                  key={item.id}
                  id={item.id}
                  rank={ranked.length + index + 1}
                  label={content.label}
                  meta={content.meta}
                  previewSources={content.previewSources}
                  showImage={layout.pictureFields.length > 0}
                  imageValue={content.imageValue}
                  dragging={dragging?.id === item.id}
                  unrecognized
                  onGrab={handleGrab}
                  onKeyMove={handleKeyMove}
                  onRemove={onRemove === undefined ? undefined : handleRemove}
                />
              );
            })}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

/** A row with nothing to grab: no position, just the item. */
function PlainRow({ item, layout }: { item: ListItem; layout: CardLayout }) {
  const content = rowContent(item, layout);
  return (
    <View role="listitem" style={styles.plainRow}>
      <View style={styles.plainBody}>
        <Text style={styles.plainLabel} numberOfLines={1}>
          {content.label}
        </Text>
        {content.meta !== null && (
          <Text style={styles.plainMeta} numberOfLines={1}>
            {content.meta}
          </Text>
        )}
      </View>
    </View>
  );
}

/** The nearest element that scrolls vertically, the list's own box first; the page if none does. */
function scrollerOf(start: Element): Element {
  for (let node: Element | null = start; node !== null; node = node.parentElement) {
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight + 1) {
      return node;
    }
  }
  return document.scrollingElement ?? document.documentElement;
}

interface RowContent {
  label: string;
  meta: string | null;
  previewSources: PreviewSource[];
  imageValue: string | undefined;
}

/**
 * What a row shows depends only on its item and the layout, and both keep their
 * identity across clicks, so each row is worked out once per layout rather than
 * on every render: a drag re-renders the list on each move.
 */
const rowContentCache = new WeakMap<CardLayout, WeakMap<ListItem, RowContent>>();

function rowContent(item: ListItem, layout: CardLayout): RowContent {
  let byItem = rowContentCache.get(layout);
  if (byItem === undefined) {
    byItem = new WeakMap();
    rowContentCache.set(layout, byItem);
  }
  let content = byItem.get(item);
  if (content === undefined) {
    const read = (field: string) => fieldOf(item, field);
    content = {
      label: selectItemLabel(item, layout.labelField),
      meta: metaFor(item, layout),
      previewSources: itemPreviewSources(read, layout.mediaFields, layout.renderers),
      imageValue: itemPictures(read, layout.pictureFields, layout.renderers)[0]?.uri,
    };
    byItem.set(item, content);
  }
  return content;
}

/**
 * The ticked fields as one line, each read the way its renderer draws it on
 * the cards - a row is a single line of text, so stars become `★ 9.2/10`.
 */
function metaFor(item: ListItem, layout: CardLayout): string | null {
  const parts = metaParts(item, layout);
  return parts.length === 0 ? null : parts.join('  ·  ');
}

/**
 * Each ticked field that has something to say, read as `metaFor` reads it.
 */
export function metaParts(item: ListItem, { plainFields, renderers }: CardLayout): string[] {
  return plainFields.flatMap((field) => {
    const renderer = renderers[field];
    const text = formatValue(fieldOf(item, field), renderer, field);
    if (text === null) return [];
    // A badge is its own name; anything else is named before its value.
    return [renderer === 'badge' ? text : `${fieldLabelFor(field, renderer)}: ${text}`];
  });
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: space.sm },
  scroll: { flex: 1 },
  listFrame: { flexGrow: 1 },
  list: { gap: space.xs },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    padding: space.md,
  },
  notice: {
    fontFamily: fonts.body,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
    padding: space.md,
  },
  divider: {
    fontFamily: fonts.body,
    fontSize: 11,
    color: colors.textFaint,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  plainRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: ROW_HEIGHT,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  plainBody: { flex: 1, minWidth: 0, gap: 1 },
  plainLabel: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  plainMeta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
