# Tech Debt

A technical assessment of the codebase, with the work it suggests tracked as
tasks. The goals are code that is easier to read, easier to change, and faster
on large lists and large documents.

The foundations are sound: the ranking engine in `lib/ranking/` is pure and
deterministic, the store is a factory so tests build their own, and coverage is
broad. What follows is mostly about scale (work repeated on every click) and
about how many places one change has to touch.

## Status

| # | Task | Area | Effort | Status |
|---|------|------|--------|--------|
| 1 | Memoize the list switcher's options on the rank screen | Performance | S | Done |
| 2 | Replay comparisons incrementally; cheaper placements | Performance | M | Done |
| 3 | Replace the single-slot selector cache with a keyed one | Performance | S | Done |
| 4 | Stop persisting each entry two or three times | Performance | M | Open |
| 5 | Cache `Intl` formatters | Performance | S | Done |
| 6 | Cut needless re-renders (rows, cards, field picker) | Performance | S-M | Open |
| 7 | One registry entry per field renderer | Modifiability | M | Done |
| 8 | One model for every list, active or parked | Modifiability | L | Open |
| 9 | One collision-free path key | Correctness | S | Done |
| 10 | Remove duplicated helpers and flows | Readability | S | Done |
| 11 | Move derived state out of the screens | Readability | M | Open |
| 12 | Pass the card layout as one prop | Modifiability | S | Done |
| 13 | Small cleanups: stale comments, unused store getters | Readability | S | Done |
| 14 | Add a formatter so quote style stops drifting | Readability | S | Open |
| 15 | Give "no list chosen" its own key in the draft hook | Correctness | S | Open |
| 16 | Fix the two end-to-end tests that already fail on `main` | Tests | S | Done |

Suggested order: the small items first, then 7 and 12 (both done), then 2, and finally 8
together with 4, since both change the snapshot format and can share one
version bump and migration.

## Performance

### 1. Memoize the list switcher's options

`app/rank.tsx` built the switcher's options during render, so every comparison
walked the whole document (`findArrayCandidates`), ran `resolveRoles` over every
entry of every list not set up by hand, and computed progress for each parked
list. Only the active list's progress depends on a click.

Fix: `selectListOptions` in `lib/state/selectors.ts`, memoized on the workspace
and saved lists, with the active list's progress added per render.

### 2. Incremental replay, cheaper placements

`replayComparisons` sorts and replays the full history on every change. Each
placement inside the replay calls `rankItems`, which rebuilds the head-to-head
map and re-sorts every item, so cost grows as
placements × (items log items + events).

Fix:
- When the new events array is the previous one plus appended events, start from
  the cached states. Undo and edits fall back to a full replay.
- Within one replay, keep a running order and head-to-head map rather than
  rebuilding both per placement.

The elo and rebuild tests already pin the behaviour this must keep.

Done:
- `replayComparisons` keeps the last replay per items array. When the history
  is the cached one with events added to its end, dated no earlier than the
  last one applied, it carries on from there; anything else replays from the
  start. Callers get their own copy of the ratings.
- A replay keeps its head-to-head tally as it goes, so a placement no longer
  rebuilds it from the whole history.
- `incrementalReplay.test.ts` checks the result against a fresh replay after
  every event of a seeded history with every outcome, shared timestamps, a
  removed item and an unknown one, and after undo, out-of-order and
  already-ranked changes.

Measured on 500 items, 3,000 comparisons and 150 placements: a click went from
about 50 ms to about 5 ms, and a full replay from about 60 ms to about 33 ms.

### 3. Keyed selector cache

`selectWorkspaceView` remembered one result in a module global. Any call with
other arguments (seeding the data screen from parked lists, a second store, the
tests) evicted the active list's result.

Fix: a `WeakMap` keyed on the events array, then the items array.

### 4. Persist each entry once

A snapshot holds `rawText`, the parsed `document`, and every item's `value`,
which copies the same entries again; parked lists add their own copies. All of
it goes through `JSON.stringify` on each save, and the browser's quota is
reached ("too-large") far sooner than the data warrants.

Fix: drop `rawText` from storage and rebuild it on load. Storing item values as
references into the document is the larger half and belongs with task 8.

### 5. Cache `Intl` formatters

`formatValue` and `moneyText` built a new `Intl.NumberFormat` or
`DateTimeFormat` per call: once per field, per row, per render.

Fix: module-level caches, the same way `regionNames` already worked.

### 6. Fewer re-renders

`RankedRow` and `ItemCard` are not memoized and get fresh closures every render.
`FieldPicker` recomputes the schema and every field's renderer options on each
render. Expo 57 supports `experiments.reactCompiler`, which would cover most of
this; otherwise `memo` plus callbacks that take an id.

