import { memo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldImage } from '@/components/preview/FieldImage';
import { PreviewButton } from '@/components/preview/PreviewButton';
import { useFlipAnimation } from '@/lib/hooks/useFlipAnimation';
import type { PreviewSource } from '@/lib/renderers';
import { colors, fonts, radius, space } from '@/lib/theme';

/** Rows are one fixed height so a long list can be windowed without measuring. */
export const ROW_HEIGHT = 56;

const THUMB_SIZE = 40;

export interface RankedRowProps {
  id: string;
  rank: number;
  label: string;
  meta: string | null;
  /** Where the row's play button looks for a clip, in order. */
  previewSources?: PreviewSource[];
  /** True when a field is drawn as an image: every row then keeps a frame for one. */
  showImage?: boolean;
  imageValue?: unknown;
  rating: number;
  /** True while this row is the one being dragged. */
  dragging: boolean;
  /** Draw the drop indicator above this row, or below it for the last gap. */
  insertBefore?: boolean;
  insertAfter?: boolean;
  /** Take the row's id, so one callback serves every row and a row need not re-render for a new one. */
  onGrab: (id: string, pointerY: number, grip: HTMLElement) => void;
  onKeyMove: (id: string, direction: -1 | 1) => void;
}

/**
 * Memoized: a drag re-renders the list on every pointer move, and only the rows
 * whose drag state or drop line changed need to draw again.
 */
export const RankedRow = memo(function RankedRow({
  id,
  rank,
  label,
  meta,
  previewSources = [],
  showImage = false,
  imageValue,
  rating,
  dragging,
  insertBefore = false,
  insertAfter = false,
  onGrab,
  onKeyMove,
}: RankedRowProps) {
  // Null until measured: the first layout is a baseline, not a movement.
  const [y, setY] = useState<number | null>(null);
  const offset = useFlipAnimation(id, y);

  return (
    <Animated.View
      role="listitem"
      onLayout={(event) => setY(event.nativeEvent.layout.y)}
      dataSet={dragging ? { id, dragging: 'true' } : { id }}
      style={[styles.row, dragging && styles.rowDragging, { transform: [{ translateY: offset }] }]}
    >
      {insertBefore && <View style={styles.insertBefore} dataSet={{ insertion: 'true' }} />}
      {insertAfter && <View style={styles.insertAfter} dataSet={{ insertion: 'true' }} />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${label}, position ${rank}. Hold alt and press the arrow keys to move it.`}
        onPointerDown={(event) => {
          event.preventDefault();
          onGrab(id, event.nativeEvent.clientY, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            onKeyMove(id, -1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onKeyMove(id, 1);
          }
        }}
        dataSet={{ grip: 'true' }}
        style={styles.grip}
      >
        <Text style={styles.gripGlyph}>⠿</Text>
      </Pressable>

      <View style={styles.position}>
        <Text style={styles.positionText}>{String(rank)}</Text>
      </View>

      {showImage && <FieldImage value={imageValue} size={THUMB_SIZE} label={label} />}

      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={1}>
          {label}
        </Text>
        {meta !== null && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <PreviewButton sources={previewSources} label={label} compact />

      <Text style={styles.rating}>{Math.round(rating)}</Text>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: ROW_HEIGHT,
    paddingHorizontal: space.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowDragging: { borderColor: colors.accent, backgroundColor: colors.accentSoft },
  /** Sits in the 4px gap between rows, so nothing shifts to make room. */
  insertBefore: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: -3,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  insertAfter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: -3,
    height: 2,
    borderRadius: 1,
    backgroundColor: colors.accent,
  },
  grip: { paddingHorizontal: space.xs, paddingVertical: space.xs },
  gripGlyph: { fontFamily: fonts.mono, fontSize: 13, color: colors.textFaint },
  position: {
    minWidth: 26,
    height: 26,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  positionText: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  body: { flex: 1, minWidth: 0, gap: 1 },
  label: {
    fontFamily: fonts.body,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  meta: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  rating: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
