# Progress explainer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A "Why?" link on the progress line opens a window that explains the level from the user's own answers, with a picture of any circle.

**Architecture:** The engine host hands out the open list's fit on request. A pure function in `lib/state/progressExplain.ts` turns the progress state, the events and that fit into plain data (spots, settled items). A modal component words and draws it. Nothing is computed until the window opens.

**Tech Stack:** TypeScript, React Native Web, Vitest, Testing Library.

**Spec:** docs/superpowers/specs/2026-10-26-progress-explainer-design.md

## Global Constraints

- No em-dashes in copy, docs or comments. Never "land" or "lands" as a verb in copy.
- No new dependency (no react-native-svg).
- Nothing computed per answer: only while the window is open.
- The explainer reads the same chance the gauge reads: exact (FlipChances) under 26 items, Gaussian from 26 up.
- No numbers in copy beyond answer numbers and counts.
- Lint, typecheck and prettier clean, including anything pre-existing found on the way.

## Review Focus

- A list with removed items or unrecognized items: only shown, fitted items appear; no crash on an id without a slot. Test in Task 2.
- A pair answered "Can't decide" and also answered one way: it is "both ways" only if non-draw answers go both ways; otherwise undecided only if every direct answer is a draw. Test in Task 2.
- A moved item whose earlier answers were set aside: those answers are never cited. Test in Task 2.
- The window open while the view changes (undo from the keyboard): it re-reads the new state. Covered by computing from the current view in Task 4.
- A 1,000-item list: explaining stays under 200 ms. Test in Task 2 with 300 items, budget 200 ms.

---

### Task 1: Expose the open list's fit, and a pair callback on the disorder walk

**Files:**

- Modify: `lib/ranking/bt/progress.ts` (`expectedDisorder`, `disorderOfState`)
- Modify: `lib/engine/engineHost.ts` (`ShownState`, `EngineHost`)
- Test: `tests/unit/ranking/bt/progress.test.ts`, `tests/unit/engine/engineHost*.test.ts` (the existing host test file)

**Interfaces:**

- Produces: `expectedDisorder(strengths, uncertainties, cap?, chance?, onPair?: (i: number, j: number, chance: number) => void)`; `i`, `j` are indices into the arrays, lower first.
- Produces: `pairChances(state: {ranked; fit?; slots?}): {above: string; below: string; chance: number}[] | null` in `progress.ts`: every pair the walk visits, uncapped, with the gauge's chance for that size. `above` is shown above `below`.
- Produces: `EngineHost.shownEvidence(listId: string): ShownEvidence | null` with `ShownEvidence = Pick<EngineState, 'ranked' | 'nextPair' | 'fit' | 'slots' | 'priorSource'>`; null when the list is not open or its shown state has no fit. `ShownState` gains `priorSource`.

- [ ] Test: `pairChances` on a 3-item replay returns the 3 pairs with `above` matching `ranked` order, and its chances sum to `disorderOfState * n * n / 2`.
- [ ] Test: `shownEvidence` returns null for another list id, and the session's fit for the open one.
- [ ] Implement; run the two test files; commit `feat: hand out the open list's fit and each pair's chance`.

### Task 2: `explainProgress`

**Files:**

- Create: `lib/state/progressExplain.ts`
- Test: `tests/unit/state/progressExplain.test.ts`

**Interfaces:**

- Consumes: `pairChances`, `ShownEvidence` (Task 1), `ProgressState`, `ProgressLevel`.
- Produces:

```ts
export interface AnswerRef {
  winner: string;
  loser: string;
  answer: number;
  draw: boolean;
}
export type Spot =
  | { kind: 'circle'; items: string[]; answers: AnswerRef[]; chance: number; next: boolean }
  | {
      kind: 'both-ways' | 'undecided' | 'one-answer';
      above: string;
      below: string;
      answers: AnswerRef[];
      chance: number;
      next: boolean;
    }
  | { kind: 'inferred'; above: string; below: string; chain: AnswerRef[]; chance: number; next: boolean }
  | { kind: 'moved'; item: string; chance: number; next: boolean };
export interface ProgressExplanation {
  state: ProgressState;
  level: ProgressLevel | null;
  uncompared: string[];
  spots: Spot[];
  moreSpots: number;
  doubtful: number; // pairs at or over DOUBT, in no shown spot
  settled: { first: string[]; middle: string[]; last: string[] } | { count: number } | null;
}
export function explainProgress(input: {
  state: ProgressState;
  level: ProgressLevel | null;
  events: readonly RankingEvent[];
  shown: readonly string[];
  evidence: ShownEvidence | null;
}): ProgressExplanation;
```

