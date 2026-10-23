import { memo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { FieldImage } from '@/components/preview/FieldImage';
import { PreviewButton } from '@/components/preview/PreviewButton';
import { TrashIcon } from '@/components/ui/TrashIcon';
import { useFlipAnimation } from '@/lib/hooks/useFlipAnimation';
import type { PreviewSource } from '@/lib/renderers';
import { colors, fonts, radius, space } from '@/lib/theme';

/** Rows are one fixed height so a long list can be windowed without measuring. */
export const ROW_HEIGHT = 56;

const THUMB_SIZE = 40;

/** One place up or down, or straight to an end of the list. */
export type KeyMove = -1 | 1 | 'top' | 'bottom';

/** Alt with these keys moves a row; Home and End carry it the length of a long list at once. */
const KEY_MOVES: Record<string, KeyMove> = { ArrowUp: -1, ArrowDown: 1, Home: 'top', End: 'bottom' };

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
  /** True while this row is the one being dragged. */
  dragging: boolean;
  /**
   * A "Didn't recognize" row: its grip moves it back into the ranking, and
   * says so. Which keys do what is the list's to decide.
   */
  unrecognized?: boolean;
  /** Draw the drop indicator above this row, or below it for the last gap. */
  insertBefore?: boolean;
  insertAfter?: boolean;
  /** Take the row's id, so one callback serves every row and a row need not re-render for a new one. */
  onGrab: (id: string, pointerY: number, grip: HTMLElement) => void;
  onKeyMove: (id: string, move: KeyMove) => void;
  /**
   * Removes the item, after the same confirmation a card asks for: removing a
   * row and removing a card are one action (docs/ARCHITECTURE.md 6.2). Absent, no control.
   */
  onRemove?: (id: string) => void;
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
  dragging,
  unrecognized = false,
  insertBefore = false,
  insertAfter = false,
  onGrab,
  onKeyMove,
  onRemove,
}: RankedRowProps) {
  // Null until measured: the first layout is a baseline, not a movement.
  const [y, setY] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
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
        accessibilityLabel={
          unrecognized
            ? `Move ${label} back into the ranking, from "Didn't recognize". Hold alt and press the up arrow to put it last in the ranking, or Home to put it first.`
            : `Reorder ${label}, position ${rank}. Hold alt and press the arrow keys to move it, or Home or End to send it to the top or bottom.`
        }
        onPointerDown={(event) => {
          event.preventDefault();
          onGrab(id, event.nativeEvent.clientY, event.currentTarget);
        }}
        onKeyDown={(event) => {
          if (!event.altKey) return;
          const move = KEY_MOVES[event.key];
          if (move === undefined) return;
          event.preventDefault();
          onKeyMove(id, move);
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

      {confirming ? (
        <View style={styles.confirm}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remove ${label}`}
            onPress={() => {
              setConfirming(false);
              onRemove?.(id);
            }}
            style={styles.confirmButton}
          >
            <Text style={styles.confirmRemove}>Remove</Text>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Keep ${label}`}
            onPress={() => setConfirming(false)}
            style={styles.confirmButton}
          >
            <Text style={styles.confirmKeep}>Keep</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <PreviewButton sources={previewSources} label={label} compact />
          {onRemove !== undefined && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Remove ${label} from the list`}
              onPress={() => setConfirming(true)}
              dataSet={{ remove: 'row' }}
              style={styles.removeButton}
            >
              <TrashIcon />
            </Pressable>
          )}
        </>
      )}
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
  // The full height of the row and wide enough for a fingertip. touchAction is
  // set here rather than only in the stylesheet: React Native Web gives every
  // pressable touch-action: manipulation, which would otherwise win and turn a
  // drag into a page scroll on a touch screen.
  grip: {
    alignSelf: 'stretch',
    width: 36,
    marginLeft: -space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    touchAction: 'none',
  } as object,
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
  removeButton: {
    alignSelf: 'stretch',
    width: 32,
    marginRight: -space.xs,
    alignItems: 'center',
    justifyContent: 'center',
  },
  confirm: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  confirmButton: { paddingHorizontal: space.sm, paddingVertical: space.xs, borderRadius: radius.sm },
  confirmRemove: { fontFamily: fonts.body, fontSize: 13, fontWeight: '600', color: colors.dangerText },
  confirmKeep: { fontFamily: fonts.body, fontSize: 13, color: colors.textSecondary },
});
