import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RankedRow, ROW_HEIGHT } from '@/components/preview/RankedRow';
import { gapMovesRow, insertIndexForUniform, moveItem, targetIndexForGap } from '@/lib/ranking/reorder';
import { selectItemLabel } from '@/lib/state/selectors';
import { EMPTY_LAYOUT, formatValue, itemPictures, itemPreviewSources } from '@/lib/renderers';
import type { CardLayout, PreviewSource } from '@/lib/renderers';
import { colors, fonts, space } from '@/lib/theme';
import { fieldOf } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

export interface RankedListPreviewProps {
  ranking: RankedItem<ListItem>[];
  /** Which fields each row reads, and how; see cardLayout. */
  layout?: CardLayout;
  onReorder: (itemId: string, nextOrder: string[]) => void;
}

/** Short lists render whole: windowing buys nothing and costs a layout pass. */
const VIRTUALIZE_ABOVE = 60;
/** Rows kept mounted beyond each edge, so ordinary scrolling never shows a gap. */
const OVERSCAN = 8;
/** Used until the first layout reports the real height. */
const ASSUMED_VIEWPORT = 600;
const ROW_PITCH = ROW_HEIGHT + space.xs;


/**
 * The ranking, and the one place it can be arranged by hand. A manual move is
 * recorded as a placement in the comparison history: the item lands exactly
 * where it was dropped, nothing else moves, and nothing is discarded.
 */
export function RankedListPreview({
  ranking,
  layout = EMPTY_LAYOUT,
  onReorder,
}: RankedListPreviewProps) {
  const orderedIds = useMemo(() => ranking.map((entry) => entry.item.id), [ranking]);
  /**
   * Nothing moves until the drop. The rows hold still and a line marks the gap
   * the row will drop into, so the list never shifts under the pointer that is
   * aiming at it.
   */
  const [dragging, setDragging] = useState<{ id: string; gap: number } | null>(null);

  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(ASSUMED_VIEWPORT);

  const virtual = orderedIds.length > VIRTUALIZE_ABOVE;
  const windowStart = virtual
    ? Math.max(0, Math.floor(scrollTop / ROW_PITCH) - OVERSCAN)
    : 0;
  const windowEnd = virtual
    ? Math.min(
        orderedIds.length,
        Math.ceil((scrollTop + viewportHeight) / ROW_PITCH) + OVERSCAN,
      )
    : orderedIds.length;

  const byId = useMemo(() => new Map(ranking.map((entry) => [entry.item.id, entry])), [ranking]);

  /** Which gap to mark, or null when dropping here would change nothing. */
  const insertionGap = useMemo(() => {
    if (dragging === null) return null;
    const from = orderedIds.indexOf(dragging.id);
    if (from < 0 || !gapMovesRow(from, dragging.gap)) return null;
    return dragging.gap;
  }, [dragging, orderedIds]);

  const handleKeyMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = orderedIds.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= orderedIds.length) return;
      onReorder(id, moveItem(orderedIds, from, to));
    },
    [onReorder, orderedIds],
  );

  const handleGrab = useCallback(
    (id: string, startClientY: number, grip: HTMLElement) => {
      const from = orderedIds.indexOf(id);
      if (from < 0) return;

      /*
       * Measured from the DOM on every move, in the same viewport space the
       * pointer reports. Deriving it from onLayout instead means holding two
       * coordinate systems at once; an earlier attempt did, and every drag
       * silently went to the end of the list. Nothing moves until the drop, so
       * measuring fresh is safe. A windowed list has only some rows mounted,
       * but every row is the same height, so one measured row fixes where all
       * of them are.
       */
      const list = grip.closest('[role="list"]');
      if (list === null) return;

      const gapFor = (clientY: number) => {
        const first = list.querySelector('[role="listitem"]');
        if (first === null) return 0;
        const firstIndex = orderedIds.indexOf(first.getAttribute('data-id') ?? '');
        if (firstIndex < 0) return 0;
        return insertIndexForUniform(
          orderedIds.length,
          firstIndex,
          first.getBoundingClientRect().top,
          ROW_HEIGHT,
          ROW_PITCH,
          clientY,
        );
      };

      setDragging({ id, gap: gapFor(startClientY) });

      const stop = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
      };

      const onMove = (event: PointerEvent) => {
        const gap = gapFor(event.clientY);
        setDragging((current) => (current === null ? null : { ...current, gap }));
      };

      const onUp = (event: PointerEvent) => {
        stop();
        const gap = gapFor(event.clientY);
        setDragging(null);
        if (gapMovesRow(from, gap)) {
          onReorder(id, moveItem(orderedIds, from, targetIndexForGap(from, gap)));
        }
      };

      const onCancel = () => {
        stop();
        setDragging(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
    },
    [onReorder, orderedIds],
  );

  if (ranking.length === 0) {
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
          const entry = byId.get(id);
          if (entry === undefined) return null;
          const content = rowContent(entry.item, layout);

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
              rating={entry.state.rating}
              dragging={dragging?.id === id}
              insertBefore={insertionGap === index}
              insertAfter={insertionGap === orderedIds.length && index === orderedIds.length - 1}
              onGrab={handleGrab}
              onKeyMove={handleKeyMove}
            />
          );
        })}
        </View>
      </ScrollView>
    </View>
  );
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
function metaFor(
  item: ListItem,
  { plainFields, renderers }: CardLayout,
): string | null {
  if (plainFields.length === 0) return null;
  const parts = plainFields.flatMap((field) => {
    const renderer = renderers[field];
    const text = formatValue(fieldOf(item, field), renderer, field);
    if (text === null) return [];
    // A badge is its own name; anything else is named before its value.
    return [renderer === 'badge' ? text : `${field}: ${text}`];
  });
  return parts.length === 0 ? null : parts.join('  ·  ');
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
});
