# Sortable Ranking and Comparison Stage Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user drag the ranked list into the order they want - which starts a fresh ranking session from that order - and rebuild the comparison cards so the card itself is the choice.

**Architecture:** The ranking stays a pure derivation from comparison history. A drag commits by rewriting the source document's array order and running it through `startRanking`, the existing fresh-import path, so no override layer is added. The comparison card's root becomes the pressable; the two footer buttons are replaced by the card itself plus a small circular 🔥 button.

**Tech Stack:** Expo Router, React Native Web, Zustand, the `Animated` API (no new dependencies), Vitest + React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-sortable-ranking-and-card-redesign-design.md` - read it before starting.

## Global Constraints

- **No new dependencies.** Drag is pointer events; motion is the `Animated` API already in use. Reanimated and Gesture Handler are explicitly out.
- **Path alias:** `@/` resolves to the repo root.
- **Components are React Native** through `react-native-web`. Styling uses `StyleSheet.create` with tokens from `@/lib/theme`.
- **Test environment:** component tests start with `/** @vitest-environment jsdom */` on line 1.
- **Commands:** single file `npx vitest run <path>`; suite `npm test`; types `npm run typecheck`; lint `npm run lint`; e2e `npm run e2e`.
- **Every commit message ends with** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` after a blank line.
- **Accessibility:** every interactive element needs an `accessibilityLabel`; drag has a keyboard equivalent; `useReducedMotion` short-circuits every animation.
- **One saturated accent.** The flame emoji carries its own warmth; its chrome stays neutral or soft-accent.

## File Structure

| File | Responsibility |
| --- | --- |
| `lib/ranking/reorder.ts` (new) | `moveItem`, `dropIndexFor`, `RowOffset` - pure, no DOM |
| `lib/hooks/useFlipAnimation.ts` (new) | measure → diff → animate to zero, per row |
| `components/preview/RankedRow.tsx` (new) | one row: grip, label, meta, rating, its own animation |
| `components/comparison/StrongChoiceButton.tsx` (new) | the circular 🔥 |
| `components/preview/RankedListPreview.tsx` | drag state, keyboard reorder, confirm footer |
| `components/comparison/ItemCard.tsx` | pressable root, flame, hover hint, keycap |
| `components/comparison/ComparisonDeck.tsx` | gutter divider, hint line, dead-prop removal |
| `lib/state/useListStore.ts` | `reorderAndRestart` |

---

### Task 1: Reorder maths

**Files:**
- Create: `lib/ranking/reorder.ts`
- Test: `tests/unit/ranking/reorder.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `interface RowOffset { y: number; height: number }`
  - `moveItem<T>(items: T[], from: number, to: number): T[]`
  - `dropIndexFor(offsets: RowOffset[], pointerY: number): number`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/ranking/reorder.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { dropIndexFor, moveItem } from '@/lib/ranking/reorder';
import type { RowOffset } from '@/lib/ranking/reorder';

const ids = ['a', 'b', 'c', 'd'];

describe('moveItem', () => {
  it('moves an item later', () => {
    expect(moveItem(ids, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item earlier', () => {
    expect(moveItem(ids, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('moves an item to the front', () => {
    expect(moveItem(ids, 2, 0)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('moves an item to the end', () => {
    expect(moveItem(ids, 1, 3)).toEqual(['a', 'c', 'd', 'b']);
  });

  it('returns an equal list when nothing moves', () => {
    expect(moveItem(ids, 2, 2)).toEqual(ids);
  });

  it('does not mutate the input', () => {
    const input = [...ids];
    moveItem(input, 0, 3);

    expect(input).toEqual(ids);
  });

  it('clamps indexes past the end', () => {
    expect(moveItem(ids, 0, 99)).toEqual(['b', 'c', 'd', 'a']);
  });

  it('clamps negative indexes', () => {
    expect(moveItem(ids, 3, -5)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('ignores a source index that does not exist', () => {
    expect(moveItem(ids, 9, 0)).toEqual(ids);
  });
});

const offsets: RowOffset[] = [
  { y: 0, height: 40 },
  { y: 40, height: 40 },
  { y: 80, height: 60 },
  { y: 140, height: 40 },
];

describe('dropIndexFor', () => {
  it('lands on the first row above everything', () => {
    expect(dropIndexFor(offsets, -20)).toBe(0);
  });

  it('lands on the last row below everything', () => {
    expect(dropIndexFor(offsets, 999)).toBe(3);
  });

  it('stays on a row above its midpoint', () => {
    expect(dropIndexFor(offsets, 45)).toBe(1);
  });

  it('moves to the next row past a midpoint', () => {
    expect(dropIndexFor(offsets, 75)).toBe(2);
  });

  it('respects the midpoint of a taller row', () => {
    expect(dropIndexFor(offsets, 105)).toBe(2);
    expect(dropIndexFor(offsets, 115)).toBe(3);
  });

  it('returns 0 for an empty list', () => {
    expect(dropIndexFor([], 50)).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/ranking/reorder.test.ts`
Expected: FAIL - `Failed to resolve import "@/lib/ranking/reorder"`.

- [ ] **Step 3: Implement**

