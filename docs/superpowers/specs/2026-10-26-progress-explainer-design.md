# Progress explainer: design

_2026-10-26. Status: proposed, waiting for the owner's approval._

## Why

The progress line under the comparison cards gives a verdict ("Taking shape.")
with no reasons. On a six-item trips list the owner saw level 2 of 4 after 24
answers and reasonably concluded the app was broken. The real cause was
specific and fixable: three answers formed a circle (Reykjavík over Lisbon in
answer 1, Cape Breton Island over Reykjavík in answer 9, Lisbon over Cape
Breton Island in answer 15), and nothing after answer 15 went back to it. The
engine has known this since the flip-chance change (docs/engine-calibration.md,
"Flip chances"), but only a developer reading a replay could see it.

The explainer puts that story on screen: a "Why?" link on the progress line
opens a window that says, for the level shown, what is holding it there, in
terms of the user's own answers, with a picture of any circle, and what will
move it.

## Goals

- Every gauge state gets an explanation written for that state: the
  "comparing" stage, a list that started ranked, and each of the four levels.
- The explanation names the user's own answers by item and answer number, so
  they recognise them ("you picked Lisbon over Cape Breton Island in answer
  15").
- Each doubtful spot says what will settle it, and says so when the next
  question on screen is about it.
- A circle of answers is drawn, not only described.
- It works on a 6-item list (one or two spots, all of them shown) and on a
  1,000-item list (a summary, the top three spots, and a count of the rest).

## Non-goals

- No "Ask me about this pair" button in this step. The picker already asks
  the pair most likely to be out of order (ARCHITECTURE.md 6.7), so on the
  trips list the next question after answer 15 is a loop pair. The explainer
  says when the next question is about a spot. A button that overrides the
  picker is a later step, only if the owner finds spots the picker does not
  get to.
- No change to the gauge itself, its levels, its ceilings or its wording.
- No explanation on the ranked-list preview or anywhere else the progress line
  is not shown.
- No history of how the level moved over time.

## Anti-goals (a failure even if it works)

- **Blame.** The copy must not say "you changed your mind" or "you were
  inconsistent". In the trips list no pair was answered two ways; the circle
  came from three different pairs, which is normal with close calls. The
  wording describes the answers ("these answers go in a circle"), not the
  person.
- **Explanation without a way forward.** Every spot ends with what settles it.
- **Numbers the user cannot use.** No disorder values, no "places out", no
  flip chances as decimals. A spot may say "about even" or "likely, not sure"
  (see Wording), never "0.54".
- **Disagreeing with the gauge.** The explainer reads the same estimate the
  gauge reads (exact chances under 26 items, the Gaussian estimate from 26 up),
  so it never says "nothing in doubt" under a level that says otherwise.

## Constraints

- Copy rules for this project: no em-dashes; never "land" or "lands" as a
  verb.
- Built on the existing `Modal` (components/ui/Modal.tsx), the way
  `HowItWorksModal` is.
- No new dependency. There is no react-native-svg; the circle picture is built
  from Views (see The circle picture).
- Worked out only when the window opens, never on every answer: a 1,000-item
  list must not get slower to answer.
- The window reads the state the progress line was drawn from. If an answer
  arrives while it is open (it cannot, since the window covers the cards, but
  undo from the keyboard might), it recomputes from the new state.

## Where it goes

`ProgressLine` (components/comparison/ProgressLine.tsx) gets a text link,
"Why?", after the words, whenever the line is shown. It opens
`ProgressExplainerModal`. The modal is titled "How close is this order?".

```
[████████░░░░░░░░]  Taking shape.  Why?
```

The link is a `Pressable` with `accessibilityRole="link"` and the label
"Why is the order at this stage?".

## What the window shows

Top: the same bar and words as the line, larger, so the window is clearly
about that line. Then one short paragraph for the state, then the spots, then
a closing line.

### State paragraphs

| State                                      | Paragraph                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| comparing                                  | "Pairwise can't say how close the order is until every item has been compared at least once. These haven't been yet:" then up to 8 item names, and "and N more" past that. No spots. Closing: "Keep answering to bring them in." (The picker has no rule to ask them first; their wide uncertainty only makes them likely.) |
| ranked-start                               | "Your list started in an order you said was already ranked, so Pairwise trusts that order and can't measure how far off it is. What it can show is where your answers disagree with it." Then the spots, if any; if none: "None of your answers disagree with the starting order so far."                                   |
| level 0, Rough order so far                | "Many items could still move several places." Then the spots.                                                                                                                                                                                                                                                               |
| level 1, Taking shape                      | "Most of the order is settled. A few spots are still in doubt:" then the spots.                                                                                                                                                                                                                                             |
| level 2, Close                             | "Only fine adjustments left. The last doubts:" then the spots.                                                                                                                                                                                                                                                              |
| level 3, Changes from here should be small | "Nothing is left in real doubt." If any pair has a chance of flipping above 10%, "The likeliest remaining change:" and that one spot; otherwise no spots. Closing: "You can stop here, or keep going to be sure."                                                                                                           |

### Spots

A spot is one or more doubtful pairs that share a cause, described once.
Each spot is a card with a heading, a picture or a pair row, the answers
behind it, and a line saying what settles it.

The kinds, in the order they are checked for a doubtful pair (A shown above B):

1. **Answered both ways.** A and B were asked directly, and at least one answer
   went each way. Heading: "You've picked both ways". Body lists each answer
   with its number. Settles: "Another answer between these two decides it."
   Checked first: the direct answers are the plainer cause.
2. **Circle.** The counted answers lead from A down to B and from B down to A
   (A over X, X over B; B over A directly, or through one item). Shown as a
   loop. Heading: "These answers go in a circle". Settles: "One more answer
   between any two of these breaks the circle."
3. **Couldn't decide.** Every direct answer between A and B was "Can't decide".
   Heading: "You couldn't decide between these". Settles: "If they really are
   even, their order doesn't matter much. If not, a clear answer settles it."
4. **Only inferred.** No direct answer between A and B. Heading: "Never compared
   directly". Body: the shortest chain that puts A above B ("A over X in answer
   3, X over B in answer 7") or, when there is none, "Their order comes from how
   each did against other items." Settles: "Comparing them directly settles it."
5. **Moved by hand.** A or B was placed by a move and has had fewer than two
   counted answers since. Heading: "You moved Lisbon here". Settles: "A
   question or two about it will confirm the spot." Checked before 4, after 1
   to 3.
6. **One answer, close call.** One clear direct answer, alone or beside draws.
   Heading: "Only one answer between these", or "Only one clear answer between
   these" when there are draws too. Settles: "Another answer would confirm it."

A pair that fits none of these (doubt from the general spread of a long list)
is not shown as a spot. Only the 200 likeliest doubtful pairs are looked at for
a cause; early on a long list there can be hundreds of thousands, and the rest
are only counted.

Grouping: circles are found first, so every pair that circles through items of
a known circle joins it whatever its chance (the three loop pairs of the trips
list are one spot, not three). Circles that share an item are one spot, drawn
as the first one found. Spots are ordered by the sum of their pairs' flip
chances. At most three are shown. After them, one line says what is left out,
each pair counted once: "And N more spots like these." for the spots past
three, then "N other pairs are still in doubt." for doubtful pairs in no spot
("N pairs are still in doubt." when no spot is shown). Counts over 999 use
digit grouping. At the top level the one spot given is the one with the
likeliest pair, and no counts are shown.

If the next question on the cards is a pair in a spot, that spot's settle line
ends with: "The next question is about this." That replaces the button for now.

### Wording of a pair's chance

Each spot may carry one short phrase from the largest flip chance in it:

| Chance     | Phrase                   |
| ---------- | ------------------------ |
| 40% to 50% | "about even"             |
| 20% to 40% | "could go either way"    |
| 10% to 20% | "likely right, not sure" |
| below 10%  | no phrase                |

### The circle picture

A vertical loop built from Views: each item as a chip in a column, joined by a
down arrow labelled with the answer ("answer 15"), and a bracket on the right
that runs from the last chip back up to the first with the last answer's
label. Up to four items. Longer circles are shown as text only ("Reykjavík over
Lisbon over Cape Breton Island over Reykjavík").

Mock of the trips list after answer 24:

```
How close is this order?                                         ×
-------------------------------------------------------------------
[████████░░░░░░░░]  Taking shape.

Most of the order is settled. A few spots are still in doubt:

  These answers go in a circle                        about even
  ┌──────────────────────┐
  │ Reykjavík            │◄─────┐
  └──────────────────────┘      │
        │ over, answer 1        │
        ▼                       │
  ┌──────────────────────┐      │ over,
  │ Lisbon               │      │ answer 9
  └──────────────────────┘      │
        │ over, answer 15       │
        ▼                       │
  ┌──────────────────────┐      │
  │ Cape Breton Island   │──────┘
  └──────────────────────┘

  Each answer makes sense alone, but together they can't all be
  right, so Pairwise can't tell which of the three goes first.
  One more answer between any two of these breaks the circle.
  The next question is about this.

Everything else is settled: Banff first, Dubrovnik and Amalfi Coast
last, from answers that all agree.
-------------------------------------------------------------------
```

The closing line ("Everything else is settled: ...") is written only on lists
under 26 items, naming the items in no doubtful pair, grouped by where they
stand (first, last, or "in the middle") when there are at most 6 of them;
otherwise "The other N items are settled."

## How it is worked out

A pure function, `explainProgress`, in a new `lib/state/progressExplain.ts`,
takes the progress state, the list's events, the shown order, the engine's
`fit` and `slots`, and the next pair, and returns plain data:

```ts
interface ProgressExplanation {
  state: ProgressState;
  level: ProgressLevel | null;
  uncompared: string[]; // item ids, comparing stage only
  spots: Spot[]; // at most three
  moreSpots: number;
  closePairs: number; // doubtful pairs in no spot, given or not
  settled: string[]; // items in no doubtful pair, small lists only
}

type Spot =
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

interface AnswerRef {
  winner: string;
  loser: string;
  answer: number;
  draw: boolean;
}
```

The component turns this into words. All copy lives in the component's module
(or a sibling `progressExplainText.ts`), so the data function has no strings.

Steps:

1. **Doubtful pairs.** Run the same pair walk as `expectedDisorder`, uncapped,
   with the same chance function the gauge uses for this list's size, and keep
   every pair whose chance is at least 5%, with its chance. Add an optional
   `onPair(i, j, chance)` callback to `expectedDisorder` rather than copying its
   walk. Cost: the same as one uncapped gauge reading, which the gauge already
   does for short lists.
2. **Counted answers.** Read them from `fit.pairs` (`PairTerm`: winner, loser,
   weight, eventIndex), so answers a move set aside are left out, as the engine
   leaves them out. A draw is two terms with the same eventIndex. The answer
   number is the count of `pair` events up to and including eventIndex, which
   is the number the answers counter showed.
3. **Classify** each doubtful pair as in Spots. The circle search is a
   breadth-first search over the counted answers as a directed graph (winner to
   loser), at most three steps each way, starting only from the doubtful pair's
   two items, and only for the 200 likeliest doubtful pairs, so it stays cheap
   on long lists. Circles are made in a first pass over those pairs, so a pair
   is grouped with a circle however its chance compares with the circle's.
4. **Group and rank** spots, cut to three, and mark the one with the next pair.
5. **Settled items** (lists under 26 only).

## Tests

- Unit tests for `explainProgress` from replayed histories, one per spot kind,
  one per state, and the trips list (the bundled trips sample in
  lib/import/sampleData.ts with the owner's 24 answers as a fixture). The trips
  test asserts one circle spot with answers 1, 9 and 15, marked as next, and
  Banff, Dubrovnik and Amalfi Coast settled.
- A long-list test (200 items, a simulated user) that asserts at most three
  spots, a count of the rest, and a time budget.
- Component tests for the link and the modal: each state renders its
  paragraph, the circle renders its chips and labels, the close button works.
- An e2e step in the existing deck test: open "Why?", see the title, close.
- docs/ARCHITECTURE.md 6.12 and docs/UX.md get a short section on the window.

## Left to the builder

- Exact layout, spacing and colours, from the theme (lib/theme).
- Whether the copy lives in the component file or a sibling module.
- The 5% doubt threshold and the 10% top-level threshold may be tuned if the
  trips list or a simulated list reads badly; say so in the doc if changed.
- How the moved-item check reads which move set an item's prior. The replay
  state already keeps it per slot (the placement index, -1 for a seed prior,
  lib/ranking/bt/engine.ts); exposing it on `EngineState` beside `fit` is the
  likely route.

## Checked against the code

- `fit.pairs` is the engine's active terms (`Evidence.activeTerms`), so
  answers a move set aside are already left out, and each term carries its
  event index.
- A draw is stored as two terms of equal weight, one each way, with the same
  event index.
- In the circle mock, the chips follow the circle starting from the item shown
  highest.
