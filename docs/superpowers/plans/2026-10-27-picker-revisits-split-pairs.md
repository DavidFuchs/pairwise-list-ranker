# The picker comes back to pairs answered both ways: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A pair whose answers are still going back and forth stays askable past `MAX_SHOWINGS` until two answers in a row agree, with a calibrated backstop, and the explainer's "won't ask again" wording follows the same rule.

**Architecture:** One small module, `lib/ranking/bt/splitPairs.ts`, says which pairs are open (from the fit's counted terms) and whether a pair rests (from its times asked and whether it is open). The picker and the explainer both call it. The engine works the open set out from `problem.pairs` each time it describes a state, so warm, cold, undo and checkpoint paths agree without new stored state.

**Tech Stack:** TypeScript, Vitest (unit, component, sim configs), Node scripts for the sweep.

**Spec:** docs/superpowers/specs/2026-10-27-picker-revisits-split-pairs-design.md

## Global Constraints

- Copy rules for this project: no em-dashes; never "land" or "lands" as a verb.
- No migration or compatibility for saved sessions or snapshots. Bump the snapshot version if a cached next pair could differ.
- The warm path stays inside its time budget on a 1,000-item list (`npm run bench:engine`).
- `SPLIT_SETTLED_RUN` is fixed at 2 by the owner and not swept.
- Fix any lint issue found, even pre-existing ones (`npx eslint`, `npx prettier --check`, `npx tsc --noEmit`).

## Review Focus

1. **Draws inside a run.** A, B, A, "Can't decide", A must rest: the draw neither extends nor breaks the run. Pinned in Task 1.
2. **Answers a move set aside.** They are not in `problem.pairs`, so a split that came only from a set-aside answer is not split. Pinned in Task 3 (explainer) and implied by Task 2 reading `problem.pairs`.
3. **Undo across the run boundary.** Undoing the answer that made a run of 2 must reopen the pair and the next pair must match a cold replay. Pinned in Task 2's agreement test.
4. **A pair that keeps alternating.** Must rest at `MAX_SHOWINGS_SPLIT`, then come back only once every other pair has reached its own limit. Pinned in Task 2.
5. **"Much better" answers.** They count as clear answers in the run like plain ones (weight does not matter, direction does). Pinned in Task 1.

---

### Task 1: The shared rule

**Files:**

- Create: `lib/ranking/bt/splitPairs.ts`
- Modify: `lib/ranking/bt/constants.ts` (next to `MAX_SHOWINGS`, line 52)
- Test: `tests/unit/ranking/bt/splitPairs.test.ts`

**Interfaces:**

- Consumes: `PairTerm` from `lib/ranking/bt/evidence.ts`; `pairKey` from `lib/ranking/bt/picker.ts`.
- Produces:
  - `export const SPLIT_SETTLED_RUN = 2;` and `export const MAX_SHOWINGS_SPLIT = 5;` in constants.ts. The comment on `MAX_SHOWINGS_SPLIT` says it is provisional until docs/engine-calibration.md "Split pairs", and that a value of `MAX_SHOWINGS` turns the rule off.
  - `export function openPairs(pairs: readonly PairTerm[]): Set<number>`: the `pairKey`s of pairs with at least one clear term each way whose latest run (clear terms since the last one the other way) is shorter than `SPLIT_SETTLED_RUN`. Terms are in event order. A draw is two adjacent terms with one `eventIndex` and is skipped, as `discountEarlier` does.
  - `export function rests(times: number, open: boolean): boolean`: `times >= MAX_SHOWINGS_SPLIT || (times >= MAX_SHOWINGS && !open)`.

- [ ] **Step 1: Write the failing tests**

A helper `terms(...answers: Array<[winner: number, loser: number] | 'draw'>)` builds `PairTerm`s with rising `eventIndex` (a draw as two terms 0↔1 with one index). Tests, all on slots 0 and 1 (key `pairKey(0, 1)`):

```ts
it('a pair answered one way is not open', () =>
  expect(openPairs(terms([0, 1], [0, 1], [0, 1])).size).toBe(0));
it('A, B, A is open', () => expect(openPairs(terms([0, 1], [1, 0], [0, 1])).has(pairKey(0, 1))).toBe(true));
it('B, A, A is not open: a run of two', () => expect(openPairs(terms([1, 0], [0, 1], [0, 1])).size).toBe(0));
it('A, B, A, B is open', () =>
  expect(openPairs(terms([0, 1], [1, 0], [0, 1], [1, 0])).has(pairKey(0, 1))).toBe(true));
it('a draw neither extends nor breaks a run', () => {
  expect(openPairs(terms([0, 1], [1, 0], [0, 1], 'draw', [0, 1])).size).toBe(0);
  expect(openPairs(terms([0, 1], [1, 0], 'draw', [0, 1])).has(pairKey(0, 1))).toBe(true);
});
it('a much better answer counts in the run like a plain one', () => {
  const t = terms([1, 0], [0, 1], [0, 1]);
  (t[2] as { weight: number }).weight = 1.75;
  expect(openPairs(t).size).toBe(0);
});
it('a discounted term still counts', () => {
  /* B, A with discounted: true on the B term: open */
});
it('pairs are kept apart', () => {
  /* (0,1) A,B,A and (2,3) A,A,A: only pairKey(0,1) */
});

describe('rests', () => {
  it('below MAX_SHOWINGS nothing rests', () => expect(rests(2, false)).toBe(false));
  it('at MAX_SHOWINGS a closed pair rests and an open one does not', () => {
    expect(rests(3, false)).toBe(true);
    expect(rests(3, true)).toBe(false);
  });
  it('at MAX_SHOWINGS_SPLIT everything rests', () => expect(rests(MAX_SHOWINGS_SPLIT, true)).toBe(true));
});
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/ranking/bt/splitPairs.test.ts`
Expected: FAIL, cannot resolve `@/lib/ranking/bt/splitPairs`.

- [ ] **Step 3: Add the constants and implement `openPairs` and `rests` in `lib/ranking/bt/splitPairs.ts`**

One pass over the terms with a `Map<number, { last: number; run: number; split: boolean }>` keyed by `pairKey`, where `last` is the latest winner slot. A file comment points to docs/ARCHITECTURE.md 6.7.

- [ ] **Step 4: Run them to see them pass**

Run: `npx vitest run tests/unit/ranking/bt/splitPairs.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/bt/splitPairs.ts lib/ranking/bt/constants.ts tests/unit/ranking/bt/splitPairs.test.ts
git commit -m "feat: a pair still going back and forth is open until two answers in a row agree"
```

---

### Task 2: The picker and the engine use it

**Files:**

- Modify: `lib/ranking/bt/picker.ts` (`PickerInput`, `repeatDiscount` at line 60)
- Modify: `lib/ranking/bt/engine.ts` (`describeState`, the picker input at line 633)
- Modify: `lib/ranking/bt/snapshot.ts:9` (`ENGINE_SNAPSHOT_VERSION` 5 → 6)
- Modify: `docs/ARCHITECTURE.md` 6.7 (the split-pair rule and why, a short paragraph)
- Test: `tests/unit/ranking/bt/picker.test.ts`, `tests/unit/ranking/bt/agreement.test.ts`, new `tests/unit/ranking/bt/splitPairsEngine.test.ts`

**Interfaces:**

- Consumes: `openPairs`, `rests` (Task 1).
- Produces: `PickerInput.open?: ReadonlySet<number>` (pairKeys of open pairs; absent means none open).

- [ ] **Step 1: Write the failing picker tests** in `picker.test.ts`, beside "a pair shown three times is asked again only when nothing else can be" (same strengths `[0, 0, 6]`):

```ts
it('an open pair shown three times is still asked', () => {
  const open = new Set([pairKey(0, 1)]);
  expect(pickPair(input(3, { strengths, shown: new Map([[pairKey(0, 1), 3]]), open }))).toEqual([0, 1]);
});
it('an open pair rests at MAX_SHOWINGS_SPLIT', () => {
  const open = new Set([pairKey(0, 1)]);
  expect(
    pickPair(input(3, { strengths, shown: new Map([[pairKey(0, 1), MAX_SHOWINGS_SPLIT]]), open })),
  ).toEqual([0, 2]);
});
it('a resting pair comes back once every other pair is at its own limit', () => {
  const shown = new Map([
    [pairKey(0, 1), MAX_SHOWINGS_SPLIT],
    [pairKey(0, 2), 3],
    [pairKey(1, 2), 3],
  ]);
  expect(pickPair(input(3, { strengths, shown, open: new Set([pairKey(0, 1)]) }))).toEqual([0, 1]);
});
```

The existing cap test stays as it is (no `open`, so it checks a closed pair still rests at 3).

- [ ] **Step 2: Write the failing engine test** in `splitPairsEngine.test.ts`: the owner-shaped session.

Items `['banff', 'cape-breton', 'dubrovnik', 'reykjavik', 'lisbon', 'amalfi']`, truth in that order except Reykjavík above Dubrovnik. History: every pair once by the truth, with Reykjavík–Dubrovnik answered Reykjavík, then Dubrovnik, then Reykjavík among them (three answers, the last Reykjavík). Then up to 40 more answers, each to `replay(list).nextPair` by the truth. Assertions:

```ts
// Reykjavík and Dubrovnik come back before every other pair has been asked three times.
expect(askedAgainAt).not.toBeNull();
expect(othersAllAtThreeBy === null || askedAgainAt! < othersAllAtThreeBy).toBe(true);
// Its fourth answer (Reykjavík) makes a run of two, so it is not asked a fifth time
// until every other pair has been asked three times.
```

Second test, the alternating backstop: two items answered strictly alternately whenever asked are asked exactly `MAX_SHOWINGS_SPLIT` times before every other pair has reached three.

- [ ] **Step 3: Extend the agreement test** in `agreement.test.ts`, inside the "later answers" describe: a history on the same six ids where one pair goes A, B, A (open), then A (run of two). Append all, compare `visible(session.state)` with `replay`; undo once and compare with a cold replay of the shorter history; the shorter history's `nextPair` must also match. The block's `vi.mock` stays.

- [ ] **Step 4: Run them to see the new ones fail**

Run: `npx vitest run tests/unit/ranking/bt/picker.test.ts tests/unit/ranking/bt/splitPairsEngine.test.ts tests/unit/ranking/bt/agreement.test.ts`
Expected: the three new picker tests and both engine tests FAIL; the agreement test may pass already (it checks agreement, not the rule).

- [ ] **Step 5: Implement**

- `PickerInput` gains `open?: ReadonlySet<number>` with a doc comment.
- `repeatDiscount`: `rests(times, input.open?.has(key) ?? false) ? REPEAT_FACTOR ** times * SCORE_GRID : REPEAT_FACTOR ** times`. Update its doc comment. `MAX_SHOWINGS` is no longer imported by picker.ts.
- `describeState`: `open: openPairs(problem.pairs)` in the picker input.
- `ENGINE_SNAPSHOT_VERSION = 6`.
- ARCHITECTURE.md 6.7: the rule, the owner's two-in-a-row choice, the backstop, and that resting is not for good.

- [ ] **Step 6: Run the engine tests and the bench**

Run: `npx vitest run tests/unit/ranking/bt` then `npm run bench:engine`
Expected: all PASS; the bench within its budget. If the bench is over, keep the open set in the engine state and update it per answer instead, and say so in the commit.

- [ ] **Step 7: Commit**

```bash
git add lib/ranking/bt/picker.ts lib/ranking/bt/engine.ts lib/ranking/bt/snapshot.ts docs/ARCHITECTURE.md tests/unit/ranking/bt
git commit -m "feat: the picker comes back to a pair answered both ways until two answers agree"
```

---

### Task 3: The explainer reads the same rule

**Files:**

- Modify: `lib/state/progressExplain.ts` (`restingPair`, `timesAsked`)
- Modify: `docs/UX.md` (the resting sentence in the "Why?" window paragraph: "once a pair has been asked as often as the picker allows (MAX_SHOWINGS)" becomes the open/two-in-a-row rule in one sentence)
- Test: `tests/unit/state/progressExplainLater.test.ts`

**Interfaces:**

- Consumes: `openPairs`, `rests` (Task 1); `pairKey` (picker.ts); `evidence.fit.pairs` and `evidence.slots` (already on `ShownEvidence`).
- Produces: `restingPair` keeps its role; its inputs become times asked and the open set. `Spot.resting` and `ChangedPair.resting` are unchanged.

- [ ] **Step 1: Write the failing tests**, replacing "marks a pair asked MAX_SHOWINGS times resting, and one asked fewer not":

```ts
it('a pair answered A, B, A is not resting: Pairwise will ask it again', () => {
  /* asked(3) + others: spot.resting false */
});
it('after two answers in a row agree it rests', () => {
  /* b,a,a,b... ending in a run of 2 with times >= 3: resting true, next false */
});
it('a split that came from an answer a move set aside does not count', () => {
  // A, B, A on (a, b); then a placement event moving b (sets aside b's earlier answers); then A, A.
  // Counted answers on the pair are A, A only: not split, asked 5 times, so resting.
});
it('an open pair rests at MAX_SHOWINGS_SPLIT', () => {
  /* strictly alternating MAX_SHOWINGS_SPLIT times: resting true */
});
```

Each asserts `spot.next === false` before asserting `resting`, so the next-question exemption cannot hide a failure.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/state/progressExplainLater.test.ts`
Expected: the A, B, A test FAILS (today it is resting at three).

- [ ] **Step 3: Implement**

Build the open set once in `explainProgress` from `openPairs(evidence.fit.pairs)`. `restingPair(asked, key, next, open)` maps the two ids to slots through `evidence.slots` to test membership, and returns `key !== next && rests(asked.get(key) ?? 0, isOpen)`. Its doc comment points to splitPairs.ts instead of restating the cap.

- [ ] **Step 4: Run the explainer tests**

Run: `npx vitest run tests/unit/state tests/component/ProgressExplainerModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/state/progressExplain.ts docs/UX.md tests/unit/state/progressExplainLater.test.ts
git commit -m "feat: the explainer rests a pair by the picker's own rule"
```

---

### Task 4: The sweep can tune the backstop and report the second measure

**Files:**

- Modify: `tests/sim/overrides.ts` (`BT_CONSTANTS` gains `'MAX_SHOWINGS_SPLIT'`)
- Modify: `scripts/sim-sweep.mjs` (`CONSTANTS` gains `MAX_SHOWINGS_SPLIT: { atLeast: 3 }`)
- Modify: `tests/sim/driver.ts` (`Trace` gains `topSpotResting?: boolean | null`)
- Modify: `tests/sim/compare.ts` (reports the share)
- Test: `tests/unit/sim/overrides.test.ts`, `tests/unit/sim/sweep.test.ts`, the compare unit tests beside them

**Interfaces:**

- Consumes: `rests`, `openPairs` (Task 1); `levelOf`, `disorderOfState`, `pairChances` (lib/ranking/bt/progress.ts); `TOP_LEVEL_DOUBT` (lib/state/progressExplain.ts).
- Produces:
  - `Trace.topSpotResting`: at the first answer where `levelOf(disorderOfState(state), shown count)` is 3, whether the pair with the largest `pairChances` chance, if over `TOP_LEVEL_DOUBT`, rests by `rests(times asked, open)` and is not `state.nextPair`. `null` when the run never reaches level 3 or no pair is over `TOP_LEVEL_DOUBT` then. Absent in result files recorded before it.
  - `export function restingShare(traces: readonly Trace[]): number | null` in compare.ts: the share of traces with `topSpotResting === true` among those where it is a boolean; null when none are.
  - The compare report prints the share per scenario next to the gate for both sides. It does not enter the decision.

- [ ] **Step 1: Write the failing tests**

```ts
// overrides.test.ts
describe('MAX_SHOWINGS_SPLIT', () => {
  it('can be overridden', () => {
    expect(OVERRIDABLE).toContain('MAX_SHOWINGS_SPLIT');
    expect(parseOverrides('{"MAX_SHOWINGS_SPLIT":4}')).toEqual({ MAX_SHOWINGS_SPLIT: 4 });
  });
});
// compare tests
it('restingShare counts only traces that reached the top level', () => {
  expect(restingShare([t(true), t(false), t(null), t(undefined)])).toBe(0.5);
  expect(restingShare([t(null)])).toBeNull();
});
```

The existing sweep test that keeps `CONSTANTS` and `OVERRIDABLE` the same covers the script.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/sim`
Expected: the new tests FAIL; the sweep-list test FAILS until both lists are updated.

- [ ] **Step 3: Implement** the four changes above. The driver counts times asked per pair key from the answers it has given; it reads the open set from `openPairs(state.fit.pairs)` with slots from `state.slots`.

- [ ] **Step 4: Run the sim unit tests and one quick sim run**

Run: `npx vitest run tests/unit/sim` then `npm run sim`
Expected: PASS, and `npm run sim` exits 0.

- [ ] **Step 5: Commit**

```bash
git add tests/sim scripts/sim-sweep.mjs tests/unit/sim
git commit -m "test: the sweep can set MAX_SHOWINGS_SPLIT and reports how often the top spot rests"
```

---

### Task 5: Calibrate the backstop

**Files:**

- Modify: `lib/ranking/bt/constants.ts` (the chosen `MAX_SHOWINGS_SPLIT` and its comment)
- Modify: `docs/engine-calibration.md` (new "Split pairs" section after "Later answers", same shape)
- Create: `docs/engine-calibration-runs/MAX_SHOWINGS_SPLIT-<value>.json`, `-short40.json`, and the compare markdown files the sweep writes

- [ ] **Step 1: Sweep the full size**

Run the sweep, as the "Later answers" section did, for `MAX_SHOWINGS_SPLIT` at 3 (off, the reference), 4, 5, 6 and 8, 6 seeds, `--size full`, filter `cal-[rp][ea]`. Compare with `SIM_GROUPS=recency`, 3 as current.
Expected: one result file per value and a compare file.

- [ ] **Step 2: Rerun the two short drift scenarios with 40 seeds**

`typical-unordered-drift-n6` and `-n12`, same values. Compare against 3.

- [ ] **Step 3: Decide**

The short drift scenarios decide; `cal-pairs`, the `typical-ranked-*` scenarios and the 100-item drift scenario are guards; more than 10% slower on any guard rejects a value. Among the passing values prefer the one with the lowest resting share at the top level, then the smallest value. If no value passes, set `MAX_SHOWINGS_SPLIT` to `MAX_SHOWINGS` (off), write it up, and stop for the owner (the spec's fallback is their call).

- [ ] **Step 4: Write the "Split pairs" section**

The value and why, the owner's session that prompted it, the scenarios and files, a table per value (6 items, 12 items, mean, resting share, verdict), the guards, and what the rule cannot say (two items the user truly rates the same still end at "drag it into place"). Update the constant's comment to point at the section and drop "provisional".

- [ ] **Step 5: Full check**

Run: `npx tsc --noEmit`, `npx eslint .`, `npx prettier --check .`, `npx vitest run`, `npm run bench:engine`
Expected: all clean and passing.

- [ ] **Step 6: Commit**

```bash
git add lib/ranking/bt/constants.ts docs/engine-calibration.md docs/engine-calibration-runs
git commit -m "feat: calibrate MAX_SHOWINGS_SPLIT"
```