Constants: `DOUBT = 0.05`, `TOP_LEVEL_DOUBT = 0.1`, `MAX_SPOTS = 3`, `MAX_CHAIN = 3`, `MAX_CIRCLE_PICTURE = 4` (exported for the component), settled names listed only when `shown.length < 26` and at most 6 settled.

Rules (spec, "Spots"), per doubtful pair A above B, in this order:

1. Direct non-draw answers both ways: `both-ways`.
2. Shortest path A to B and B to A over counted non-draw answers (winner to loser), each at most `MAX_CHAIN` steps, both found: `circle` with the items along the cycle, starting from the one shown highest. A pair whose two items are both in an existing circle spot joins it.
3. Every direct answer a draw: `undecided`.
4. A or B has prior source `placement` and fewer than 2 counted answers: `moved` (one spot per item).
5. No direct answer: `inferred`, `chain` the shortest A to B path or empty.
6. Exactly one direct answer: `one-answer`.
7. Anything else counts in `doubtful`.

Answer numbers: 1 + the number of `pair` events before `eventIndex`. A draw is two terms with one eventIndex. Spot chance is the sum of its pairs; order by it, descending. `next` is true when the next pair is one of the spot's pairs (a circle: both items in it). At level 3 keep at most one spot and only if its largest pair chance is over `TOP_LEVEL_DOUBT`. Comparing state: `uncompared` = shown ids never in a pair event, no spots. Settled: shown items in no pair at or over `DOUBT`, split into the run at the top, the run at the bottom and the rest.

- [ ] Test `trips list after 24 answers`: the 24 answers from the owner's session (fixture in the test, ids by city) give level 1 (via `levelOf`), one circle spot with items Reykjavík, Lisbon, Cape Breton Island in loop order, answers 1, 15 and 9, `next` true when the next pair is in it, and settled `{first: [Banff], middle: [], last: [Dubrovnik, Amalfi]}`.
- [ ] Tests, one each: both ways; undecided; moved (an answer before the move is not cited); inferred with a chain; one answer; comparing state lists the uncompared; level 3 shows no spot when nothing is over 10%; an unrecognized item never appears; 300 items explained under 200 ms with at most 3 spots.
- [ ] Implement; run; commit `feat: explain the progress level from the answers`.

### Task 3: `ProgressExplainerModal` and the link

**Files:**

- Create: `components/comparison/ProgressExplainerModal.tsx`
- Modify: `components/comparison/ProgressLine.tsx` (optional `onExplain`), `components/comparison/ComparisonDeck.tsx` (pass `onExplainProgress`)
- Test: `tests/component/ProgressExplainerModal.test.tsx`, `tests/component/ComparisonDeck.test.tsx`

**Interfaces:**

- Consumes: `ProgressExplanation`, `Spot`, `MAX_CIRCLE_PICTURE`, `ProgressDisplay`.
- Produces: `ProgressExplainerModal({visible, onClose, progress: ProgressDisplay, explanation: ProgressExplanation | null, labelOf: (id: string) => string})`; `ProgressLine({progress, onExplain?})`; `ComparisonDeck` prop `onExplainProgress?: () => void`.

Copy: verbatim from the spec's "State paragraphs", "Spots" headings and settle lines, and "Wording of a pair's chance". The link reads "Why?" with label "Why is the order at this stage?", role link. Title "How close is this order?". Circle picture: a column of chips with "over, answer N" between them and a bracket on the right back to the top with the last answer; text only past `MAX_CIRCLE_PICTURE` items.

- [ ] Tests: link absent without `onExplain`, present and calls it with; each state's paragraph; the trips circle renders three chips and "over, answer 1", "over, answer 15", "over, answer 9"; "The next question is about this." shown only for a `next` spot; settled line "Banff first, Dubrovnik and Amalfi Coast last".
- [ ] Implement; run; commit `feat: a window that explains the progress line`.

### Task 4: Wire it up, docs, full check

**Files:**

- Modify: `app/rank.tsx` (window state; `explainProgress` in a `useMemo` on the open flag, the view and the list; `engineHost.shownEvidence(list.id)`)
- Modify: `lib/hooks/useProgress.ts` (also return the state and level, for the explainer)
- Modify: `docs/ARCHITECTURE.md` 6.12, `docs/UX.md`
- Test: `tests/e2e/core-flow.spec.ts` (open "Why?", see the title, close)

- [ ] Implement; run `npm run lint`, `npm run typecheck`, `npx prettier --check .`, `npx vitest run`, the e2e spec; all pass.
- [ ] Commit `feat: open the progress explainer from the rank screen`.
