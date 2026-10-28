# The picker comes back to pairs answered both ways: design

_2026-10-27. Status: proposed, waiting for the owner's approval._

## Why

On the six-item summer trips list, after 31 answers, the progress line read
"Changes from here should be small." and the explainer's one remaining spot
was Reykjavík and Dubrovnik, marked "could go either way": Reykjavík in answer
6, Dubrovnik in answer 12, Reykjavík in answer 14. The card said "Another
answer between these two decides it." The owner had already given that answer
(14), it did not decide it, and Pairwise never asked about the pair again in
the answers that followed.

Two things were wrong, and the first is fixed:

1. **The copy promised what the engine cannot do.** A pair's chance of being
   the wrong way round comes from the two items' whole strengths, not only
   their answers to each other, so two close items stay in doubt however often
   they meet. The explainer now promises another question only about a pair the
   picker will still ask, and otherwise says to drag the item into place
   (docs/UX.md, the "Why?" window). This needed no engine change.
2. **The picker stops asking.** A pair asked `MAX_SHOWINGS` (3) times scores
   `REPEAT_FACTOR ^ times * SCORE_GRID`, so it is offered again only once
   every other pair has been asked three times too (lib/ranking/bt/picker.ts,
   `repeatDiscount`). On six items that is 45 answers. A pair answered both
   ways is exactly the one where a fourth answer tells the engine the most
   about what the user wants now, and since later answers count for more
   (`RECENCY_FACTOR`, docs/engine-calibration.md "Later answers"), it is also
   where a further answer has the most effect.

This spec is about the second.

## The rule

A pair whose answers are still going back and forth stays askable past
`MAX_SHOWINGS`, until two answers in a row agree.

