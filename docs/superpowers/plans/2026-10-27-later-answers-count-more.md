# Later answers count more: implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When the same two items have been compared more than once, an answer counts for less for each later answer between them that went the other way, with the factor set by a simulation of users whose preferences shift.

**Architecture:** A pure function discounts the engine's counted answers inside `Evidence.activeTerms`, after eligibility, so the fit, the flip chances, the gauge and the explainer all read the discounted weights with no change of their own. The factor is `RECENCY_FACTOR` in the engine constants, shipped at 1 (off) until Task 5 sets the calibrated value. The simulation gains a world whose values change partway through, scenarios that use it, and a comparison grouping in which those scenarios decide.

**Tech Stack:** TypeScript, React Native (Expo), Vitest (unit, component and `vitest.sim.config.mts` runs).

**Spec:** docs/superpowers/specs/2026-10-27-later-answers-count-more-design.md

## Global Constraints

- Copy: no em-dashes anywhere (copy, docs, comments); never "land" or "lands" as a verb.
- No migration or compatibility code for saved sessions or snapshots; bump `ENGINE_SNAPSHOT_VERSION` instead.
- The fit stays a deterministic function of the history: warm path, cold replay, undo and checkpoint restore agree.
- A factor of 1 turns the rule off and must reproduce today's weights exactly.
- Draws neither discount nor are discounted.
- `npm run bench:engine` stays within its budgets.
- Fix any lint issue met along the way, even one that was already there (`npm run lint`, `npm run typecheck`, `npm run format:check`).

## Review Focus

- Undo of the answer that discounted older ones: the older answers go back to full weight (Task 2 agreement test).
- A move between disagreeing answers: answers before the move neither count nor discount anything (Task 1 test).
- The same pair shown with the sides swapped (Lisbon left one time, right the next): grouped as one pair (Task 1 test).
- A draw between two disagreeing clear answers: the draw is untouched and does not change `k` (Task 1 test).
- An item marked "don't recognize" after disagreeing answers: its answers are excluded and so discount nothing; a removed item keeps its answers and they still discount (Task 1 tests).

---

### Task 1: The discount rule in the engine

**Files:**

- Modify: `lib/ranking/bt/constants.ts` (add `RECENCY_FACTOR` beside the evidence weights)
- Modify: `lib/ranking/bt/evidence.ts` (`PairTerm`, new `discountEarlier`, `activeTerms`)
- Modify: `lib/ranking/bt/snapshot.ts:9` (`ENGINE_SNAPSHOT_VERSION` 4 to 5)
- Test: `tests/unit/ranking/bt/evidence.test.ts`

**Interfaces:**

- Produces:
  - `export const RECENCY_FACTOR = 1;` with a comment: `// Each clear answer counts RECENCY_FACTOR^k, k = later counted clear answers on the same pair the other way. 1 is off. Calibrated in docs/engine-calibration.md "Later answers".`
  - `PairTerm` gains `discounted?: true`, set only on a term whose weight the rule lowered.
  - `export function discountEarlier(terms: readonly PairTerm[], factor: number): PairTerm[]` in `evidence.ts`: returns a new array in the same order; terms it lowers are new objects with `weight * factor ** k` and `discounted: true`; every other term is passed through as the same object.
  - `Evidence.activeTerms(timeline)` returns `{ pairs: discountEarlier(eligibleTerms, RECENCY_FACTOR) }`.

- [ ] **Step 1: Write the failing tests** in `evidence.test.ts`, a new `describe('discountEarlier')`, building terms with `record([...])` and calling `discountEarlier(evidence.activeTerms(timeline).pairs, 0.5)` (activeTerms itself is still at factor 1). Weights read in event order. The owner's case uses `a` for Lisbon and `b` for Amalfi Coast.

