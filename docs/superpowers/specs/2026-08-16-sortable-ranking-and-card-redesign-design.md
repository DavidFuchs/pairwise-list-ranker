# Sortable ranking and a redesigned comparison stage

Status: approved design, ready for implementation planning
Date: 2026-08-16

## 1. Problem

Two requests, one screen.

**The ranked list is inert.** It shows the derived order and nothing else. When
the ranking is nearly right but one item sits in the wrong place, there is no
way to say so except by comparing again and hoping. Positions also change with
no motion at all, so a reshuffle after a comparison is easy to miss.

**The comparison stage is doing too much with buttons.** Each card carries a
full-width gradient **Choose** and a **Much better** strip beneath it. Two
stacked buttons per card, four across the pair, is a lot of chrome for a screen
whose entire job is "pick one of these two". The card itself — the large,
obvious target — is not clickable.

## 2. Decisions

| Question | Decision |
| --- | --- |
| What does a manual drag mean against Elo? | It starts a new ranking session from the dragged order |
| When is that confirmed? | Only when there are comparisons to lose |
| Where does the ranked list live? | Right rail, unchanged |
| What chooses an item? | Clicking anywhere on its card |
| How is "much better" expressed? | A small circular 🔥 button, bottom-right of the card |

The drag decision is the load-bearing one. The ranking is a pure derivation
from comparison history — `rebuildRanking` replays every event and sorts by
rating, head-to-head, wins, then creation order. There is nowhere for "the user
put this here" to live, and adding a manual-override layer would give the list
two sources of truth.

Treating a drag as the start of a new session avoids that entirely: the dragged
order becomes the array order, exactly as a fresh import would be, and Elo
restarts from it. No pins, no overrides, no second source of truth.

Rejected: pinned positions (two sources of truth, and pinned rows need a
permanent visual language of their own); synthesised comparison events (the
item may not land where it was dropped, which reads as the app fighting the
user).

## 3. Sortable ranking

### 3.1 Drag mechanics

React Native Web has no drag primitive. `react-native-draggable-flatlist` would
require Reanimated and Gesture Handler — two large dependencies for a static
web app that has neither. Drag is implemented directly on pointer events:

- each row carries a grip handle (`⠿`), revealed on hover and focus
- `pointerdown` on the handle calls `setPointerCapture` and starts a drag
- rows report their geometry through `onLayout` into an offset table
- `pointermove` computes the target slot from the pointer against row midpoints
- `pointerup` commits; `pointercancel` or `Escape` abandons

Handle-only dragging, never whole-row, so touch scrolling still works.

Two pure functions hold the logic so it is testable without a DOM:

```ts
/** The list with one id moved, both indices clamped into range. */
moveItem(ids: string[], from: number, to: number): string[]

/** Which slot a pointer at `y` is currently over, given measured rows. */
dropIndexFor(offsets: RowOffset[], pointerY: number): number

interface RowOffset { y: number; height: number }
```

### 3.2 Keyboard equivalent

Dragging is unusable with a screen reader, and this app holds a WCAG AA bar.
Rows are focusable; `Alt+ArrowUp` and `Alt+ArrowDown` move the focused row one
slot and commit through the same path as a drop. The row's accessible name
carries its position, so the move is announced.

### 3.3 Confirming the restart

On commit, when `comparisonEvents` holds at least one rated comparison, an
inline confirmation replaces the list's footer:

```
Reordering by hand starts a new ranking session.
Your 47 comparisons are cleared, and this order
becomes the starting point.

              [ Cancel ]  [ Reorder and restart ]
```

With no comparisons there is nothing to discard, so the reorder applies
silently. That also means further rearranging after a restart is free, which is
what makes arranging several items in a row bearable.

Cancelling restores the previous order.

### 3.4 Committing

One new store action, `reorderAndRestart(itemIds: string[])`, built from
machinery that already exists:

1. resolve `itemIds` to their items, in the new order
2. `buildExportDocument(source, roles, entries)` writes them back at
   `arrayPath`, rewriting the position field when one is set
3. `buildExport(source, roles, entries, source.format)` regenerates `rawText`,
   so the Edit data screen shows the new order rather than the stale text