## Modifiability and readability

### 7. Renderer registry

Adding a renderer means editing `FIELD_RENDERERS`, `SPECIAL_RENDERERS`, the
`formatValue` switch, the `rendererCaveat` switch, `rendererNote`, `slotOf`,
`picturesOf` or `previewSourceOf`, and the branches in `FieldValue.tsx`.

Fix: `lib/renderers/` is now three files:
- `values.ts` reads values (links, dates, places, flags, colours, ratings,
  money) and knows nothing of renderers.
- `registry.ts` holds one entry per renderer: label, hint, slot, `accepts`,
  `format`, and optional `note`, `caveat`, `pictures` and `preview`. Ratings
  and currency are families whose variants are ids of their own. The entries
  are a `Record` over every non-family id, so a renderer without one does not
  compile, and `rendererRegistry.test.ts` checks each id has exactly one home.
- `index.ts` keeps the public API every `@/lib/renderers` import already used.

`FieldValue.tsx` draws from a map of views, one per renderer that draws more
than text, in place of its if-chain. A new renderer is now its id in
`FIELD_RENDERERS`, an entry in the registry, and a view only if it needs one.

### 8. One model for every list

`Workspace` and `SavedList` are nearly the same shape, which is why `switchList`
archives and restores, and why `buildDraftSeed`, the coverage map,
`selectListConfig` and the switcher options each special-case the active list.

Fix: `lists: Record<pathKey, ListState>` plus `activePath`. Needs a new snapshot
version and a migration.

### 9. One path key

Lists were keyed by `path.join('.')` in about 30 places, so `["a.b"]` and
`["a", "b"]` shared a key: a document with dotted keys could mix up two lists.

Fix: `pathKey` and `samePath` in `lib/import/paths.ts`, joining on a character
no key contains in practice. A single-segment path keys exactly as before.

### 10. Duplicated helpers and flows

- `isPlainObject` was defined in five files; now `lib/import/shape.ts`.
- Reading a field off an item was written out in the card and the ranked list;
  now `fieldOf` in `types/list.ts`.
- Opening a session file, and asking first when decisions are at stake, was
  written out on both screens with identical wording; now `hasDecisions` and
  `confirmOpenSession` in `lib/session/sessionFile.ts`.
- The meter reading for a list was built by hand in both the data screen and
  the switcher; now `selectCoverage`.

### 11. Derived state out of the screens

`app/index.tsx` holds `buildDraftSeed`, the coverage map, the config lines, and
a `settingsAreDefault` check built on `JSON.stringify`, which likely overlaps
with `diffSettings`. Moving these into `lib/state` leaves the screens as layout
and makes the logic unit-testable.

### 12. The card layout as one prop

`sortField`, `summaryFields`, `renderers`, `pictureFields` and `mediaFields`
travel together through `ComparisonDeck`, `ItemCard`, `PreviewPane` and
`RankedListPreview`.

Fix: `cardLayout(roles)` builds one `CardLayout` (the title field plus
`layoutSummary`'s result), and those components take it as a single `layout`
prop, defaulting to `EMPTY_LAYOUT`. The component tests now build layouts with
`cardLayout` too, so they describe a card the way a user sets one up.

### 13. Small cleanups

- The drag handler in `RankedListPreview.tsx` had three comment blocks that
  contradicted each other, and a doc comment naming state that no longer exists.
  Rewritten as one accurate comment.
- The store's `ranking()` and `currentPair()` getters were first flagged as
  unused. They turned out to be used across several test suites as a
  convenience, so they stay.

### 14. A formatter

Quote style is mixed: the selectors and both screens use double quotes, the rest
single. Adding Prettier (and running it once) settles it.

### 15. "No list chosen" has its own key

`useSourceDraft` keys per-list choices by `pathKey(selectedPath)`, and uses `''`
when nothing is selected. A document that is itself the array has the path
`[]`, which also keys as `''`, so a choice made with nothing selected could be
read back for the root list. Rare, since a root array is the only candidate and
is selected at once, but a distinct key (or skipping the lookup when nothing is
selected) removes the question.

### 16. Two end-to-end tests already failed

On `main` as of 206e356, two Playwright tests in `tests/e2e/core-flow.spec.ts`
failed because the app had moved on and the tests had not:

- "details open on both cards from one toggle" expected `year` on the cards
  without ticking it. Cards now show only their title until a field is chosen,
  so the test ticks "Show year on cards" first.
- "reordering by hand adds to the comparisons instead of discarding them"
  expected `3 comparisons` after a move. A move now records one placement
  rather than two comparisons (see `reorderItem`), so it expects 2.

All 19 now pass.
