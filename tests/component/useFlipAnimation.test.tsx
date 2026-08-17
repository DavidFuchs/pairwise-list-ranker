/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Animated } from 'react-native';

import { useFlipAnimation } from '@/lib/hooks/useFlipAnimation';

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Reduced motion is read through matchMedia, as useReducedMotion does. */
function stubReducedMotion(matches: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches,
    media: query,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    onchange: null,
    dispatchEvent: vi.fn(),
  }));
}

/**
 * Observe the animated value through its public listener API rather than an
 * internal field, so the assertions describe what the row actually does.
 */
function track(value: Animated.Value): number[] {
  const seen: number[] = [];
  value.addListener((state) => seen.push(state.value));
  return seen;
}

const settle = () => act(async () => {
  await new Promise((resolve) => setTimeout(resolve, 400));
});

describe('useFlipAnimation', () => {
  it('emits nothing on first render', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useFlipAnimation('a', 0));
    const seen = track(result.current);

    expect(seen).toEqual([]);
  });

  it('offsets the row backwards the moment it moves down', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 0 },
    });
    const seen = track(result.current);

    rerender({ y: 120 });

    expect(seen[0]).toBe(-120);
  });

  it('offsets the row forwards when it moves up', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 120 },
    });
    const seen = track(result.current);

    rerender({ y: 0 });

    expect(seen[0]).toBe(120);
  });

  it('settles back to zero after a move', async () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 0 },
    });
    const seen = track(result.current);

    rerender({ y: 120 });
    await settle();

    expect(seen.at(-1)).toBe(0);
  });

  it('does not animate when the row has not moved', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 40 },
    });
    const seen = track(result.current);

    rerender({ y: 40 });

    expect(seen).toEqual([]);
  });

  it('never offsets under reduced motion', async () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 0 },
    });
    const seen = track(result.current);

    rerender({ y: 200 });
    await settle();

    expect(seen.every((value) => value === 0)).toBe(true);
  });

  it('treats a new key as a new row rather than a move', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ id, y }) => useFlipAnimation(id, y), {
      initialProps: { id: 'a', y: 0 },
    });
    const seen = track(result.current);

    rerender({ id: 'b', y: 300 });

    expect(seen).toEqual([]);
  });
});

describe('the first measurement', () => {
  /**
   * The bug this guards: rows report their position after mount, and treating
   * that first report as a move offset every row by its own height at once,
   * stacking the whole list on top of itself and swallowing every pointer.
   */
  it('treats the first measured position as a baseline, not a move', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: null as number | null },
    });
    const seen = track(result.current);

    rerender({ y: 144 });

    expect(seen).toEqual([]);
  });

  it('still animates a move that follows the first measurement', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: null as number | null },
    });
    const seen = track(result.current);

    rerender({ y: 144 });
    rerender({ y: 48 });

    expect(seen[0]).toBe(96);
  });
});