```ts
it('answers all one way are not discounted', () => {
  // a over b three times, sides swapped on the second
  expect(weights([pair('a', 'b', 'left'), pair('b', 'a', 'right'), pair('a', 'b', 'left')])).toEqual([
    1, 1, 1,
  ]);
});
it("the owner's six answers: Lisbon, Amalfi, Amalfi, then Lisbon three times", () => {
  expect(weights(owner)).toEqual([0.25, 0.125, 0.125, 1, 1, 1]);
  expect(discounted(owner)).toEqual([true, true, true, false, false, false]);
});
it('one late answer against three halves the three', () => {
  expect(weights([...threeA, pair('a', 'b', 'right')])).toEqual([0.5, 0.5, 0.5, 1]);
});
it('a "much better" answer is discounted from 1.75', () => {
  expect(weights([pair('a', 'b', 'left_strong'), pair('a', 'b', 'right')])).toEqual([0.875, 1]);
});
it('a draw between disagreeing answers is untouched and changes nothing', () => {
  // weights per term: the draw is two 0.25 terms
  expect(weights([pair('a', 'b', 'left'), pair('a', 'b', 'draw'), pair('a', 'b', 'right')])).toEqual([
    0.5, 0.25, 0.25, 1,
  ]);
});
it('other pairs are untouched', () => {
  expect(weights([pair('a', 'b', 'left'), pair('a', 'c', 'right'), pair('a', 'b', 'right')])).toEqual([
    0.5, 1, 1,
  ]);
});
it('a factor of 1 returns the same term objects', () => {
  const terms = evidence.activeTerms(timeline).pairs;
  discountEarlier(terms, 1).forEach((t, i) => expect(t).toBe(terms[i]));
});
it('answers a move set aside neither count nor discount', () => {
  // a over b, a placed, then b over a: the first answer is not active, the last is full weight
  expect(weights([pair('a', 'b', 'left'), placement('a'), pair('a', 'b', 'right')])).toEqual([1]);
});
it('a "don\'t recognize" mark excludes the answers, so they discount nothing', () => {
  expect(
    weights([pair('a', 'b', 'left'), pair('a', 'b', 'right'), unrecognized(['a']), pair('b', 'c', 'left')]),
  ).toEqual([1]);
});
it('a removed item keeps its answers and they still discount', () => {
  expect(weights([pair('a', 'b', 'left'), pair('a', 'b', 'right'), removal(['a'])])).toEqual([0.5, 1]);
});
```