- A pair is **split** when it has at least one counted clear answer each way.
- A split pair is **open** while its latest run is shorter than
  `SPLIT_SETTLED_RUN` (2, the owner's choice): the latest run is the number of
  counted clear answers since the last one that went the other way. B, A, A has
  a run of 2 and is not open; A, B, A, B has a run of 1 and is open.
- A pair **rests** (scores `REPEAT_FACTOR ^ times * SCORE_GRID`, as a pair past
  the cap does today) when it has been asked `MAX_SHOWINGS` times or more and
  is not open, or when it has been asked `MAX_SHOWINGS_SPLIT` times or more
  whatever its answers (to be calibrated, see Calibration).
- Below that a pair scores as now: its flip chance, times how much an answer
  could settle it, times `REPEAT_FACTOR ^ times`. The steep repeat discount
  stays, so an open pair comes back only when nothing else is worth asking
  more, which is the state the owner was in.
- Resting is not for good. A resting pair competes only with other resting
  pairs, so it comes back once every pair the picker can offer it beside has
  reached its own limit, the same as today. From then on they compete on score
  again, and the pair most in doubt comes first.
- "Counted" means as the fit counts it: answers a move set aside are not in the
  run and do not make a pair split. A "Can't decide" answer neither extends a
  run nor breaks it.

**Why two in a row (owner's call).** Two agreeing answers after a switch are
what the later-answers rule needs to outweigh the answers before it (at a
`RECENCY_FACTOR` of 0.6, docs/engine-calibration.md "Later answers"), so the
pair's own answers have said what they will.

**Why a backstop (my call).** Two items the user truly rates the same can
alternate A, B, A, B and never make a run of two. Without `MAX_SHOWINGS_SPLIT`
they would come back every few answers forever on a settled list, each answer
leaving them about as uncertain as before. The backstop bounds that and hands
the rest to the explainer's "drag it into place".

## Goals

- In a replay built like the owner's session (the six trips items, Reykjavík
  and Dubrovnik answered Reykjavík, Dubrovnik, Reykjavík at 6, 12 and 14, the
  rest answered to a settled order), the picker asks Reykjavík and Dubrovnik
  again before it has asked every other pair three times.
- On the short drift scenarios, users whose preferences shift reach the new
  order in no more answers than today.
- Users whose preferences do not shift are not slowed by more than the
  calibration rule's 10%.
- The explainer and the picker agree on which pairs are resting, from one
  definition.

## Non-goals

- No "ask me about these two" button on the card. It would let the user ask
  for any pair at any time, and is worth considering on its own if this rule is
  not enough.
- No change to `REPEAT_FACTOR`, `RECENCY_FACTOR` or the flip chances.
- No change to how the explainer words a pair that is not resting.

## Anti-goals (a failure even if it works)

- **A loop.** The same two items offered again and again on a settled list.
  `MAX_SHOWINGS_SPLIT` is the guard; the tests check a pair that keeps
  alternating rests at it.
- **A promise broken the other way.** The explainer says a pair is resting
  while the picker is about to ask it, or the reverse.
- **Results that depend on how they were reached.** Which pair is next stays a
  deterministic function of the history: warm path, cold replay, undo and
  checkpoint restore agree (docs/ARCHITECTURE.md 6.1, 6.5).

## Constraints

- Copy rules for this project: no em-dashes; never "land" or "lands" as a
  verb.
- No migration or compatibility for saved sessions or snapshots. Bump the
  snapshot version if a cached next pair could differ.
- The warm path stays inside its time budget on a 1,000-item list
  (`npm run bench:engine`). Telling split pairs apart must not be a pass over
  every term on every pick if that breaks the budget; keeping the set up to
  date as answers come in, the way `shown` is, is the expected shape.

## How it works

- `PickerInput` gets the open pairs, by `pairKey`, beside `shown`.
- The engine keeps them from the counted answers, as it keeps `shown`, and
  rebuilds them wherever counted answers change: a new answer, undo, a move
  that sets answers aside, removing or restoring an item.
- `repeatDiscount` rests a pair by the rule above.
- One exported function says whether a pair rests, from its times asked and
  whether it is open. The picker and `restingPair` in
  lib/state/progressExplain.ts both call it, so the window and the picker cannot
  drift apart. The explainer works out open from the answers it already has.
- `SPLIT_SETTLED_RUN` and `MAX_SHOWINGS_SPLIT` go in
  lib/ranking/bt/constants.ts next to `MAX_SHOWINGS`, the second with a comment
  pointing to its calibration section.

## Calibration

- Add `MAX_SHOWINGS_SPLIT` to the overridable constants (tests/sim/overrides.ts)
  and to `scripts/sim-sweep.mjs`.
- `SPLIT_SETTLED_RUN` is fixed at 2 by the owner and not swept.
- Sweep `MAX_SHOWINGS_SPLIT` at 3 (off, the current behaviour), 4, 5, 6 and 8 on `cal-recency` and
  `cal-pairs`, `--size full`. Run the two short drift scenarios with 40 seeds,
  as the later-answers sweep had to, since 6 seeds were too noisy there.
- Deciding rule (tests/sim/compare.ts), with 3 as the current value: the short
  drift scenarios decide; `cal-pairs` and the 100-item drift scenario are
  guards. More than 10% slower on any guard rejects a value.
- A second measure, for the reason this exists: on the short scenarios, the
  share of runs where, at the first answer that reaches the top level, the
  explainer's remaining spot is resting. Lower is better. Report it beside the
  gate; it does not decide alone.
- If no value passes, the rule ships off, the result is written up, and the
  owner decides between the "ask me about these two" button and leaving it.
- Record it in docs/engine-calibration.md under a new section, "Split pairs",
  in the shape of "Later answers".

## Tests

- Picker: an open pair past `MAX_SHOWINGS` keeps scoring with the plain
  repeat discount; a pair answered one way rests at `MAX_SHOWINGS` as now.
- Picker: A, B, A, A rests (a run of 2); A, B, A, B does not; A, B, A,
  "Can't decide", A rests (the draw does not break the run).
- Picker: a pair that keeps alternating rests at `MAX_SHOWINGS_SPLIT`, and
  comes back once every other pair has reached its own limit.
- The owner-shaped session above: Reykjavík and Dubrovnik come back.
- The explainer: an open pair is not resting; after a run of 2 it is. A pair
  whose split came from an answer a move set aside counts as not split.
- Warm, cold, undo and checkpoint replays pick the same next pair on a history
  with split pairs (extend the existing agreement tests).
- `npm run bench:engine` within budget.

## Docs

- docs/ARCHITECTURE.md 6.7 (the picker): the split-pair cap and why.
- docs/engine-calibration.md: the "Split pairs" section.
- docs/UX.md: no change unless the resting copy changes.

## Left to the builder

- Where the split set lives in the engine state and how undo restores it, as
  long as the replays agree.
- Whether the second measure needs a new trace field or can be read from the
  existing traces.