4. the result goes through `startRanking`, the fresh-import path

Items removed during comparison are not carried into the new session. They are
already excluded from export, so this matches "as if newly imported", but it
does make removal permanent at that moment.

### 3.5 Motion

FLIP, using the `Animated` API already in the project: record each row's `y`
before a change, compare after render, set `translateY` to the difference and
animate it to zero. One mechanism covers both cases — rows sliding when a
comparison reshuffles the list, and neighbours parting to make room during a
drag.

The dragged row lifts with a scale and a deeper shadow, and the row under the
pointer shows a slot marker. `useReducedMotion` short-circuits all of it:
positions change instantly and the drag still works.

## 4. The comparison stage

### 4.1 The card is the button

`ItemCard`'s root becomes a `Pressable` with `role="button"` and the accessible
name `Choose Arrival`. The full-width **Choose** button and the **Much better**
strip are both removed from the footer.

Nested controls — delete, *Show details*, the flame — call `stopPropagation` on
press so they never choose by accident. While a delete confirmation is showing,
the card is not pressable at all.

### 4.2 The flame

A 40px circular button pinned to the card's bottom-right corner, always visible
rather than revealed on hover, so it survives touch and stays discoverable. Its
accessible name is `Arrival is much better`; it emits the same
`left_strong` / `right_strong` outcomes as the old strip.

Its chrome stays neutral-to-soft-accent and lets the emoji carry the warmth.
UX.md permits exactly one saturated colour, and a second accent is not worth
spending it on.

### 4.3 Polish

The resting state stays calm; the card earns its polish on interaction.

- **Hover**: lifts 2px, border warms to the accent, and a quiet `Click to
  choose` hint fades in at the bottom-left
- **Press**: brief scale to 0.98 and an accent flash, then the pair cross-fades
  to the next — the existing swap animation
- **Keycaps**: a small `←` / `→` chip on each card, so the shortcut lives on the
  thing it acts on rather than in a hint line underneath
- **Gutter**: a thin divider with a small `or` between the two cards
- **Reduced motion**: the hint is simply always visible, and nothing moves

### 4.4 What does not change

The inline delete confirmation on the card being removed, the centred *Skip
this pair* pill, the status strip and progress meter, and every existing
keyboard shortcut.

## 5. Testing

**Unit**
- `moveItem`: forward, backward, no-op, first, last, out-of-range clamping
- `dropIndexFor`: above the first row, below the last, either side of a
  midpoint, variable row heights
- `reorderAndRestart`: order applied, comparisons cleared, `rawText` and
  `document` both reflect the new order, position field rewritten, removed
  items dropped

**Component**
- pressing a card chooses it; pressing delete, *Show details*, or the flame
  does not
- the flame emits the strong outcome
- a card mid-delete-confirmation is not pressable
- the grip is reachable by keyboard, and `Alt+Arrow` moves a row
- reduced motion renders the hint statically

**End-to-end**
- drag a row, confirm the restart, and see the new order with comparisons reset
- click a card to choose, and see the pair advance

## 6. File plan

**New**
- `lib/ranking/reorder.ts` — `moveItem`, `dropIndexFor`, `RowOffset`
- `lib/hooks/useFlipAnimation.ts` — measure, diff, animate to zero
- `components/preview/RankedRow.tsx` — one row, its grip, and its animation
- `components/comparison/StrongChoiceButton.tsx` — the flame

**Changed**
- `components/preview/RankedListPreview.tsx` — drag state, confirmation footer
- `components/comparison/ItemCard.tsx` — pressable root, flame, hover hint,
  keycap; the two footer buttons removed
- `components/comparison/ComparisonDeck.tsx` — gutter divider, hint line
- `lib/state/useListStore.ts` — `reorderAndRestart`
- `ARCHITECTURE.md` §6, `UX.md` comparison stage and preview sections

**Untouched**
- `lib/ranking/elo.ts`, `pairSelection.ts`, `rebuildRanking.ts` — the ranking
  model is unchanged, which is the point of the restart decision
- everything in `lib/import/` and `lib/export/`