`weights(events)` and `discounted(events)` are small helpers in the test file over `record` and `discountEarlier(..., 0.5)`. Add a `placement(itemId)` event helper beside `pair`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/ranking/bt/evidence.test.ts`
Expected: FAIL, `discountEarlier` is not exported.

- [ ] **Step 3: Implement `discountEarlier` and wire it into `activeTerms`**

One pass: group term indices by unordered slot pair; walk each group from the highest `eventIndex` down, keeping counts of clear answers seen so far for each winner; a draw is two terms sharing an `eventIndex`, recognised as such and skipped (neither counted nor discounted). A clear term's `k` is the count seen so far for the other item. With `factor === 1` return the input terms unchanged. Add `RECENCY_FACTOR = 1` to constants, and bump `ENGINE_SNAPSHOT_VERSION` to 5 with its comment saying the counted weights changed.

- [ ] **Step 4: Run the tests to see them pass, then the whole suite**

Run: `npx vitest run tests/unit/ranking/bt/evidence.test.ts` then `npm test`
Expected: all PASS. At factor 1 nothing outside these tests changes; if a snapshot test pins the version number, update it to 5.

- [ ] **Step 5: Commit**

```bash
git add lib/ranking/bt/constants.ts lib/ranking/bt/evidence.ts lib/ranking/bt/snapshot.ts tests/unit/ranking/bt/evidence.test.ts
git commit -m "feat: count earlier answers for less when later ones on the same pair disagree"
```

### Task 2: The rule through the whole engine

**Files:**

- Create: `tests/unit/ranking/bt/laterAnswers.test.ts`
- Create: `tests/unit/ranking/bt/fixtures/trips-summer-47.json` (the owner's session: the `originalItemIds`, the summer trips labels by id, and the 47 `events`, copied from the list `trips\u0000summer` of the owner's upload `C:\Users\david\.claude\uploads\3083fecf-7f74-4010-9688-2a2f348952e3\19a28247-pairwise-session-2026-10-271.json`; not the `pairwise-session-2026-10-27.json` in the repo root, which is an older 24-answer session)
- Modify: `tests/unit/ranking/bt/agreement.test.ts`

**Interfaces:**

- Consumes: `RECENCY_FACTOR` (Task 1), mocked to 0.5 in these test files with `vi.mock('@/lib/ranking/bt/constants', async (original) => ({ ...(await original()), RECENCY_FACTOR: 0.5 }))`, the way `tests/sim/setup.ts` overrides constants. `replay` from `lib/ranking/bt/engine.ts`, `pairChances` from `lib/ranking/bt/progress.ts`, `EngineSession` for the warm path.

- [ ] **Step 1: Write the failing tests**

In `laterAnswers.test.ts`, from the fixture:

```ts
it("the owner's trips session: Lisbon stays above Amalfi Coast, out of the 'could go either way' band", () => {
  const state = replay({ originalItemIds, startingOrder: 'unordered', events });
  expect(state.ranked.indexOf(LISBON)).toBeLessThan(state.ranked.indexOf(AMALFI));
  expect(chanceOf(state, LISBON, AMALFI)).toBeLessThan(0.2);
});
```

`chanceOf` finds the pair in `pairChances(state)` either way round.

In `agreement.test.ts`, with the same mock, a new `it('warm path, cold replay and undo agree when later answers discount earlier ones')`: a 6-item history with the owner's Lisbon/Amalfi pattern plus answers on other pairs; feed it to an `EngineSession` one event at a time, compare strengths with `replay` of the whole history (same tolerance the file already uses); then undo the last three events on the session and compare with `replay` of the first `length - 3` events, which checks the older answers went back to full weight.

- [ ] **Step 2: Run them**

Run: `npx vitest run tests/unit/ranking/bt/laterAnswers.test.ts tests/unit/ranking/bt/agreement.test.ts`
Expected: PASS on Task 1's code (these tests check the wiring, not new code). A failure means the discount is not reaching the fit: check that `buildProblem` and `FitEvidence.pairs` take their terms from `activeTerms`, and fix it there.

- [ ] **Step 3: Benchmark**

Run: `npm run bench:engine`
Expected: within the budgets the bench reports; the discount is one linear pass per fit.

- [ ] **Step 4: Commit**

```bash
git add tests/unit/ranking/bt/laterAnswers.test.ts tests/unit/ranking/bt/fixtures/trips-summer-47.json tests/unit/ranking/bt/agreement.test.ts
git commit -m "test: later answers count more, on the owner's trips session and through undo"
```

### Task 3: The explainer says when earlier answers count less

**Files:**

- Modify: `lib/state/progressExplain.ts` (`AnswerRef`, `countedAnswers`)
- Modify: `components/comparison/ProgressExplainerModal.tsx` (`SpotCard`'s both-ways case, `Answers`)
- Test: `tests/unit/state/progressExplain.test.ts`, `tests/component/ProgressExplainerModal.test.tsx`
- Modify: `docs/UX.md` (the explainer section: the new line)

**Interfaces:**

- Consumes: `PairTerm.discounted` (Task 1).
- Produces: `AnswerRef` gains `discounted: boolean` (true when the term behind it has `discounted: true`; a draw is never discounted).

- [ ] **Step 1: Write the failing tests**

`progressExplain.test.ts`, with the constants mock at 0.5: a both-ways history (a over b, b over a, b over a) gives a spot whose `answers` have `discounted` `[true, false, false]`.

`ProgressExplainerModal.test.tsx`:

```ts
it('a both-ways card with discounted answers says the later ones count more', () => {
  // spot.answers with one discounted: true
  expect(
    screen.getByText('Your later answers count for more, so the earlier ones the other way count for less.'),
  ).toBeDefined();
});
it('a both-ways card with no discounted answers has no such line', () => {
  expect(screen.queryByText(/later answers count for more/)).toBeNull();
});
```

Every other `AnswerRef` built in these test files gains `discounted: false`.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/state/progressExplain.test.ts tests/component/ProgressExplainerModal.test.tsx`
Expected: FAIL (no `discounted`, no line).

- [ ] **Step 3: Implement**

