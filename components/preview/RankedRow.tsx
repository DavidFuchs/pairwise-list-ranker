import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { useFlipAnimation } from '@/lib/hooks/useFlipAnimation';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface RankedRowProps {
  id: string;
  rank: number;
  label: string;
  meta: string | null;
  rating: number;
  /** True while this row is the one being dragged. */
  dragging: boolean;
  /** Draw the drop indicator above this row, or below it for the last gap. */
  insertBefore?: boolean;
  insertAfter?: boolean;
  onGrab: (pointerY: number, grip: HTMLElement) => void;
  onKeyMove: (direction: -1 | 1) => void;
}

export function RankedRow({
  id,
  rank,
  label,
  meta,
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
      dataSet={dragging ? { dragging: 'true' } : undefined}
      style={[styles.row, dragging && styles.rowDragging, { transform: [{ translateY: offset }] }]}
    >
      {insertBefore && <View style={styles.insertBefore} dataSet={{ insertion: 'true' }} />}
      {insertAfter && <View style={styles.insertAfter} dataSet={{ insertion: 'true' }} />}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${label}, position ${rank}. Hold alt and press the arrow keys to move it.`}
        onPointerDown={(event) => {
          event.preventDefault();
          onGrab(event.nativeEvent.clientY, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          if (event.key === 'ArrowUp') {
            event.preventDefault();
            onKeyMove(-1);
          }
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            onKeyMove(1);
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

      <View style={styles.body}>
        <Text style={styles.label} numberOfLines={2}>
          {label}
        </Text>
        {meta !== null && (
          <Text style={styles.meta} numberOfLines={1}>
            {meta}
          </Text>
        )}
      </View>

      <Text style={styles.rating}>{Math.round(rating)}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
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
  body: { flex: 1, gap: 1 },
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