Create `lib/ranking/reorder.ts`:

```ts
/** A row's measured geometry within the scrolling list. */
export interface RowOffset {
  y: number;
  height: number;
}

/** The list with one entry moved. Both indexes are clamped into range. */
export function moveItem<T>(items: T[], from: number, to: number): T[] {
  if (from < 0 || from >= items.length) return items;

  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return items;

  const target = Math.max(0, Math.min(to, next.length));
  next.splice(target, 0, moved);
  return next;
}

/**
 * Which slot the pointer is over. A row claims the pointer until it passes the
 * row's midpoint, which is what makes a drag feel like it snaps one slot at a
 * time rather than jittering around the boundary.
 */
export function dropIndexFor(offsets: RowOffset[], pointerY: number): number {
  if (offsets.length === 0) return 0;

  for (let index = 0; index < offsets.length; index += 1) {
    const row = offsets[index];
    if (row === undefined) continue;
    if (pointerY < row.y + row.height / 2) return index;
  }

  return offsets.length - 1;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/ranking/reorder.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/reorder.ts tests/unit/ranking/reorder.test.ts
git commit -m "feat: add reorder maths for the ranked list"
```

---

### Task 2: Reordering restarts the session

**Files:**
- Modify: `lib/state/useListStore.ts`
- Test: `tests/unit/state/useListStore.test.ts` (append a describe block)