`countedAnswers` sets `discounted` from the term. In `SpotCard`'s `both-ways` case, `Answers` takes `faint: boolean[]` (or the refs) and draws discounted lines in `colors.textFaint`; when any is discounted, the body ends with a `Text` in `styles.body` holding exactly: `Your later answers count for more, so the earlier ones the other way count for less.` Add one sentence on it to the explainer section of `docs/UX.md`.

- [ ] **Step 4: Run the tests to see them pass**

Run: `npx vitest run tests/unit/state/progressExplain.test.ts tests/component/ProgressExplainerModal.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/state/progressExplain.ts components/comparison/ProgressExplainerModal.tsx tests/unit/state/progressExplain.test.ts tests/component/ProgressExplainerModal.test.tsx docs/UX.md
git commit -m "feat: the explainer shows when earlier answers count for less"
```

### Task 4: Drift scenarios in the simulation

**Files:**

- Modify: `tests/sim/truth.ts` (`World.drift`)
- Modify: `tests/sim/driver.ts` (`ScenarioExtras.drift`, the drift point, the gate after it)
- Modify: `tests/sim/scenarios.ts` (`driftSet`, added to both sizes)
- Modify: `tests/sim/compare.ts` (grouping `recency`)
- Modify: `tests/sim/overrides.ts`, `scripts/sim-sweep.mjs` (`RECENCY_FACTOR`)
- Test: `tests/unit/sim/truth.test.ts`, `driver.test.ts`, `scenarios.test.ts`, `compare.test.ts`, `overrides.test.ts`, `sweep.test.ts`
- Modify: `docs/ARCHITECTURE.md` section 11 (the drift scenarios)

**Interfaces:**

