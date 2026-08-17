import { useEffect, useRef, useState } from 'react';
import { Animated } from 'react-native';

import { useReducedMotion } from '@/lib/hooks/useReducedMotion';
import { motion } from '@/lib/theme';

/**
 * FLIP: the row is already painted at its new position, so offset it back by
 * the distance it moved and animate that offset to zero. The row appears to
 * slide from where it was without ever being laid out there.
 *
 * `key` identifies the row. A new key means a new row, which should appear in
 * place rather than fly in from wherever its predecessor sat.
 *
 * `y` is null until the row has been measured. The first measurement is a
 * baseline, never a move: treating it as one offsets every row by its own
 * height at mount, which stacks the whole list on top of itself.
 */
export function useFlipAnimation(key: string, y: number | null): Animated.Value {
  const reducedMotion = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const previous = useRef<{ key: string; y: number } | null>(null);

  useEffect(() => {
    if (y === null) return;

    const last = previous.current;
    previous.current = { key, y };

    if (last === null || last.key !== key) return;

    const delta = last.y - y;
    if (delta === 0) return;

    if (reducedMotion) {
      offset.setValue(0);
      return;
    }

    offset.setValue(delta);
    const animation = Animated.timing(offset, {
      toValue: 0,
      duration: motion.cardSwapMs,
      useNativeDriver: false,
    });
    animation.start();
    return () => animation.stop();
  }, [key, y, offset, reducedMotion]);

  return offset;
}
