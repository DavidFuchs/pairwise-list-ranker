# Later answers count more: design

_2026-10-27. Status: proposed, waiting for the owner's approval._

## Why

On the six-item summer trips list the owner answered Lisbon against Amalfi
Coast six times: Lisbon in answer 9, Amalfi Coast in answers 13 and 15, then
Lisbon in answers 43, 45 and 47. The engine counts every answer the same
however old it is, so it read this as 4 to 2 and put a 34% chance on the pair
being the wrong way round. The explainer showed "could go either way".

The owner's view: they changed what they cared about partway through, their
last three answers all went one way, and those should decide it. Preferences
shift while people rank, as they work out what matters to them, and a model
that weighs answer 9 the same as answer 47 cannot follow that.

Of the three ways discussed (fade every old answer over time, favour later
answers only within a pair asked more than once, or a "use my latest answers"
button), the owner chose the second.

## The rule

When the same two items have been compared more than once, an answer counts
for less for each later answer between them that went **the other way**.

- Each clear answer (plain or "much better") is multiplied by
  `RECENCY_FACTOR ^ k`, where `k` is the number of later counted clear
  answers between the same two items that picked the other item. "Later"
  means a higher event index, the order the answers were given.
- Its outcome weight is applied as now (1, or 1.75 for "much better"); the
  factor multiplies it.
- Answers that agree with each other never discount each other. Three answers
  the same way still count as three full answers.

The owner's case with a factor of 0.5 (the value is to be calibrated, see
Calibration):

| Answer | Picked       | Later answers the other way | Weight |
| -----: | ------------ | --------------------------: | -----: |
|      9 | Lisbon       |                  2 (13, 15) |   0.25 |
|     13 | Amalfi Coast |              3 (43, 45, 47) |  0.125 |
|     15 | Amalfi Coast |              3 (43, 45, 47) |  0.125 |
|     43 | Lisbon       |                           0 |      1 |
|     45 | Lisbon       |                           0 |      1 |
|     47 | Lisbon       |                           0 |      1 |

Lisbon 3.25 against Amalfi Coast 0.25, in place of 4 against 2.

A single late answer the other way does not overturn a settled pair: after
three Lisbon answers, one Amalfi Coast answer counts 1 and leaves the three
Lisbon answers at 0.5 each (1.5 in all). It takes two answers the other way
to tip it. That is the protection against a misclick or a tired answer.

**Why only answers the other way (my call).** A plain "older answers count
less" rule would also weaken a pair answered the same way three times, so
being consistent would make the engine less sure. Discounting only by later
disagreement targets exactly a change of mind and leaves everything else as it
is. If the calibration shows the plain rule does better, say so in the
calibration doc and bring it back to the owner before switching.

**Draws (my call).** A "Can't decide" answer neither discounts other answers
nor is discounted. It already counts for little (0.25 each way), and "can't
decide" after a clear answer is not clearly a change of mind.

## Goals

- In the owner's trips session, Lisbon stays above Amalfi Coast and the
  chance of them being the wrong way round falls well below 34% and out of the
  "could go either way" band (under 20%).
- A user whose preferences shift partway through gets an order that follows
  their later answers in fewer answers than today, measured in a new
  simulation scenario (see Drift scenarios).
- Users whose preferences do not shift are not slowed down beyond the
  calibration rule's 10% limit.
- The explainer stays truthful: when the engine counts some of a pair's
  answers for less, the "You've picked both ways" card says so.

## Non-goals

- No fading of answers over time across the whole list. Answers about a pair
  asked once keep full weight forever.
- No "use my latest answers" button. A later step, if the owner wants it.
- No picker change. The repeat penalty (`REPEAT_FACTOR`, `MAX_SHOWINGS`) stays
  as it is. If the drift runs show the picker rarely goes back to a pair whose
  answers disagree, write that down as a finding; changing the picker is a
  separate decision.