- Produces:
  - `World.drift(share: number, minItems: number, random: () => number): string[]`: picks `max(minItems, round(share * n))` ids at random, shuffles them, and gives each the value of the next one in the shuffled order (the last takes the first's), so every picked item changes value and the set of values stays the same; clears the strict-rank cache; returns the picked ids. `value`, `trueRank` and `truthOver` read the new values from then on.
  - `ScenarioExtras.drift?: { at: number; share: number; minItems: number }`.
  - For a scenario with `drift`, `Trace.answersToGate` is the answers given after `at` until the gate is met against the new truth (null if never). The gate is `within5 >= 0.9` from 26 items up and `kendall === 1` under 26 items, sampled after every answer from `at` on.
  - Scenarios (tag `cal-recency`): `typical-unordered-drift-n100` (`at: 300`, budget `300 + 800`), `typical-unordered-drift-n6` (`at: 24`, budget `24 + 48`), `typical-unordered-drift-n12` (`at: 48`, budget `48 + 96`); all `share: 0.2, minItems: 2`. In both `ci` and `full`.
  - `parseGroups('recency')`: a scenario whose name matches `/-drift-n\d+$/` is its own group; every other is a guard.
  - `RECENCY_FACTOR` in `BT_CONSTANTS`, and in the sweep's `CONSTANTS` as `{ atLeast: 0, atMost: 1 }`.

- [ ] **Step 1: Write the failing tests**

- `truth.test.ts`: after `drift(0.2, 2, random)` on a 10-item world, exactly 2 ids returned, each with a different `value` than before, the sorted list of values unchanged, and `trueRank` agrees with the new values. Same seed, same picked ids.
- `driver.test.ts`: on `typical-unordered-drift-n6` at seed 1, with `observe`, record `step.world.value(id)` for every id at the step after answer 24 and at the step before it; at least two ids differ, and the sorted values are equal. `answersToGate` is null or at most 48.
- `scenarios.test.ts`: the three names exist in `full` and `ci`, tagged `cal-recency`.
- `compare.test.ts`: `parseGroups('recency')('typical-unordered-drift-n6')` is `'typical-unordered-drift-n6'`; for `'typical-unordered-pairs-n100'` it is null.
- `overrides.test.ts` / `sweep.test.ts`: `RECENCY_FACTOR` accepted; the existing check that the sweep's list equals `OVERRIDABLE` covers the second.

- [ ] **Step 2: Run them to see them fail**

Run: `npx vitest run tests/unit/sim`
Expected: FAIL on the new tests only.

- [ ] **Step 3: Implement** as in Interfaces. The driver calls `world.drift` from `actBetween` when `answers === drift.at`, with its own seeded stream (a new salt beside `DRIVER_SALT`), then resets `reached`, starts a fresh gate-sample list, and computes `answersToGate` from that list minus `at`. Scenario names are stable once recorded; do not rename. Add the drift scenarios to `docs/ARCHITECTURE.md` section 11 in its existing style.

- [ ] **Step 4: Run the tests, then a quick sim smoke run**

Run: `npx vitest run tests/unit/sim` then, in bash, `SIM_LABEL=drift-smoke SIM_FILTER=cal-recency SIM_SEEDS=1 SIM_SIZE=ci npm run sim`
Expected: PASS; the smoke run writes `docs/engine-calibration-runs/drift-smoke.partial.json` with three scenarios. Delete that file; it is not a result to keep.

- [ ] **Step 5: Commit**

```bash
git add tests/sim tests/unit/sim scripts/sim-sweep.mjs docs/ARCHITECTURE.md
git commit -m "test: simulated users whose preferences shift partway through"
```

### Task 5: Calibrate the factor and write it up

**Files:**

- Modify: `lib/ranking/bt/constants.ts` (`RECENCY_FACTOR` to the chosen value)
- Create: `docs/engine-calibration-runs/RECENCY_FACTOR-<value>.json` per value, and the compare file
- Modify: `docs/engine-calibration.md` (new section "Later answers", after "Draw weight")
- Modify: `docs/ARCHITECTURE.md` 6.1 (evidence table row and a short paragraph: the rule, why only answers the other way, the draw exception), and the constants table near line 617
- Modify: `tests/unit/ranking/bt/fixtures/survivors-golden.json` only if the golden test fails at the new value

- [ ] **Step 1: Sweep** (bash, from the repo root; check with `--dry-run` first)

```sh
node scripts/sim-sweep.mjs --constant RECENCY_FACTOR --values 1,0.8,0.6,0.5,0.3,0 --filter "cal-recency|cal-pairs" --seeds 6
```

Expected: six result files.

- [ ] **Step 2: Compare**

```sh
SIM_CURRENT=RECENCY_FACTOR-1 SIM_CANDIDATES=RECENCY_FACTOR-0.8,RECENCY_FACTOR-0.6,RECENCY_FACTOR-0.5,RECENCY_FACTOR-0.3,RECENCY_FACTOR-0 SIM_SCENARIOS="cal-recency|cal-pairs" SIM_GROUPS=recency npm run sim:compare
```

Expected: a compare file with a verdict per candidate. Pick the passing candidate with the best mean; if none passes, the value stays 1.

- [ ] **Step 3: Set the value and re-check the levels**

Set `RECENCY_FACTOR`. If it is not 1: run `npm test`; if `survivorsGolden` fails, regenerate with `UPDATE_GOLDEN=1 npx vitest run tests/unit/ranking/bt/survivorsGolden.test.ts` and say why in the commit. Run `tests/unit/sim/progressGate.test.ts` and the short-list check of "Checking the levels" (`tests/sim/signals.sim.ts`) and compare with the tables in "Short lists"; write down any shift. If the value is 1, say in the doc that the rule ships off; the tests mock 0.5, so they stand either way.

- [ ] **Step 4: Write it up**

"Later answers" in `docs/engine-calibration.md`, shaped like "Draw weight": the sweep command, the table of answers to the gate after drift per drift scenario and the guards' changes, the decision, what the rule cannot say, and the owner's trips session's Lisbon/Amalfi Coast chance at the chosen value. Update `docs/ARCHITECTURE.md` 6.1 and the constants table. If the plain "older answers count less" rule looks like it would have done better, say so and flag it for the owner (spec, "Why only answers the other way").

- [ ] **Step 5: Full check and commit**

Run: `npm run lint && npm run typecheck && npm run format:check && npm test`
Expected: all pass.

```bash
git add lib/ranking/bt/constants.ts docs tests/unit/ranking/bt/fixtures
git commit -m "feat: calibrate how much later answers outweigh earlier ones"
```