**Interfaces:**
- Consumes: `buildExport`, `buildExportDocument` (`@/lib/export/buildExport`); `startRanking` (same store).
- Produces: `reorderAndRestart(itemIds: string[]): void` on `ListState`.

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/state/useListStore.test.ts`:

```ts
describe('reorderAndRestart', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('applies the new order', () => {
    const [first, second] = store.getState().items;

    store.getState().reorderAndRestart([second?.id ?? '', first?.id ?? '']);

    expect(store.getState().items.map((item) => item.value)).toEqual([
      { title: 'Arrival' },
      { title: 'Alien' },
    ]);
  });

  it('clears the comparison history', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().comparisonEvents).toEqual([]);
  });

  it('writes the new order into the source document', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());
    const document = store.getState().workspace?.source.document as {
      movies: { title: string }[];
    };

    expect(document.movies.map((entry) => entry.title)).toEqual(['Arrival', 'Alien']);
  });

  it('keeps the wrapper keys of the source document', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().workspace?.source.document).toMatchObject({ owner: 'david' });
  });

  it('regenerates the raw text, so editing shows the new order', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());
    const rawText = store.getState().workspace?.source.rawText ?? '';

    expect(rawText.indexOf('Arrival')).toBeLessThan(rawText.indexOf('Alien'));
  });

  it('keeps the workspace name', () => {
    store.getState().setName('Films');
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids].reverse());

    expect(store.getState().workspace?.name).toBe('Films');
  });

  it('drops items that were removed during comparison', () => {
    const ids = store.getState().items.map((item) => item.id);
    store.getState().removeItem(ids[0] ?? '');

    store.getState().reorderAndRestart([ids[1] ?? '']);

    expect(store.getState().items).toHaveLength(1);
    expect(store.getState().items[0]?.value).toEqual({ title: 'Arrival' });
  });

  it('ignores ids that are not in the list', () => {
    const ids = store.getState().items.map((item) => item.id);

    store.getState().reorderAndRestart([...ids, 'nonsense']);

    expect(store.getState().items).toHaveLength(2);
  });

  it('does nothing without a workspace', () => {
    const empty = makeStore();

    empty.getState().reorderAndRestart(['a']);

    expect(empty.getState().workspace).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/state/useListStore.test.ts`
Expected: FAIL - `reorderAndRestart is not a function`.

- [ ] **Step 3: Implement**

In `lib/state/useListStore.ts`, add the import:

```ts
import { buildExport, buildExportDocument } from '@/lib/export/buildExport';
```

Declare it on `ListState`, directly under `applyEdits`:

```ts
  /** Manual ordering restarts ranking from that order. See the spec, section 3. */
  reorderAndRestart(itemIds: string[]): void;
```

and implement it directly after the `applyEdits` action:

```ts
      /**
       * A hand-arranged order becomes the new starting point. Rather than
       * layering manual positions over the derived ranking, the reordered array
       * is written back into the user's document and re-imported, so the
       * ranking stays a pure derivation of comparison history.
       */
      reorderAndRestart(itemIds: string[]) {
        const { workspace, items } = get();
        if (workspace === null) return;

        const byId = new Map(items.map((item) => [item.id, item]));
        const ordered = itemIds
          .map((id) => byId.get(id))
          .filter((item): item is ListItem => item !== undefined && item.active);
        if (ordered.length === 0) return;

        const entries = ordered.map((item) => item.value);
        const document = buildExportDocument(workspace.source, workspace.roles, entries);
        const rawText = buildExport(
          workspace.source,
          workspace.roles,
          ordered,
          workspace.source.format,
        );

        get().startRanking({
          source: { ...workspace.source, document, rawText },
          roles: workspace.roles,
          name: workspace.name,
        });
      },
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/state/useListStore.test.ts`
Expected: PASS, 26 tests.

- [ ] **Step 5: Run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add lib/state/useListStore.ts tests/unit/state/useListStore.test.ts
git commit -m "feat: reordering by hand restarts ranking from that order"
```

---

### Task 3: FLIP animation hook

**Files:**
- Create: `lib/hooks/useFlipAnimation.ts`
- Test: `tests/component/useFlipAnimation.test.tsx`

**Interfaces:**
- Consumes: `useReducedMotion` (`@/lib/hooks/useReducedMotion`), `motion` tokens (`@/lib/theme`).
- Produces: `useFlipAnimation(key: string, y: number): Animated.Value` - a `translateY` that starts at the distance the row just moved and animates to zero.

**How FLIP works here:** each row reports its measured `y`. When that `y` changes, the row is already painted in its new place, so the row is offset *backwards* by the difference and animated to zero - it appears to slide from where it was.

- [ ] **Step 1: Write the failing test**

Create `tests/component/useFlipAnimation.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

describe('useFlipAnimation', () => {
  it('rests at zero on first render', () => {
    stubReducedMotion(false);
    const { result } = renderHook(() => useFlipAnimation('a', 0));

    expect((result.current as unknown as { _value: number })._value).toBe(0);
  });

  it('settles back to zero after a move', async () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 0 },
    });

    rerender({ y: 120 });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 400));
    });

    expect((result.current as unknown as { _value: number })._value).toBe(0);
  });

  it('does not animate when the row has not moved', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 40 },
    });

    rerender({ y: 40 });

    expect((result.current as unknown as { _value: number })._value).toBe(0);
  });

  it('stays at zero under reduced motion', () => {
    stubReducedMotion(true);
    const { result, rerender } = renderHook(({ y }) => useFlipAnimation('a', y), {
      initialProps: { y: 0 },
    });

    rerender({ y: 200 });

    expect((result.current as unknown as { _value: number })._value).toBe(0);
  });

  it('treats a new key as a new row rather than a move', () => {
    stubReducedMotion(false);
    const { result, rerender } = renderHook(({ key, y }) => useFlipAnimation(key, y), {
      initialProps: { key: 'a', y: 0 },
    });

    rerender({ key: 'b', y: 300 });

    expect((result.current as unknown as { _value: number })._value).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/component/useFlipAnimation.test.tsx`
Expected: FAIL - `Failed to resolve import "@/lib/hooks/useFlipAnimation"`.

- [ ] **Step 3: Implement**

Create `lib/hooks/useFlipAnimation.ts`:

```ts
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
 */
export function useFlipAnimation(key: string, y: number): Animated.Value {
  const reducedMotion = useReducedMotion();
  const [offset] = useState(() => new Animated.Value(0));
  const previous = useRef<{ key: string; y: number } | null>(null);

  useEffect(() => {
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
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/component/useFlipAnimation.test.tsx`
Expected: PASS, 5 tests.

If `motion.cardSwapMs` does not exist, read `lib/theme.ts` and use the nearest existing duration token rather than inventing a number.

- [ ] **Step 5: Commit**

```bash
git add lib/hooks/useFlipAnimation.ts tests/component/useFlipAnimation.test.tsx
git commit -m "feat: add a FLIP animation hook for list reordering"
```

---

### Task 4: The draggable ranked list

**Files:**
- Create: `components/preview/RankedRow.tsx`
- Rewrite: `components/preview/RankedListPreview.tsx`
- Test: `tests/component/RankedListPreview.test.tsx`

**Interfaces:**
- Consumes: `moveItem`, `dropIndexFor`, `RowOffset` (Task 1); `useFlipAnimation` (Task 3); `selectItemLabel` (`@/lib/state/selectors`).
- Produces:
  - `<RankedRow entry index label meta dragging onLayout onGrab onKeyMove />`
  - `<RankedListPreview ranking sortField comparisonCount onReorder />` - `onReorder: (itemIds: string[]) => void`

**Interaction contract:** the grip starts a drag; the pointer moves it; release commits. `Alt+ArrowUp` / `Alt+ArrowDown` on a focused row moves it one slot. Both routes end at the same place: a pending order held in local state, which is either applied straight away (no comparisons to lose) or held behind the confirmation.

- [ ] **Step 1: Write the failing test**

Create `tests/component/RankedListPreview.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RankedListPreview } from '@/components/preview/RankedListPreview';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

const NOW = '2026-08-16T00:00:00.000Z';

function ranked(labels: string[]): RankedItem<ListItem>[] {
  return labels.map((label, index) => ({
    rank: index + 1,
    item: {
      id: `item-${index}`,
      listId: 'ws-1',
      value: label,
      active: true,
      createdAt: NOW,
      updatedAt: NOW,
    },
    state: {
      itemId: `item-${index}`,
      rating: 1500 - index,
      comparisons: 0,
      wins: 0,
      losses: 0,
      skips: 0,
    },
  }));
}

function setup(overrides: Partial<React.ComponentProps<typeof RankedListPreview>> = {}) {
  const props = {
    ranking: ranked(['Tacos', 'Ramen', 'Curry']),
    comparisonCount: 0,
    onReorder: vi.fn(),
    ...overrides,
  };
  render(<RankedListPreview {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('RankedListPreview', () => {
  it('lists the ranking in order', () => {
    setup();

    expect(screen.getByText('Tacos')).toBeDefined();
    expect(screen.getByText('Curry')).toBeDefined();
  });

  it('says so when there is nothing to show', () => {
    setup({ ranking: [] });

    expect(screen.getByText(/nothing here yet/i)).toBeDefined();
  });

  it('offers a grip on every row', () => {
    setup();

    expect(screen.getByLabelText(/reorder tacos/i)).toBeDefined();
    expect(screen.getByLabelText(/reorder curry/i)).toBeDefined();
  });

  it('moves a row down with alt and arrow down', async () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).toHaveBeenCalledWith(['item-1', 'item-0', 'item-2']);
  });

  it('moves a row up with alt and arrow up', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).toHaveBeenCalledWith(['item-0', 'item-2', 'item-1']);
  });

  it('ignores arrow keys without alt, so scrolling still works', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown' });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not move the first row up', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowUp', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('does not move the last row down', () => {
    const { onReorder } = setup();

    fireEvent.keyDown(screen.getByLabelText(/reorder curry/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
  });

  it('asks before discarding comparisons', () => {
    const { onReorder } = setup({ comparisonCount: 47 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getByText(/47 comparisons/i)).toBeDefined();
    expect(screen.getByText(/starts a new ranking session/i)).toBeDefined();
  });

  it('applies the reorder once confirmed', async () => {
    const { onReorder, user } = setup({ comparisonCount: 47 });
    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    await user.click(screen.getByRole('button', { name: /reorder and restart/i }));

    expect(onReorder).toHaveBeenCalledWith(['item-1', 'item-0', 'item-2']);
  });

  it('restores the previous order on cancel', async () => {
    const { onReorder, user } = setup({ comparisonCount: 47 });
    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.queryByText(/starts a new ranking session/i)).toBeNull();
  });

  it('shows the pending order while the confirmation is open', () => {
    setup({ comparisonCount: 47 });

    fireEvent.keyDown(screen.getByLabelText(/reorder tacos/i), { key: 'ArrowDown', altKey: true });

    const rows = screen.getAllByRole('listitem');

    expect(rows[0]?.textContent).toContain('Ramen');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/component/RankedListPreview.test.tsx`
Expected: FAIL - the component takes no `comparisonCount` or `onReorder`, and has no grips.

- [ ] **Step 3: Write the row**

Create `components/preview/RankedRow.tsx`:

```tsx
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
  /** Measured top of the row, used to animate it between positions. */
  y: number;
  dragging: boolean;
  /** True while this row is the drop target under the pointer. */
  target: boolean;
  onLayout: (event: LayoutChangeEvent) => void;
  onGrab: (pointerY: number, pointerId: number) => void;
  onKeyMove: (direction: -1 | 1) => void;
}

export function RankedRow({
  id,
  rank,
  label,
  meta,
  rating,
  y,
  dragging,
  target,
  onLayout,
  onGrab,
  onKeyMove,
}: RankedRowProps) {
  const offset = useFlipAnimation(id, y);

  return (
    <Animated.View
      role="listitem"
      onLayout={onLayout}
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
          onGrab(event.nativeEvent.clientY, event.nativeEvent.pointerId);
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
  rowDragging: { opacity: 0.9, borderColor: colors.accent },
  grip: { paddingHorizontal: space.xs, paddingVertical: space.xs, cursor: 'grab' },
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
```

- [ ] **Step 4: Rewrite the list**

Replace `components/preview/RankedListPreview.tsx`:

```tsx
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { RankedRow } from '@/components/preview/RankedRow';
import { Button } from '@/components/ui/Button';
import { dropIndexFor, moveItem } from '@/lib/ranking/reorder';
import type { RowOffset } from '@/lib/ranking/reorder';
import { selectItemLabel } from '@/lib/state/selectors';
import { colors, fonts, radius, space } from '@/lib/theme';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

export interface RankedListPreviewProps {
  ranking: RankedItem<ListItem>[];
  sortField?: string;
  /** Rated comparisons that a reorder would discard. */
  comparisonCount: number;
  onReorder: (itemIds: string[]) => void;
}

const MAX_META_FIELDS = 2;

/**
 * The ranking, and the one place it can be arranged by hand. A manual order
 * restarts ranking from that order, so anything that would discard real work
 * asks first.
 */
export function RankedListPreview({
  ranking,
  sortField,
  comparisonCount,
  onReorder,
}: RankedListPreviewProps) {
  const derivedIds = useMemo(() => ranking.map((entry) => entry.item.id), [ranking]);
  const [pendingIds, setPendingIds] = useState<string[] | null>(null);
  const [dragging, setDragging] = useState<{ id: string; targetIndex: number } | null>(null);
  const [confirming, setConfirming] = useState(false);
  const offsets = useRef(new Map<string, RowOffset>());

  const byId = useMemo(
    () => new Map(ranking.map((entry) => [entry.item.id, entry])),
    [ranking],
  );
  const orderedIds = pendingIds ?? derivedIds;

  /** Apply straight away when nothing is at stake; otherwise ask first. */
  const commit = useCallback(
    (nextIds: string[]) => {
      setPendingIds(nextIds);
      if (comparisonCount === 0) {
        setPendingIds(null);
        onReorder(nextIds);
        return;
      }
      setConfirming(true);
    },
    [comparisonCount, onReorder],
  );

  const handleKeyMove = useCallback(
    (id: string, direction: -1 | 1) => {
      const from = orderedIds.indexOf(id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= orderedIds.length) return;
      commit(moveItem(orderedIds, from, to));
    },
    [commit, orderedIds],
  );

  const handleGrab = useCallback(
    (id: string, pointerId: number) => {
      setDragging({ id, targetIndex: orderedIds.indexOf(id) });

      const rows = () =>
        orderedIds
          .map((rowId) => offsets.current.get(rowId))
          .filter((row): row is RowOffset => row !== undefined);

      const onMove = (event: PointerEvent) => {
        const index = dropIndexFor(rows(), event.clientY);
        setDragging((current) => (current === null ? null : { ...current, targetIndex: index }));
      };

      const onUp = (event: PointerEvent) => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);

        const from = orderedIds.indexOf(id);
        const to = dropIndexFor(rows(), event.clientY);
        setDragging(null);
        if (from !== to) commit(moveItem(orderedIds, from, to));
      };

      const onCancel = () => {
        window.removeEventListener('pointermove', onMove);
        window.removeEventListener('pointerup', onUp);
        window.removeEventListener('pointercancel', onCancel);
        setDragging(null);
      };

      window.addEventListener('pointermove', onMove);
      window.addEventListener('pointerup', onUp);
      window.addEventListener('pointercancel', onCancel);
      void pointerId;
    },
    [commit, orderedIds],
  );

  if (ranking.length === 0) {
    return <Text style={styles.empty}>Nothing here yet. Import a list to see it ranked.</Text>;
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} role="list">
        {orderedIds.map((id, index) => {
          const entry = byId.get(id);
          if (entry === undefined) return null;
          const label = selectItemLabel(entry.item, sortField);

          return (
            <RankedRow
              key={id}
              id={id}
              rank={index + 1}
              label={label}
              meta={metaFor(entry.item, sortField)}
              rating={entry.state.rating}
              y={offsets.current.get(id)?.y ?? 0}
              dragging={dragging?.id === id}
              target={dragging !== null && dragging.id !== id && dragging.targetIndex === index}
              onLayout={(event) => {
                const { y, height } = event.nativeEvent.layout;
                offsets.current.set(id, { y, height });
              }}
              onGrab={(_pointerY, pointerId) => handleGrab(id, pointerId)}
              onKeyMove={(direction) => handleKeyMove(id, direction)}
            />
          );
        })}
      </ScrollView>

      {confirming && (
        <View style={styles.confirm} role="alert">
          <Text style={styles.confirmText}>
            {`Reordering by hand starts a new ranking session. Your ${comparisonCount} comparisons are cleared, and this order becomes the starting point.`}
          </Text>
          <View style={styles.confirmActions}>
            <Button
              label="Cancel"
              accessibilityLabel="Cancel reordering"
              variant="ghost"
              size="sm"
              onPress={() => {
                setConfirming(false);
                setPendingIds(null);
              }}
            />
            <Button
              label="Reorder and restart"
              accessibilityLabel="Reorder and restart"
              variant="primary"
              size="sm"
              onPress={() => {
                const next = pendingIds;
                setConfirming(false);
                setPendingIds(null);
                if (next !== null) onReorder(next);
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

function metaFor(item: ListItem, sortField: string | undefined): string | null {
  if (!isComplexItemValue(item.value)) return null;

  const parts = Object.entries(item.value)
    .filter(([key, value]) => key !== sortField && isScalar(value))
    .slice(0, MAX_META_FIELDS)
    .map(([key, value]) => `${key}: ${String(value)}`);

  return parts.length === 0 ? null : parts.join('  ·  ');
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: space.sm },
  scroll: { flex: 1 },
  list: { gap: space.xs, paddingBottom: space.md },
  empty: {
    fontFamily: fonts.body,
    fontSize: 14,
    color: colors.textSecondary,
    padding: space.md,
  },
  confirm: {
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  confirmText: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  confirmActions: { flexDirection: 'row', gap: space.sm, justifyContent: 'flex-end' },
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/component/RankedListPreview.test.tsx`
Expected: PASS, 13 tests.

- [ ] **Step 6: Wire it to the store**

`PreviewPane` passes the two new props through. In `components/preview/PreviewPane.tsx`, add to `PreviewPaneProps`:

```ts
  comparisonCount: number;
  onReorder: (itemIds: string[]) => void;
```

destructure them, and pass them to `RankedListPreview`:

```tsx
          <RankedListPreview
            ranking={ranking}
            sortField={labelField}
            comparisonCount={comparisonCount}
            onReorder={onReorder}
          />
```

In `app/rank.tsx`, pass them from the store:

```tsx
          comparisonCount={progress.comparisons}
          onReorder={(itemIds) => listStore.getState().reorderAndRestart(itemIds)}
```

Update the three `PreviewPane` renders in `tests/component/PreviewPane.test.tsx` and
`tests/component/accessibility.test.tsx` with `comparisonCount={0}` and `onReorder={vi.fn()}`.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/preview app/rank.tsx tests/component
git commit -m "feat: drag or keyboard-arrange the ranked list"
```

---

### Task 5: The card is the choice

**Files:**
- Create: `components/comparison/StrongChoiceButton.tsx`
- Modify: `components/comparison/ItemCard.tsx`
- Test: `tests/component/ItemCard.test.tsx` (extend the existing file)

**Interfaces:**
- Consumes: `useReducedMotion`, theme tokens.
- Produces: `<StrongChoiceButton label onPress />` - a 40px circular 🔥.
- `ItemCardProps` is unchanged: the same `onChoose`, `onChooseStrong`, and delete callbacks, driven from new places on the card.

**The propagation rule:** the card's root is the pressable. Every nested control calls `stopPropagation` on the press event before doing its own work, or pressing *Show details* would also cast a vote. On react-native-web the press event exposes `stopPropagation()`.

- [ ] **Step 1: Write the failing tests**

Append to `tests/component/ItemCard.test.tsx`:

```tsx
describe('choosing by pressing the card', () => {
  it('chooses when the card body is pressed', async () => {
    const { onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /choose arrival/i }));

    expect(onChoose).toHaveBeenCalled();
  });

  it('no longer shows a separate Choose button', () => {
    setup();

    expect(screen.queryByText('Choose')).toBeNull();
  });

  it('no longer shows a Much better strip', () => {
    setup();

    expect(screen.queryByText(/much better/i)).toBeNull();
  });

  it('sends the strong outcome from the flame', async () => {
    const { onChooseStrong, onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /arrival is much better/i }));

    expect(onChooseStrong).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not choose when the details toggle is pressed', async () => {
    const { onChoose, user } = setup();

    await user.click(screen.getByRole('button', { name: /show details for arrival/i }));

    expect(onChoose).not.toHaveBeenCalled();
  });

  it('does not choose when delete is pressed', async () => {
    const { onChoose, onRequestDelete, user } = setup();

    await user.click(screen.getByRole('button', { name: /delete arrival/i }));

    expect(onRequestDelete).toHaveBeenCalled();
    expect(onChoose).not.toHaveBeenCalled();
  });

  it('is not pressable while a delete is being confirmed', async () => {
    const { onChoose, user } = setup({ pendingDelete: true });

    await user.click(screen.getByText(/remove "arrival" from the list/i));

    expect(onChoose).not.toHaveBeenCalled();
  });

  it('shows the keyboard shortcut on the card it belongs to', () => {
    setup();

    expect(screen.getByText('←')).toBeDefined();
  });

  it('says how to choose', () => {
    setup();

    expect(screen.getByText(/click to choose/i)).toBeDefined();
  });

  it('is inert without a choose handler', () => {
    setup({ onChoose: undefined });

    expect(screen.queryByRole('button', { name: /choose arrival/i })).toBeNull();
  });
});
```

If the existing file has no `setup` helper returning `user`, add one modelled on
`tests/component/SortFieldPicker.test.tsx`: build props with `vi.fn()` for every
callback, render, and return `{ ...props, user: userEvent.setup() }`. The item
under test is `{ title: 'Arrival', year: 2016 }` with `sortField="title"`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/component/ItemCard.test.tsx`
Expected: FAIL - no `Choose Arrival` role button on the card root; the flame does not exist.