- No change to the explainer copy discussed alongside this ("Nothing is left in
  real doubt" beside "could go either way", and "Another answer between these
  two decides it"). That is a separate change.

## Anti-goals (a failure even if it works)

- **Consistency punished.** Answering a pair the same way again must never make
  the engine less sure of it.
- **One stray answer flips a settled pair.** See the 1-against-3 example above.
- **A hidden rule.** If the order or the explainer disagrees with a plain count
  of the answers, the window must say why.
- **Results that depend on how they were reached.** The fit stays a
  deterministic function of the history: warm path, cold replay, undo and
  checkpoint restore give the same strengths (docs/ARCHITECTURE.md 6.1, 6.5).

## Constraints

- Copy rules for this project: no em-dashes; never "land" or "lands" as a
  verb.
- No migration or compatibility for saved sessions or snapshots: the app is
  not in production. Bump the snapshot version so a cached fit from before the
  change is ignored (lib/ranking/bt/snapshot.ts already ignores other
  versions).
- The warm path stays inside its time budget on a 1,000-item list
  (`npm run bench:engine`).

## How it works in the engine

The discount is applied where counted answers are chosen, not where they are
recorded.

- `Evidence.add` keeps storing each term with its outcome weight, as now.
- `Evidence.activeTerms` (lib/ranking/bt/evidence.ts) first filters by
  eligibility, as now, then applies the discount to what is left, returning new
  term objects with the discounted weight. Only counted answers count as
  "later answers the other way": an answer a move set aside neither counts nor
  discounts anything.
- One pass over the active terms grouped by unordered pair, walking each
  group from the latest answer back, counting clear answers each way seen so
  far. Linear in the number of terms.
- Draws are two terms with the same event index (one each way); they are
  recognised as draws and passed through unchanged.
- Everything downstream reads the discounted weights without change: the
  objective (lib/ranking/bt/objective.ts), the flip chances
  (lib/ranking/bt/flips.ts), the progress levels, the explainer's counted
  answers (`fit.pairs`).
- `RECENCY_FACTOR` goes in lib/ranking/bt/constants.ts with the other evidence
  weights, with a comment pointing to its calibration section. A value of 1
  turns the rule off.

## The explainer

`AnswerRef` (lib/state/progressExplain.ts) gets `discounted: boolean`, true when
the engine counts that answer for less than its outcome weight. On a "You've
picked both ways" card:

- Discounted answers are shown in the faint text colour, with no extra words
  on each line.
- Below the answers, when any are discounted, one line: "Your later answers
  count for more, so the earlier ones the other way count for less."

The chance phrase on the card already comes from the discounted fit, so it
moves on its own.

## Drift scenarios

A new simulated user whose true values change partway through a run.

- A `World` gets an optional drift: at answer `D`, a share of the items get new
  values. Pick 20% of the items at random (seeded) and shuffle their values
  among themselves, so the set of values stays the same and the change is a
  reordering among those items.
- From answer `D` on, the behaviour answers by the new values, and every
  measure reads the new truth (`truthOver`, `trueRank`).
- Scenarios, tagged `cal-recency`:
  - `typical-unordered-drift-n100`: drift at `D = 3n`, budget `3n + 8n`.
  - Short lists, where repeated pairs are common and the owner's case lives:
    `typical-unordered-drift-n6` and `typical-unordered-drift-n12`, drift at
    `D = 4n`, budget `4n + 8n`. On a 6-item list 20% is one item, so use at
    least two items there.
- Measure: answers after `D` until the gate is met against the new truth. The
  short lists use whatever measure the "Short lists" section of
  docs/engine-calibration.md already uses for them.

Scenario names are stable once recorded (tests/sim/scenarios.ts).

## Calibration

- Add `RECENCY_FACTOR` to the overridable constants (tests/sim/overrides.ts)
  and to `scripts/sim-sweep.mjs`.
- Sweep `RECENCY_FACTOR` over 1 (off, the current behaviour), 0.8, 0.6, 0.5,
  0.3 and 0, on `cal-recency` and `cal-pairs`, with the usual seeds and
  `--size full`.
- Deciding rule (tests/sim/compare.ts), with 1 as the current value: the
  `cal-recency` scenarios are the deciding set; `cal-pairs` are guards. A value
  that is more than 10% slower on any guard is rejected; the chosen value must
  beat 1 by at least 2% on the drift scenarios.
- If no value passes, the rule ships off (factor 1), the result is written up,
  and the owner decides whether to look again at the plain rule or the button.
- Re-check the progress levels and the flip-chance calibration (sections
  "Progress levels" and "Flip chances" of docs/engine-calibration.md) at the
  chosen value: discounting changes how much evidence a contradicted pair has.
- Record the sweep in docs/engine-calibration.md under a new section,
  "Later answers", in the same shape as "Draw weight": the values, the table,
  the decision and what the rule cannot say.

## Tests

- Unit tests for the discount in `Evidence.activeTerms`: answers all one way
  (no discount), the owner's 4 to 2 sequence (the weights in the table above,
  at a factor of 0.5), one late answer against three, draws untouched, a
  "much better" answer discounted from 1.75, and an answer a move set aside
  neither counting nor discounting.
- The owner's session as a fixture (the summer trips sample with these 47
  answers): Lisbon above Amalfi Coast, and the pair's flip chance below the
  "could go either way" band (20%).
- Warm, cold, undo and checkpoint replays agree on a history with repeated
  disagreeing pairs (extend the existing agreement tests).
- Component test: a both-ways card with discounted answers shows the extra
  line; one without does not.
- Benchmarks: `npm run bench:engine` within budget.

## Docs

- docs/ARCHITECTURE.md 6.1: the evidence table and a short paragraph on the
  rule, its reason and the draw exception.
- docs/ARCHITECTURE.md 11: the drift scenarios.
- docs/engine-calibration.md: the "Later answers" section.
- docs/UX.md, where the explainer is described: the line on the both-ways
  card.

## Left to the builder

- The exact discounted-answer styling, from the theme (lib/theme).
- The drift measure for the short lists, if the existing short-list measure
  does not fit a run that changes truth partway.
- Whether drift is a field on the scenario or a world option, as long as the
  scenario names above hold.
- Tuning the 20% drift share or the drift point if the runs show the scenario
  is too easy or too hard to tell values apart; say so in the calibration doc.
