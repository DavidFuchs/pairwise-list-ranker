import { useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import type { LayoutChangeEvent } from 'react-native';

import { useFlipAnimation } from '@/lib/hooks/useFlipAnimation';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface RankedRowProps {
  id: string;
  rank: number;
  label: string;
  meta: string | null;
  rating: number;
  dragging: boolean;
  /** True while this row is the drop target under the pointer. */
  target: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onGrab: (pointerY: number) => void;
  onKeyMove: (direction: -1 | 1) => void;
}

export function RankedRow({
  id,
  rank,
  label,
  meta,
  rating,
  dragging,
  target,
  onLayout,
  onGrab,
  onKeyMove,
}: RankedRowProps) {
  // The row owns the geometry it animates from: the parent's copy exists for
  // pointer maths and is only ever read inside event handlers.
  const [y, setY] = useState(0);
  const offset = useFlipAnimation(id, y);

  return (
    <Animated.View
      role="listitem"
      onLayout={(event) => {
        setY(event.nativeEvent.layout.y);
        onLayout(event);
      }}
      style={[
        styles.row,
        target && styles.rowTarget,
        dragging && styles.rowDragging,
        { transform: [{ translateY: offset }] },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Reorder ${label}, position ${rank}. Hold alt and press the arrow keys to move it.`}
        onPointerDown={(event) => {
          event.preventDefault();
          onGrab(event.nativeEvent.clientY);
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
  rowTarget: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  rowDragging: { opacity: 0.92, borderColor: colors.accent },
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