- [ ] **Step 3: Build the flame**

Create `components/comparison/StrongChoiceButton.tsx`:

```tsx
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, space } from '@/lib/theme';

export interface StrongChoiceButtonProps {
  /** The item's label, for the accessible name. */
  label: string;
  onPress: () => void;
}

/**
 * "Much better", as a single tap target on the card it applies to. The emoji
 * carries the warmth so the interface keeps exactly one saturated accent.
 */
export function StrongChoiceButton({ label, onPress }: StrongChoiceButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label} is much better`}
      onPress={(event) => {
        event.stopPropagation();
        onPress();
      }}
      style={({ hovered }) => [styles.button, hovered === true && styles.buttonHovered]}
    >
      <Text style={styles.glyph}>🔥</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill ?? 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  buttonHovered: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  glyph: { fontSize: 18, lineHeight: 22, paddingTop: space.none ?? 0 },
});
```

If `radius.pill` or `space.none` do not exist, read `lib/theme.ts` and use `999`
and `0` directly rather than inventing tokens.

- [ ] **Step 4: Rebuild the card**

In `components/comparison/ItemCard.tsx`:

1. Make the root pressable. Replace the `Animated.View` opening tag with an
   `Animated.View` wrapping a `Pressable`, so the fade animation and the press
   target stay separate concerns:

```tsx
  const canChoose = interactive && !pendingDelete;

  return (
    <Animated.View style={[styles.card, { opacity }]} dataSet={{ surface: 'card' }}>
      <Pressable
        accessibilityRole={canChoose ? 'button' : undefined}
        accessibilityLabel={canChoose ? `Choose ${label}` : `${side === 'left' ? 'Left' : 'Right'} option: ${label}`}
        disabled={!canChoose}
        onPress={canChoose ? onChoose : undefined}
        style={({ hovered, pressed }) => [
          styles.pressArea,
          canChoose && hovered === true && styles.pressAreaHovered,
          canChoose && pressed && styles.pressAreaPressed,
        ]}
      >
```

   and close it with `</Pressable>` before `</Animated.View>`. Move `styles.card`'s
   `padding`, `gap`, `borderWidth`, `borderColor`, and `backgroundColor` onto
   `pressArea` so the hover styles apply to the visible surface; keep the sizing
   (`flexGrow`, `flexShrink`, `flexBasis`, `minWidth`) and `borderRadius` on `card`,
   and add `overflow: 'hidden'` there.

2. Stop propagation on the delete control and the details toggle:

```tsx
            onPress={(event) => {
              event.stopPropagation();
              onRequestDelete?.();
            }}
```

```tsx
            onPress={(event) => {
              event.stopPropagation();
              setExpanded((open) => !open);
            }}
```

   Apply the same to the two buttons inside the delete confirmation
   (`Keep` and `Remove`).

3. Replace the whole `{interactive && (<View style={styles.footer}> … </View>)}`
   block with the new footer:

```tsx
      {interactive && (
        <View style={styles.footer}>
          {pendingDelete ? (
            <View style={styles.confirm}>
              <Text style={styles.confirmText}>{`Remove "${label}" from the list?`}</Text>
              <View style={styles.confirmActions}>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Keep ${label}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onCancelDelete?.();
                  }}
                  style={styles.confirmCancel}
                >
                  <Text style={styles.confirmCancelText}>Keep</Text>
                </Pressable>
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Confirm deleting ${label}`}
                  onPress={(event) => {
                    event.stopPropagation();
                    onConfirmDelete?.();
                  }}
                  style={styles.confirmDelete}
                >
                  <Text style={styles.confirmDeleteText}>Remove</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <View style={styles.hintGroup}>
                <View style={styles.keycap}>
                  <Text style={styles.keycapText}>{side === 'left' ? '←' : '→'}</Text>
                </View>
                <Text style={[styles.hint, reducedMotion && styles.hintStatic]}>
                  Click to choose
                </Text>
              </View>

              {onChooseStrong !== undefined && (
                <StrongChoiceButton label={label} onPress={onChooseStrong} />
              )}
            </View>
          )}
        </View>
      )}
```

4. Delete the now-unused `choose`, `chooseText`, `chooseArrow`, `strong`, and
   `strongText` styles, and add:

```ts
  pressArea: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    transitionDuration: `${motion.hoverMs}ms`,
  },
  pressAreaHovered: {
    borderColor: colors.accentSoftBorder,
    transform: [{ translateY: -2 }],
  },
  pressAreaPressed: {
    transform: [{ scale: 0.98 }],
    backgroundColor: colors.accentSoft,
  },
  actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  hintGroup: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  keycap: {
    minWidth: 22,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
  },
  keycapText: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint, opacity: 0 },
  hintStatic: { opacity: 1 },
```

   The hint's hover reveal is a CSS concern; add a rule to `lib/themeCss.ts`
   alongside the existing surface rules so it fades in with the card:

```css
[data-surface="card"]:hover [data-hint="choose"] { opacity: 1; }
```

   and tag the hint `dataSet={{ hint: 'choose' }}`. Under reduced motion the
   `hintStatic` style already keeps it visible.

If `motion.hoverMs` does not exist, read `lib/theme.ts` and use the nearest
existing token.

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/component/ItemCard.test.tsx`
Expected: PASS.

If `event.stopPropagation` is not a function on the press event, use
`event.preventDefault?.()` plus a guard: set a ref flag in the nested handler and
check it at the top of the card's `onPress`. Prefer `stopPropagation`; fall back
only if react-native-web does not provide it.

- [ ] **Step 6: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. `tests/component/accessibility.test.tsx` and
`tests/component/ComparisonDeck.test.tsx` may assert on the old buttons; update
those assertions to the new card-press behaviour rather than restoring buttons.

- [ ] **Step 7: Commit**

```bash
git add components/comparison lib/themeCss.ts tests/component
git commit -m "feat: choose an item by pressing its card"
```

---

### Task 6: Stage polish

**Files:**
- Modify: `components/comparison/ComparisonDeck.tsx`
- Test: `tests/component/ComparisonDeck.test.tsx`

**Interfaces:**
- `ComparisonDeckProps` loses `needsSortField`, which became unreachable when
  ranking stopped starting without a label field.

- [ ] **Step 1: Write the failing test**

Append to `tests/component/ComparisonDeck.test.tsx`:

```tsx
describe('the gutter', () => {
  it('separates the two cards with an "or"', () => {
    setup();

    expect(screen.getByText('or')).toBeDefined();
  });

  it('keeps the skip action for the pair', () => {
    setup();

    expect(screen.getByRole('button', { name: /skip this pair/i })).toBeDefined();
  });

  it('no longer repeats the shortcut hints below the cards', () => {
    setup();

    expect(screen.queryByText(/shift \+ arrow/i)).toBeNull();
  });
});
```

Match the existing file's `setup` helper; if it does not have one, follow the
pattern in `tests/component/RankRail.test.tsx`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/component/ComparisonDeck.test.tsx`
Expected: FAIL - there is no `or` in the gutter.

- [ ] **Step 3: Implement**

In `components/comparison/ComparisonDeck.tsx`:

1. Delete the `needsSortField` prop from `ComparisonDeckProps`, its default in
   the destructure, the `enabled: pair !== null && !needsSortField` condition
   (which becomes `enabled: pair !== null`), and the `if (needsSortField)`
   early return with its `Notice`.

2. Put a divider between the two cards, inside `styles.cards`:

```tsx
        <View style={styles.gutter} aria-hidden>
          <View style={styles.gutterLine} />
          <Text style={styles.gutterText}>or</Text>
          <View style={styles.gutterLine} />
        </View>
```

   placed between the two `<ItemCard />` elements.

3. Replace the keyboard hint line beneath the cards - the cards now carry their
   own keycaps - with the shortcut that has nowhere else to live:

```tsx
      <Text style={styles.hint}>Hold shift while choosing for “much better”. S skips.</Text>
```

4. Add the styles:

```ts
  gutter: { alignItems: 'center', justifyContent: 'center', gap: space.xs, paddingHorizontal: space.xs },
  gutterLine: { flex: 1, width: 1, backgroundColor: colors.border, minHeight: space.lg },
  gutterText: { fontFamily: fonts.body, fontSize: 11, color: colors.textFaint },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/component/ComparisonDeck.test.tsx`
Expected: PASS.

- [ ] **Step 5: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/comparison tests/component
git commit -m "feat: polish the comparison stage gutter and hints"
```

---

### Task 7: End-to-end coverage and docs

**Files:**
- Modify: `tests/e2e/core-flow.spec.ts`, `ARCHITECTURE.md`, `UX.md`

- [ ] **Step 1: Add the end-to-end journeys**

Append to `tests/e2e/core-flow.spec.ts`:

```ts
test('chooses by clicking a card', async ({ page }) => {
  await page.getByLabel('Your list').fill('Tacos\nRamen\nCurry\nPho');
  await page.getByRole('button', { name: 'Start ranking' }).click();

  const before = await page.getByText(/comparisons ·/).textContent();
  await page.getByRole('button', { name: /^Choose / }).first().click();

  await expect(page.getByText(/comparisons ·/)).not.toHaveText(before ?? '');
});

test('reordering by hand restarts the ranking', async ({ page }) => {
  await page.getByLabel('Your list').fill('Tacos\nRamen\nCurry\nPho');
  await page.getByRole('button', { name: 'Start ranking' }).click();
  await page.getByRole('button', { name: /^Choose / }).first().click();

  // Keyboard reordering is the same commit path as a drop, and is stable to drive.
  await page.getByLabel(/^Reorder /).first().focus();
  await page.keyboard.press('Alt+ArrowDown');

  await expect(page.getByText(/starts a new ranking session/)).toBeVisible();
  await page.getByRole('button', { name: 'Reorder and restart' }).click();

  await expect(page.getByText(/0 comparisons/)).toBeVisible();
});
```

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: PASS, 7 tests.

- [ ] **Step 3: Update ARCHITECTURE.md**

In section 6, after "6.4 Deterministic ranking rebuild", add:

```md
### 6.5 Manual ordering

Dragging a row does not override the derived ranking. It rewrites the source
document's array into the dragged order and re-imports it through
`startRanking`, so the ranking stays a pure derivation of comparison history
and there is never a second source of truth for order.

Because that clears the comparison history, it is confirmed whenever there are
rated comparisons to lose. With none, it applies silently, which is what makes
arranging several rows in a row bearable.
```

In section 10.1, replace the list of things the preview reacts to with the same
list plus `manual reordering`.

- [ ] **Step 4: Update UX.md**

In "### 3. Comparison stage", replace the description of the card footer
(`Choose`, `Much better`) with:

```md
Each card is itself the choice: pressing anywhere on it picks that item. The
card carries, top to bottom:
- a side marker (LEFT / RIGHT) and a quiet remove control in the corner
- the item label, from the label field for object entries
- summary chips for short scalar fields
- an expandable details region for the rest of the object
- a footer holding the keycap for its arrow key, a `Click to choose` hint that
  fades in on hover, and a circular 🔥 for "much better"

Nested controls stop the press from reaching the card, and the card stops being
pressable while a delete confirmation is showing.
```

In "### 4. Persistent preview pane", add to the Contains list:
`- a grip on each row for dragging it into place, with Alt+Arrow as the keyboard equivalent`

and after that section's closing paragraph add:

```md
Arranging the list by hand starts a new ranking session from that order. When
there are comparisons to lose, the pane asks first.
```

- [ ] **Step 5: Commit**

```bash
git add tests/e2e ARCHITECTURE.md UX.md
git commit -m "test: cover card choosing and manual reordering, and update the docs"
```

---

## Done

The ranked list can be arranged by hand, motion shows what moved, and the
comparison stage is two cards you simply press.
