# Pairwise List Ranker Architecture

This describes the design, the ranking engine included (section 6).

Everything here is built. The limits that remain are in
[TECH_DEBT.md](TECH_DEBT.md). The simulation harness and the calibration of the
engine's constants are in [engine-calibration.md](engine-calibration.md).

## 1. Technical goals

Build a static web application that:

- stores working state entirely in the browser
- ranks items deterministically from a history of the user's actions
- does each user action one way, with one effect, from every screen it can be
  reached from
- supports both primitive and object-shaped items
- gives the user their own document back, with each ranked array reordered in
  place
- can be hosted as static files with no backend dependency

## 2. Non-goals for v1

- user accounts
- shared lists or personal reranking copies
- collaborative real-time editing
- server-side persistence
- an app-defined document format of any kind
- configurable ranking algorithms in the UI
- numeric or finished-state confidence claims ("within about N places", "about N
  answers left", "you can stop here", any "good enough" or "settled" state). The
  app does say how close the order is, in four qualitative levels the
  simulation holds to (6.12), and never more than that
- a tier pass, a top-N mode, or scripted openings (pivot rounds, insertion sort)
- old answers fading over time: moving an item is the explicit way to change
  your mind about it
- widening a seeded order's trust automatically when answers contradict it
- showing a numeric rating anywhere
- reading saves or session files from an earlier version: the app is not in
  production, so a format change bumps the version and older saves are
  rejected, with no migration

## 3. Stack

Frontend:

- Expo with TypeScript, Expo Router, React Native Web, static web output
- Zustand for the workspace store
- hand-written readers for stored data (`lib/persistence/storedShapes.ts`)
- `yaml` for YAML parsing and serialization
- `localStorage` for the browser save, as a manifest plus pieces (section 8.3)
- a Web Worker for cold rebuilds of a ranking, with main-thread time slices as
  the fallback

Testing:

- Vitest for unit, component and integration tests
- React Testing Library for components
- Playwright for end-to-end tests against the static build

Deployment:

- static build output
- optional single-container Docker image for serving built files
- optional one-service Docker Compose stack for hosting convenience

## 4. Architecture direction: static browser-only app

The app runs entirely in the browser: no backend API, no database, no
authentication, no server-managed sharing.

Why this is a strong fit:

- the user's primary workflow is import -> compare -> export
- the ranking engine is deterministic and purely client-side
- the imported item payloads are already JSON-like and easy to keep in browser state
- cutting sharing removes nearly all of the hard distributed-state and permissions complexity
- deployment becomes radically simpler: build static files, serve static files, go outside and enjoy the weather or at least stare at it resentfully

## 5. Data model

### 5.1 Client types

The user's own parsed document is the model. The app stores it verbatim and
annotates it: which arrays inside it are being ranked, and which fields play a
role. Nothing is normalised, renamed, or dropped on the way in.

```ts
type SourceFormat = 'list' | 'yaml' | 'json';
type PreviewTab = 'ranked' | SourceFormat;
type StartingOrder = 'unordered' | 'rough' | 'ranked';
interface SortSpec {
  field: string;
  direction: 'desc' | 'asc'; // desc is largest or newest first
}

interface DataSource {
  format: SourceFormat; // how it parsed; also the default export format
  document: unknown; // the parsed value, verbatim; string[] for 'list'
  arrayPath: string[]; // the list open now; [] when the document is it
}

interface FieldRoles {
  labelField?: string; // object entries only: what titles each card
  summaryFields?: string[]; // fields shown on each card
  fieldRenderers?: Record<string, FieldRenderer>; // how each is drawn
  positionField?: string; // optional: rewritten with 1..N on export
}

// One list in the document, with everything ranked in it.
interface RankedList {
  id: string; // items and events name their list by this
  arrayPath: string[];
  roles: FieldRoles;
  initialStartingOrder: StartingOrder; // the order it was created with, never changed
  initialSort?: SortSpec; // the field it was sorted by when created, if it was
  configuredExplicitly: boolean; // set up by hand, not from listDefaults
  originalItemIds: string[]; // the import, in order; index = arrivalIndex; never rewritten
  items: ListItem[];
  events: RecordedEvent[]; // the only source of truth for the ranking (section 6.3)
  createdAt: string;
  updatedAt: string;
}

// The document, and every list in it that has been opened.
interface Workspace {
  source: DataSource; // source.arrayPath names the open list
  listDefaults: { roles: FieldRoles; startingOrder: StartingOrder }; // for new lists
  lists: Record<string, RankedList>; // by pathKey(arrayPath); holds the open one
  lastAction?: UndoStep; // the step Undo offers, saved so it survives a reload
  createdAt: string;
  updatedAt: string;
}

// One step Undo can take back: the action whose events it deletes.
interface UndoStep {
  actionId: string;
  listIds: string[];
}

interface ListItem {
  id: string;
  listId: string;
  value: ItemValue; // one entry of the ranked array, as imported
  createdAt: string;
  updatedAt: string;
  // no `active` flag: whether an item is in the list is derived from the history
}

interface WorkspaceSnapshot {
  version: number; // bumped on any format change; any other version is dropped
  workspace: Workspace;
  ui: { previewTab: PreviewTab };
}
```

`RankingEvent` is in section 6.3. Every event carries the id of the user action
that recorded it.

There is deliberately no app-defined document schema. A `kind` discriminator,
a required title, and a canonical item wrapper were all removed: they forced
the user's data into a shape the app had invented.

### 5.2 Persistence model

There is no server database in v1. Persistent state is optional and
browser-local only:

- the Zustand store is the live state
- the browser save keeps it across reloads (section 8.3)
- a session file is the same snapshot, labelled, to move a workspace between
  browsers
- exported YAML, JSON or plain text is the user's own durable copy

Browser persistence is a convenience, not the system of record. Exported files
and session files are the user's durable portable artifacts.

## 6. Ranking design

The engine is a Bradley-Terry model fitted to the list's history. It lives in
`lib/ranking/bt/`. Pairs are the only question the app asks: a pair is nearly
effortless to answer, so the effort of an answer is easy to judge.

### 6.1 The model

Each item has a strength `s`. With the scale `k = 1.41` (√2):

- **Pair:** `P(A over B) = 1 / (1 + exp(-(s_A - s_B) / k))`.
- **Prior:** each item `i` has a Gaussian prior `N(m_i, v_i)` (section 6.4).

The fit is the MAP estimate: the strengths maximizing the log-likelihood of
every counted piece of evidence (each multiplied by its weight) plus the log
priors. Every item that appears in the objective has a proper prior, so the
objective is strictly concave and its maximum unique. That uniqueness is what
makes the ranking a deterministic function of the history, however the fit was
reached.

Each item's uncertainty is the **reciprocal diagonal curvature**:
`u_i = 1 / H_ii`, where `H` is the negative Hessian at the optimum. It is not
`(H^-1)_ii`: inverting the Hessian after every answer would break the warm-path
budget. It ignores covariance between items and understates uncertainty badly,
so on its own it is not shown to the user. The progress levels (6.12) read it
through `expectedDisorder`, whose levels are measured against the true accuracy
in the simulation rather than taken at face value.

**Evidence.** The history is turned into weighted evidence:

| Event                            | Evidence                                                                              |
| -------------------------------- | ------------------------------------------------------------------------------------- |
| Pair choice                      | the pair model, winner over loser, weight 1                                           |
| Pair "much better"               | the same, weight 1.75 (carried over from the Elo engine; calibrated, kept)            |
| Can't decide                     | a draw: half a win each way, total weight 0.5 (each direction 0.25); calibrated, kept |
| Placement (a move, by any route) | none; excludes the placed item's earlier evidence and replaces its prior (6.8)        |
| Don't recognize                  | none; the item leaves the fit (6.9)                                                   |
| Removal                          | none; the item is no longer shown or offered (6.9)                                    |

"Can't decide" means "these two feel equal to me", so it is a draw, not an
abstention. "Don't recognize" covers not knowing an item. No dedicated tie model
is used; the weight is calibrated instead.

**Eligibility.** An item's evidence from event `E` counts unless, after `E` and
not undone, the item was placed (6.8) or marked "don't recognize" (6.9). A pair
event counts only if both its items are still eligible for it. Eligibility goes
through one predicate, never two implementations.

Removal is deliberately not in that rule: removed items keep their evidence, so
a survivor keeps what it learned against an item later removed. The rule behind
every exclusion is that evidence stops counting only when the user's action says
those answers were unreliable. A move says the item was misjudged; "don't
recognize" says the answers were guesses. A removal says the item does not
belong in the list (a duplicate, off-topic, not wanted), which says nothing
against the answers given about it. Since people have removed items they did not
know, the remove confirmation and the guide point to "Don't recognize…" for that
case.

### 6.2 One action, one implementation

A user action may be reachable from several places. It records the same events,
with the same effect, from every route. Where two routes differed, the design
changed until they agree; a difference is never kept because it once had a
reason.

| Action                 | Routes                                                              | Records                                |
| ---------------------- | ------------------------------------------------------------------- | -------------------------------------- |
| Answer a pair          | a card, "Much better", "Can't decide", the keyboard                 | `pair`                                 |
| Mark "don't recognize" | the pill on a pair                                                  | `unrecognized`                         |
| Move an item           | a drag, a row's keyboard move, dragging a "Didn't recognize" row up | `placement` (one item)                 |
| Remove an item         | a card's or a ranked row's remove control                           | `removal`                              |
| Undo                   | the Undo control, Ctrl/Cmd + Z                                      | deletes every event of the last action |

Every event an action records carries that action's id, and each action records
one event. Nothing adds an item to a list being ranked or changes its starting
order after it is created, and a removed item comes back only by undo.

### 6.3 Events

```ts
// What the engine replays. A list's history holds RecordedEvent: the same, plus
// the id of the user action that recorded it, which groups an undo step.
type RecordedEvent = RankingEvent & { actionId: string };

type RankingEvent = { id: string; listId: string; createdAt: string } & (
  | { kind: 'pair'; leftItemId: string; rightItemId: string; outcome: PairOutcome }
  | { kind: 'placement'; itemId: string; aboveItemId?: string; belowItemId?: string }
  | { kind: 'unrecognized'; itemIds: string[] }
  | { kind: 'removal'; itemIds: string[] }
);
type PairOutcome = 'left' | 'right' | 'left_strong' | 'right_strong' | 'draw';
```

What each does is in 6.1 (pairs), 6.8 (placement) and 6.9 (unrecognized and
removal). An item's presence, its prior, the tie order and the ranking are all
derived from the events. Undo deletes events; it never appends their opposite.
Each item stores an immutable `arrivalIndex` (6.9) and no `active` flag. A list
stores the `startingOrder` it was created with, and no sort mode. `RankingState`
holds strength and uncertainty only: no rating, K-factor, win counts or
head-to-head tally. Any change to these shapes bumps `WORKSPACE_VERSION` and the
session file version, with no migration.

### 6.4 Starting order

| Option                    | Hint                                                               | Prior                                                                        |
| ------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------- |
| **No particular order**   | You haven't tried to rank it yet, or only very loosely             | `N(0, 25^2)` for every item, exactly tied, so the arrival order shows        |
| **Roughly best to worst** | You sorted it yourself                                             | a gradient over 80 strength units by imported position, sd = 20% of the span |
| **Ranked best to worst**  | You ranked it in this app before, or put real care into it by hand | the same gradient, sd = 3% of the span                                       |
| **Sort by a field**       |                                                                    | the "roughly" prior, with the order taken from a number or date field        |

The default is "No particular order". The hint says that when unsure, "Roughly"
is the safer choice: overstating trust gets a ranking stuck, while
understating it costs a few answers.

A list takes its starting order from the document's defaults
(`listDefaults`) when it is created, and it never changes after that. There is
no event for it, and defaults never reach a list that already exists. The setup
screen shows an existing list's order read-only, and edits it only for a list in
the same document that has never been opened.

**Every fitted item has exactly one active prior at every point in the
history**, removed ones included. It is derived by replay, never stored:

- when the list is created, a **seed prior**, taken from the item's
  `arrivalIndex` (its position in the original import, never its index in the
  items array) and the list's starting order;
- at a placement of the item, the placement prior **replaces** whatever prior
  was active, seed or earlier placement;
- undoing an action removes its events, so replay restores the priors that were
  active before it.

Unordered priors are exactly tied. Arrival order matters only through the tie
order (6.6), never through the model: reversing the arrival order of an
otherwise identical unordered list makes no material difference in ranking
quality in simulation.

A sort takes numbers, numeric strings and standard dates, with at least half the
entries parsing and the values not all equal. It orders by value, ties by
original order, with unusable values in the middle; dates with a time and no zone
count as UTC. `originalItemIds` is built in that order, while `items` and the
document stay in document order and are never rewritten. A sort belongs to its
list: "Set as default" never carries one.

### 6.5 Fitting, replay and snapshots

- **Method:** Newton's method on the full objective, solving each Newton step
  with conjugate gradient using Hessian-vector products (the Hessian is sparse:
  a weighted graph Laplacian from the evidence plus the diagonal priors), a
  Jacobi preconditioner, and a backtracking line search on the objective. Plain
  coordinate passes are not enough: in simulation they needed a median of 62 and
  up to 158 passes per answer to converge on 1,000 items.
- **Stopping test:** scale-aware, from the Newton decrement, the gradient norm
  relative to the number of items and the prior precision, and the largest change
  in any strength. The product-relevant standard is that continuing the solver
  well past the stopping point must not change the displayed order or the next
  question across the benchmark corpus, and that the objective never decreases
  between iterations.
- **A solve that misses its test** after its iteration cap on the warm path
  finishes in the worker as a cold rebuild from the last checkpoint, with the
  same "Restoring" state. The cap is set so this does not happen on the
  benchmark corpus.
- **Warm start** after each answer, from the previous strengths.

Placements need intermediate fits (6.8), so replay runs in segments:

1. Evidence is maintained incrementally (adjacency per item), never rebuilt from
   the whole history on each answer.
2. A **checkpoint** (strengths, uncertainties, the tie order, and which evidence
   is excluded) is taken after every placement, and every 500 events otherwise.
   "Don't recognize" events only change exclusions; they need a fit only when a
   placement follows them.
3. Checkpoints are kept in memory, keyed by the history prefix they cover (event
   count plus the id of the last event). They are a cache, never a source of
   truth.
4. **Warm rebuild** (an action appended, an undo): continue from the latest valid
   checkpoint or the live state. An action appends one event to a list, folded in
   warm.
5. **Rebuild from the last valid checkpoint** after anything that changes the
   history before the end (an undo of something older than the last checkpoint):
   the earliest checkpoint whose prefix is unchanged.
6. **Cold replay:** from the priors, in the worker (6.11).
7. **Undo snapshot:** the live session also keeps the complete state from just
   before its last action, including the next question. Undoing that action
   restores it with no replay and no fit. A second undo in a row falls back to
   rebuilding from a checkpoint.
8. **Persisted snapshot:** the engine can export its fitted live state at the end
   of its history as a versioned, serializable snapshot and restore from one. A
   restore is accepted only if the snapshot's engine version, original items and
   initial starting order match the history, and its covered event ids are a
   non-empty prefix of the history's. The restore walks the covered events
   (rebuilding membership, evidence and what was shown, with no fit) and in the
   same walk checks the priors against them: each item records the event whose
   placement set its prior, or none, and these must match the placements that
   applied in the covered events; every seed prior must equal the one replay
   derives under the starting order in force. Otherwise the snapshot is ignored
   and the replay runs from the priors. It is a cache: a fresh replay stays
   canonical (6.6), and tests compare a snapshot-started replay with a fresh one.

   So that the first undo after opening is also a snapshot undo, a snapshot
   whose last event is an applied placement may carry the placed item's previous
   prior and tie-order index. The record is present or absent, never extra: it is
   rejected when the last event is anything else. It is absent when that earlier
   state was never known to the session (after an open, an undo onto a move, and
   a save), and then the first undo after opening rebuilds from a checkpoint
   instead. Its values cannot be checked against the history when an earlier
   prior came from a placement, so a hand-edited one can only affect that first
   undo. The format version is bumped whenever what a restore rebuilds changes;
   an older snapshot is ignored and the list replays.

   The app's cache entry seals the displayed order and the next question the
   session showed when it exported the snapshot, beside the snapshot and under a
   checksum of its own, so a damaged view costs the quick open and never the
   snapshot. An open whose cached snapshot covers the whole history, and whose
   view names only items the list has, shows that view at once and starts the
   session once a screen has shown it and the page is idle, or sooner if an
   answer, an undo or anything else that needs the session comes first. The
   first disorder of a deferred session waits another 500 ms, so an answer
   clicked right after the open is not slowed by it. A session
   that then fails to start sends the list to a cold build, as any failed open
   does.

The **benchmark corpus** is part of the test suite, run in a throttled browser
for the timing numbers and in Node for regressions: 1,000 items and 10,000
events with 200 placements early, in the middle and late in the history; many
"don't recognize" items; a "Ranked" import; and removals partway through.

### 6.6 Display order and determinism

Every decision that changes state is canonical:

- **Iteration orders:** items by arrival sequence (6.9); evidence by event order.
  Events sharing a timestamp keep their append order.
- **Displayed order:** sort by **strength band**, highest first, then by **tie
  order**, and nothing else. A strength band is the strength rounded to a fixed
  grid, `Math.round(s / 1e-6)`. A fixed grid, unlike "within `1e-6` of each
  other", is transitive: it can never chain three nearly equal items into one tie
  and reorder two that were not tied. Head-to-head and win-count tiebreaks are
  dropped: head-to-head evidence already shapes the strengths, and keeping them
  ahead of the tie order would let them overrule a move inside a band.
- **Tie order:** a total order over all items, rebuilt by replay. It starts as the
  immutable arrival sequence, never the current order of the items array. Each
  placement, in history order, moves the placed item within it:
  - if the item's band at that moment equals its upper neighbour's band: directly
    after the upper neighbour;
  - otherwise (its band is lower than the upper neighbour's, which includes a drop
    at the very top): directly before the lower neighbour;
  - at the very bottom: directly after the upper neighbour.

  The item's strength is the midpoint of its neighbours', so its band lies
  between theirs (inclusive). If it shares the upper neighbour's band, it sorts
  directly after it within that band; if it shares only the lower neighbour's, it
  sorts directly before it; if it is in neither band, strength alone puts it
  between. So immediately after the placement, each placed item is ordered between
  its recorded neighbours. Other rows may have shifted during the refit in 6.8
  step 3; the item is still between the two neighbours, though not necessarily
  adjacent to both. This is what keeps an evidence-free list in arrival order, and
  what lets a move into a run of tied items show exactly where it was put, without
  putting any artificial difference into the model's strengths.

- **Question choice:** scores are compared on a fixed grid too (rounded to `1e-9`
  of the round's best score); equal grid values are tied, and ties go to the pair
  whose higher-ranked item is ranked higher, then whose other item is ranked
  higher.

**Numerical determinism, stated honestly.** Within a supported runtime and
engine version, replay uses a canonical iteration and evaluation order, and its
output is deterministic for the same history. Bit-identical results across
browsers or devices are not promised (`Math.exp` may differ in its last bits);
a session opened in another browser is replayed there, and that replay is
canonical there. The live session (warm-started after each answer) and a fresh
replay are two different paths, and their converged strengths can differ by a
tiny amount. No grid or tolerance can make a cutoff comparison agree on both
paths in every case: a value can always sit within rounding error of a grid
line. The design therefore:

- **Makes disagreement rare:** the solver converges at least four orders of
  magnitude below the band width (strength error under `1e-10` against a `1e-6`
  grid) and computes in a canonical order, so a disagreement needs a strength
  within `1e-10` of a grid line and a neighbour on the other side of it.
- **Names the canonical result:** a fresh replay from the history is the
  definition of the ranking. A cold build shows it; a reload that opens from a
  cached snapshot shows the same result within the solver's tolerance, and is
  tested against it.
- **Shows a disagreement cannot corrupt anything:** every event records what the
  user was actually shown and answered (the pair, each placement's two
  neighbours), so the history stays true to the user's actions even if a replay
  would have offered a different question next. The worst case is two near-tied
  rows swapping, or a different next question, after a reload.
- **Tests it:** a property test over at least 200 simulated histories (mixed
  pairs, draws, placements, don't-recognize, removals and undos) in which the
  warm-started path and a fresh replay give the same displayed order and the same
  next question, plus histories built to put strengths within a few solver
  tolerances of a grid line. A failure on the benchmark corpus blocks release. A
  disagreement found in use is a correctness bug: it is reproduced from its
  history and used to tighten the solver, the grid or the tests.

### 6.7 Choosing the next question

A calibrated rule of thumb for "which question would settle the order most", not
a derived expected information gain. It asks about the pairs most likely to be
the wrong way round, not about the items whose strengths are least sure: an
item that has won every answer has a wide strength (the answers say it is on
top, not by how much) but a settled place, and asking about it again teaches
nothing about the order.

Order the counted items by strength. For each item, consider opponents at
offsets 1 to 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512 and 768
places below it. Score each pair, A shown above B:

    c2 = k^2 + u_A + u_B      (k^2 = 2: the model's own scale, squared,
                               so all terms are in strength units squared)
    p  = 1 / (1 + exp(-(s_A - s_B) / sqrt(c2)))
    settle = p (1 - p) / c2 * (u_A + u_B)
    score  = flip(A, B) * settle

`flip(A, B)` is the chance that B belongs above A. Every pair is first scored
with the Gaussian estimate, `Phi(-(s_A - s_B) / sqrt(u_A + u_B))`; then the 32
best are scored again, best first, with the chance read from the answers
themselves (`lib/ranking/bt/flips.ts`, section 6.12), until the next Gaussian
score is below the best exact one, and the best exact score wins. Scores are
compared on the grid of section 6.6, the shortlist too, so warm and fresh
replays ask the same question.

Multiply by `0.3^j` where `j` is how many times the pair has been shown; a pair
shown three times is offered again only when every other pair has been too.
Never offer the immediately previous pair. Removed items and items marked
"don't recognize" are never offered. Against the earlier rule, which scored
each item's own uncertainty, this one reached the gate in 2.5% fewer answers
over the four user models at n = 100 (careful users 7.4%), and on a six-item
list it stopped asking about an item that had already won every answer
(docs/engine-calibration.md, "Flip chances").

### 6.8 Placements

What the user means by a move: "this belongs here, better than what is below and
worse than what is above". It is a firm statement about the region, not the exact
place: moved from 500th to 30th means a top-50 item, and later answers may move
it from 30th to 45th, not back toward 500th. This is a **soft placement**.

Every move is a placement, whatever the route: a drag, a row's keyboard move, or
dragging a "Didn't recognize" row up into the ranking. One `placement` event
holds one item and the two rows it goes between as displayed (one is absent at
the very top or bottom). When a placement is applied:

1. It is judged against the state before the event, and skipped if its item
   cannot be placed (removed, or not in the list) or if neither neighbour is
   visible. A skipped placement changes nothing.
2. Every piece of evidence involving the item, from before the event, stops
   counting, for both sides. Its opponents forget those answers too: if the user
   misjudged the item then, those answers say little about the opponents. The
   events stay in the history; undoing the move makes them count again.
3. The list is refit once, without that evidence. **Other rows may shift as a
   result**, usually a place or two among the items the moved item had been
   compared with. This is accepted for every route.
4. The item gets a placement prior that **replaces** whatever prior was active,
   centred on the midpoint of its two recorded neighbours' strengths in that fit.
   Because the item has exactly one prior and no counted evidence, its fitted
   strength equals that prior mean, so placing it moves nothing else. If the two
   neighbours are tied, the item ties with them too, and the tie order (6.6)
   puts it between them. Either way, **at the moment of the move it shows exactly
   between the two rows**. Later answers can move it, within its prior's reach.
5. A move to the very top or bottom centres the prior one local scale (below)
   beyond the edge row.
6. **Prior width**, in places first: one standard deviation is 10% of the items
   **visible at that event** (6.9), at least 1 place and at most 25 places.
   Convert to strength units with the **local scale**: the median gap between
   adjacent strengths among the visible items within ±max(5, 2.5% of them)
   positions of the spot, floored at the median adjacent gap across all visible
   items and at `0.05`, and capped so the standard deviation never exceeds the
   unordered prior's (25).
7. All of this is re-derived during replay from the fit at that event. Nothing
   but the event itself is stored.
8. Moving the same item again repeats this: only evidence since its latest move
   counts.
9. Moving an item marked "don't recognize" back into the list clears that mark.
10. A placement costs one fit, plus a checkpoint.
11. **Tests:** moves on an unordered list with no evidence, a near-tied region, a
    heavily seeded list, the top and bottom edges, and a list under 10 items. In
    simulation, an item moved near its true place stays within ±5% of it, and one
    moved far from it can still be brought back by consistent answers, both
    measured after a further `8n` answers (`2n` is unfair because a probe is made
    while the list is still settling). The CI floors are the 12-seed shares less
    0.1: near 0.9, far 0.55.

### 6.9 Don't recognize, removal and membership

**Don't recognize.** When an item is marked:

- It leaves the fit and is never offered again.
- Its earlier evidence stops counting for everyone, the same rule as a move.
- It is shown at the bottom of the ranking under "Didn't recognize" (10.1). It
  stays in the list and in exports (unlike a removed item).
- Undo brings it back, and so does moving it back into the ranking. That move is
  an ordinary placement: evidence from before the mark stays excluded, the item
  gets a fresh placement prior, and answers after the move count. Undoing the
  move restores the "don't recognize" state, with its exclusions and its place in
  the "Didn't recognize" section.

**Removal and membership.** Removal is the only change to a list's membership
after it is created, so it is an event in the history, not a flag on the items:

- Every item is present when the list is created, before the first event. Nothing
  joins a list later, and a removed item returns only by undo.
- **Arrival sequence, immutable:** each item gets an `arrivalIndex` from the
  original import order when the list is created, and it never changes. The tie
  order (6.6), seed priors (6.4) and every "by position" iteration in the engine
  use this sequence, never the current order of the items array, so a
  serialization change or a refactor that reorders the array cannot change a
  ranking or the next question.
- Removing an item appends a `removal` event, whatever the route, and either can
  be undone like any other action (10.3).
- An item's `active` flag is derived from these events and never stored.
- At any event `E`, **in the fit** is every item that is not marked "don't
  recognize" at `E`, whether removed or not; **visible** is not removed and not
  marked at `E`. Visible is the set the user saw, and the one placements measure
  positions in.

The three states, side by side:

- **Removed:** stays in the fit and keeps its evidence; not shown, not offered,
  even if it was marked "don't recognize" first. Undoing the removal shows it
  in the "Didn't recognize" section again.
- **Marked "don't recognize":** leaves the fit (no strength, no uncertainty, no
  term in the objective while marked); shown only in the "Didn't recognize"
  section; its evidence from before the mark is excluded for everyone.
- **Moved back from "don't recognize":** returns to the fit with a fresh
  placement prior; its evidence from before the move stays excluded.

### 6.10 Calibrated constants

From `lib/ranking/bt/constants.ts`; `docs/engine-calibration.md` has the runs.

| Constant                | Value                                | Why                                                                   |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- |
| Model scale `k`         | √2                                   | the scale of the pair model                                           |
| Unordered prior sd      | 25                                   | wide enough that answers, not the prior, decide                       |
| Seed span               | 80                                   | room for a gradient that answers can still reorder                    |
| Rough / ranked prior sd | 20% / 3% of span                     | how much the imported order is trusted                                |
| "Much better" weight    | 1.75                                 | carried over from the Elo engine; calibrated, kept                    |
| Draw weight             | 0.25 each way                        | a draw is half a win each way at half weight; calibrated, kept        |
| Strength band           | `1e-6`                               | ties on a fixed grid are transitive                                   |
| Solver tolerance        | `1e-10`                              | four orders below the band, so warm and fresh replays rarely disagree |
| Placement sd            | 10% of visible items, 1 to 25 places | a move is a firm regional statement; calibrated by simulation         |
| Picker offsets          | 1 to 6, 8, 12 ... 768 places         | near and far opponents at a fixed cost                                |
| Repeat penalty          | 0.3 per showing                      | the same pair again teaches little                                    |
| Most showings           | 3, unless nothing else can be asked  | a pair the user cannot call is not asked forever                      |
| Exact picker checks     | 32 best Gaussian scores              | the exact flip chance at a bounded cost per answer                    |
| Checkpoint              | every placement and 500 events       | warm rebuilds after an undo stay cheap                                |

### 6.11 Speed

Budgets are measured with the browser's CPU throttled 4x, with 1,000 active
items and 10,000 answers in the history. A change shown within about 100 ms
reads as instant.

- **Warm path** (an action appended, or an undo of the last action): record,
  refit and choose the next question in under 100 ms at p95 on the main thread.
  An undo of the last action restores the session's undo snapshot with no fit.
- **Cold build** (opening a list with no usable cached snapshot, or any change
  the warm path cannot take): replays the history in a Web Worker (or in
  main-thread slices where there is no worker), under 3 s on **realistic
  histories**, those whose placements are at most 1% of their events. Histories
  with more placements (the benchmark's 200-placement histories, 2%) are measured
  and reported, not gated. While a replay runs, the ranking screen shows a
  "Restoring your ranking…" state in place of the cards and the ranked list;
  nothing interactive is shown from a half-replayed state.
- **Cached snapshot:** the engine's fitted state, sealed with the view it showed,
  is cached per list in its own storage entry. It is checked against the history
  before use and is never part of the save or a session file. Opening from it is
  measured separately.

The budgets are checked by `scripts/bench-engine-browser.mjs` and
`scripts/bench-app.mjs`, and by the perf tests in `tests/unit/ranking/bt/`.

### 6.12 Progress strip and counts

The strip says only what is true:

- **Count:** "312 answers so far". It counts comparison activity: a pair answer
  and a draw are one answer each. "Don't recognize" marks, moves and removals
  are not answers. It is activity, not evidence.
- **Phase:** none. With one kind of question there is no phase to name.
- **Progress:** one line under the count, with a short bar. The bar is the share
  of items compared so far until every item has been compared, then fills in
  quarters to the level, with a tick between them; it stays full for a list
  that started ranked. It has two stages and says nothing else.
  - _Before every shown item has been in at least one answered pair:_ "Can't
    tell how close you are yet. 38 of 120 items haven't been compared." The
    bar shows the share compared. A move or a mark does not count as a comparison.
    This holds for every list. For unordered and rough starts of 30 items and
    more, no simulated list was accurate before every item had been compared,
    which takes about half an answer per item.
  - _After that,_ one of four levels: "Rough order so far.", "Taking shape.",
    "Close. Mostly fine adjustments left." and "Changes from here should be
    small." Never a number, and never "done", "settled" or "safe to stop". The
    level comes from `expectedDisorder` in `lib/ranking/bt/progress.ts`: the
    chance, over every pair, that the shown order has the pair the wrong way
    round, from the engine's strengths and uncertainties, summed over the pairs
    near each other in strength, with the few much more uncertain items (a
    placed one has a wide prior) compared against everything, and stopped once
    it is past the lowest level's boundary. It still costs milliseconds on a
    long list (about 9 ms for 1,000 items), so it is never part of an answer:
    each view carries the last value, and a fresh one is worked out when the page
    is idle, about every n/50 events, and shown once it has moved by 0.002. It
    rises at once
    and falls back only once the disorder is 10% past the boundary, so a level
    does not flicker. Lists under 26 items read the disorder in expected
    places out (the disorder times the list length), with the boundaries 1.0,
    0.4 and 0.25 places, because the 5% window there is a place or two. They
    also take each pair's chance from the answers themselves
    (`lib/ranking/bt/flips.ts`) rather than from the Gaussian the
    uncertainties describe: an item that has won or lost every answer has a
    wide strength, and the Gaussian reads that as doubt about its place. On a
    short list such items are a large share: a six-item list that had read
    "Taking shape" from its first nine answers to its 24th now reads the top
    level from its eleventh, until a three-way loop in the middle makes it
    "Taking shape" again, the loop alone. The chance follows the posterior
    along the pair's gap, with every other item held at its fitted strength,
    the two items moving in proportion to their uncertainties. Lists of 26
    items and more keep the Gaussian estimate, which reads the same at every
    size there (the exact chances did not), with the boundaries 0.07, 0.025
    and 0.02. Measured on unordered and rough starts of 26 items and more,
    the share of items within 5% of their true place averaged about 40%, 80%,
    96% and 99% at the four levels; under 26 items, the share within a place
    averaged about 53%, 87%, 97% and 99.6%. The two top levels held for rough
    starts that were loose or had reversed sections, which is what a list
    sorted by a field is, and the lower two ran lower there. The full tables
    are in `docs/engine-calibration.md`, "Progress levels".
  - _A list that started ranked_ gets no level, because the engine trusts a
    ranked start and a bad import (loose, or with reversed sections) read as
    "Close" while only 30 to 50% of items were near their place. After the
    first stage it says "Every item has been compared. Keep going to fix
    your order where answers disagree.", with the steps empty.
  - The line is a guide, not a promise: a user whose answers contradict
    themselves is still on average 4 to 10 points less accurate at the top
    levels than the clean users, so the wording stays modest. The line is
    outside the polite live region.
  - **Why?** A link after the line's words opens a window, "How close is this
    order?", that says why the line reads what it does, in terms of the
    user's own answers (`lib/state/progressExplain.ts`, drawn by
    `components/comparison/ProgressExplainerModal.tsx`). It is worked out only
    while the window is open, from the open session's fit
    (`EngineHost.shownEvidence`), with the same chance for each pair the
    level reads (`pairChances`), so it never says less is in doubt than the
    level shows. Each pair at 5% or more is put down to one cause, checked in
    this order: answered directly both ways; a circle (the counted answers
    lead from each item down to the other within three steps each way), drawn
    as a loop of up to four items; every direct answer a draw; an item placed
    by a move with fewer than two counted answers since; never compared
    directly, with the shortest chain of answers that orders them; or one
    clear direct answer. Only the 200 likeliest pairs are looked at for a
    cause, so a long list early on, with hundreds of thousands in doubt,
    still opens at once; the rest are counted. Circles are found first, and
    every pair that circles through one, or circles that share an item, are
    one spot. The three heaviest spots are shown, with what settles each, and
    a note when the next question is about one, then a count of the spots
    and pairs left out, each pair counted once. The top level shows only the
    spot with the likeliest pair, and only past 10%. Answers a move set
    aside are never cited, since they are not among the fit's terms. While
    items are still uncompared it names them instead. The words describe the
    answers, never the person: a circle is close calls, not a change of mind.

The app counts two things, and its copy uses only these two words for them:

- **Answers**, as above: shown in the strip and the list switcher.
- **Changes**: user actions, the same unit as undo steps (10.3). An answer, a
  mark, a move and a removal are one change each. Used wherever work is about to
  be lost: "Your 12 changes will be lost" means the 12 steps Undo would take
  back.

There is no progress meter, percentage, `n log2 n` target or "estimate met" note:
no estimator available to this design is honest (section 12).

## 7. Import and export

### 7.1 Reading what the user gives us

There is no interchange format. The app reads three shapes and keeps whichever
it was handed:

- a **plain list** - one item per line, with a leading bullet or number
  stripped only when whitespace follows it, so `-40 below zero` survives intact
- **YAML** - parsed to its value, verbatim
- **JSON** - parsed to its value, verbatim

Detection is a default, not a verdict. `sniffFormat` tries JSON, then YAML, and
falls back to a plain list; the paste page exposes a `Read as` override,
because valid YAML and an intended plain list genuinely overlap (`Alien: 1979`
on consecutive lines is both).

### 7.2 Finding the list to rank

`findArrayCandidates` walks **object properties only**, never descending into
array elements, to a depth of five. An array qualifies when its entries are
uniformly objects or uniformly scalars. Not descending into elements is what
keeps per-item fields like `movies[].tags` out of the candidate list.

Exactly one candidate is auto-selected. Mixed-type arrays are excluded with a
named reason. A one-entry array is still offered - it is the list the user
meant - and `describeReadiness` is the single place that blocks ranking, so
the user is told "a ranking needs at least two items" rather than "no list
found".

### 7.3 Field roles

Two roles, both derived from the selected array:

- **label field** - required for object entries, chosen automatically only when
  a full-coverage text field named `title`, `name`, or `label` exists, or when
  exactly one full-coverage text field exists at all
- **position field** - optional and opt-in, offered for any field numeric
  wherever it appears, preselected only when its name plainly means an ordering

No id or key field is ever requested: array position carries the rank.

### 7.4 The document as it stands

One function builds the document as it stands: the source document, deep-cloned,
with every list the user has opened written back at its own path in its current
ranked order. A list never opened keeps the order the document gives it. Export
comes from this function, so what the user sees is exactly what they would
download.

- Every sibling key, at every depth, and every field the app never understood,
  survives exactly as it arrived.
- Each list's position field, if it has one, is rewritten in place with 1..N,
  keeping its position among the object's keys; a new one is appended.
- Removed items are left out, and the rail says how many. Items marked "don't
  recognize" are kept, after the ranked ones.
- Export offers only formats the source can honestly produce: YAML and JSON
  always, plus a plain-list rendering when the source was a plain list.

## 8. Client architecture

### 8.1 Main modules

- `lib/import/`: format sniffing, plain-list parsing, array discovery, field
  roles and readiness
- `lib/export/`: the document as it stands, serialization, and download
  filenames
- `lib/ranking/bt/`: the engine (evidence, membership, priors, solver, tie
  order, picker, replay, snapshots)
- `lib/engine/`: the engine host for the open list (warm path, cold builds, the
  snapshot cache)
- `lib/state/`: the Zustand store, one action per user action, the undo stack,
  placements, and selectors
- `lib/persistence/`: stored shapes and the localStorage adapter
- `lib/session/`: session files
- `lib/renderers/`, `lib/preview/`: field renderers and audio previews
- `lib/hooks/`: the setup draft, shortcuts, theme and layout hooks
- `components/data/`: the source input and the found panel's pickers
- `components/comparison/`: the pair deck and cards
- `components/preview/`: the ranked list and the export tabs
- `components/layout/`, `components/ui/`: the shell, guide and shared controls

### 8.2 State boundaries

Saved in the browser:

- the document, every opened list's setup, items and history
- the last action and, when it changed the document, the document before it
- the preview tab

In memory only:

- the undo stack beyond the last action
- the engine's live session and checkpoints (the snapshot cache is separate and
  disposable)
- the paste and setup drafts, expanded details, armed confirmations

### 8.3 Persistence strategy

The browser copy is not one blob. The adapter keeps a small manifest (the
setup of each list, the preview tab, the last action, and the names of the
pieces) and the pieces it names: the source document, the previous document
when the last action needs one, each list's items, and each list's history in
runs of 256 events. A save writes only the pieces that changed (an answer
rewrites the last run of the history) and then the manifest, which is what
commits it, so a save that fails part way leaves the previous one readable. A
load refuses the whole workspace when any piece is missing, cut short, or not
what it should be. Session files stay one JSON document.

Rules that keep that sound with more than one tab open and a full quota:

- A save reads the manifest again just before committing. If another tab has
  committed since the save began, it starts over and writes every piece new, so
  it does not name a piece the other tab replaced. The re-read and the write of
  the manifest are two storage calls, so a gap remains in which another tab's
  commit is overwritten whole: last writer wins, as with one key, and the pieces
  that commit replaced survive for the ten seconds below, so the workspace
  stays loadable.
- The pieces a save replaces stay for ten seconds, and are removed at a later
  save only if the manifest in storage does not name them. A tab that read the
  manifest just before another tab's commit therefore still finds its pieces.
  Pieces no manifest names, such as those a crash left, are removed by a load
  once they are a minute old.
- A load that finds a piece missing while the manifest has changed reads the new
  manifest, up to twice more, instead of starting empty.
- A save writes new pieces before removing old ones, so one that replaces most of
  a workspace (a new document) needs room for old and new
  together. When the storage is full it first removes the replaced pieces it was
  keeping for the ten seconds and tries again, which skips the ten seconds (it
  removes them at once, still sparing any the stored manifest names); if that is
  not enough it keeps the old pieces' text in memory, removes them, writes the
  new save, and puts the old text back if that fails. That last step does not
  re-read the manifest before writing it, so against another tab it is last
  writer wins with no check. In that last case only (a full quota and a save
  that replaces most of the workspace), the manifest in storage names missing
  pieces until the new one is written, so a crash or another tab loading in
  that moment finds no workspace. With the quota to itself the largest save
  that fits is `MAX_SNAPSHOT_BYTES` (4,000,000 characters) either way. By
  arithmetic on a 5 MB quota (not measured), the ordinary path holds up to
  about half of that for a save that replaces everything.

A tab keeps its own copy in memory, so one that sat open while another tab saved
would show, and then save over, an old workspace. The browser reports the other
tab's manifest write (and a clear) to every other tab, hidden ones included.
What the tab does depends on whether it is in front:

- Hidden: it has already written any save still waiting, so it only notes the
  change. When the tab is shown again it takes the saved copy before any click
  can reach the old one, and says "Updated from another tab" for a few seconds.
- In front: it leaves the screen alone and asks. Reload takes the saved copy,
  dropping a save still waiting on its delay. Keep this tab's version writes
  this tab's copy at once, over the other tab's.

Taking the saved copy goes through the engine host as any change to the open
list does: an answer or two added by the other tab is a warm append, anything
else opens from a cached snapshot or a cold build, as a reload does. A saved
copy that cannot be read (another tab part way through a commit) leaves the
tab's own copy as it is. This makes a stale tab visible; it does not close the
gap above.

Persistence safety rules:

- never overwrite the live workspace because a pasted-text draft is invalid
- version saves and session files, and reject any other version
- fail safely when reading malformed saved data
- provide a visible clear/reset action

## 9. Static deployment model

### 9.1 Hosting shape

- static Expo web bundle
- served by nginx, caddy, or another static file server
- optional single-service Docker Compose stack purely as a hosting wrapper

### 9.2 Docker option

A Compose file is still fine for easy deployment, and it is tiny: a `web`
service only, no API, no database.

### 9.3 User expectations

Users should understand:

- their data lives in the browser while they work
- exported files and session files are how they keep or move their work
- clearing browser storage may remove the saved workspace

## 10. UI-specific technical behaviour

### 10.1 Persistent preview pane

The preview pane reads the engine host's view, so it updates immediately after
an answer, a mark, a move, a removal, an undo, and
a label or position field change. While a cold build runs it shows "Restoring
your ranking…" and accepts no move.

Rows show rank only, no rating. Each ranked row can be moved (a drag, or `Alt`
with the arrow keys, `Home` and `End`) and removed, with the same confirmation
and event as a card's remove control. A move shows the line where the row will
go, and the item then shows exactly between the two rows it was put between;
other rows may shift slightly (6.8).

Items marked "don't recognize" sit at the bottom under a quiet divider labelled
"Didn't recognize", in the order marked, with their rank numbers continuing after
the counted items. They can be dragged up into the ranked part (a placement), or
moved there by keyboard: `Alt`+`Up` puts the item last in the ranking,
`Alt`+`Home` first, and `Alt`+`Down` and `Alt`+`End` do nothing. They cannot be
reordered among themselves, and nothing can be dropped into that section: the
drop zone ends at the divider, and a drop at or below it records nothing.
Marking happens only through "Don't recognize…".

### 10.2 Screens and list setup

Three routes. `/` is only the paste page: the text box, samples, file drop, the
format override and parse errors, with a `Continue` that opens setup once the
text parses into a rankable list. `/setup` is one screen for a new list (loaded
from the in-memory paste draft) and for an existing one; `/rank` is the
ranking. The gear on the `Your data` panel (label `List setup`), or
`Configure` in the list switcher, opens setup for the list being ranked.

Rules:

- for an existing list the document is shown as stored, the starting order is
  read-only (it was fixed when the list was created), and the field choices and
  the list switcher are live. A field change is saved as a list setting: no
  event and no undo step, since it changes how cards look and not the ranking
- for a list in the same document that has never been opened, the starting
  order picker is editable, since that list is created when it is saved
- picking a never-opened list in the switcher takes the document's defaults and
  switches at once. The title field is the exception: when the list lacks the
  default title field it is a different kind of list, and the switcher opens
  setup for it instead. The other default fields are optional and are left off a
  list that lacks them. Saving in setup marks the list set up by hand only if
  something differs from what the defaults give
- picking a never-opened list in the switcher takes the document's defaults and
  switches at once, unless the list lacks any field the defaults name (title,
  card fields, position): it is then a different kind of list, and the switcher
  opens setup for it instead. Saving there marks the list set up by hand only if
  something differs from what the defaults give
- the order picker's fourth choice, **Sort by a field** (section 6.4), shows a
  field select (only fields that qualify) and a direction. The list stores
  `initialSort` for a read-only line ("Sorted by plays, high to low. Set when this
  list was created."), and the export writes the current ranking
- there is no text editor and nothing adds an item to a list being ranked. `Start
over`, on the ranking screen, returns to the paste page; to rank a grown list,
  start again from its export, whose order is a good starting point
- the paste draft is in memory only: a reload during setup of a new list returns
  to the paste page, while with a workspace a reload at `/setup` reopens setup
  for the open list

### 10.3 Undo

One step per user action, of any kind: a pair answer, a draw, a "don't
recognize", a move, a removal. Events carry their action's id, so a step is the
event with that id (each action records one event). One stack serves the whole workspace and survives
switching lists. Undo is offered only when the top step changed the open list;
otherwise the control names the list it belongs to. After a reload or opening a
session file, the last action is offered back (the workspace records which action
was last); steps further back are in memory only and are gone. Up to 200 steps
are kept.

### 10.4 The pair screen

The pair screen is the only comparison screen. Below the two cards sits a single
split pill, **Can't decide | Don't recognize…**, centred, because it belongs to
the pair and not to either item. The ellipsis says the second half asks a
follow-up.

- **Can't decide** records a draw. Keyboard: `S`.
- **Don't recognize…** arms a choice in place; nothing pops in. Both cards
  highlight, their caption changes to "DON'T RECOGNIZE THIS ONE", and their
  "Much better" buttons step aside. The pill becomes "Don't recognize either |
  Cancel". Clicking a card marks that item; "Don't recognize either" marks both;
  Cancel or `Esc` returns to normal. Keyboard: `K`, then `L`, `R` or `B`; `Esc`
  cancels, and the hint line reads "K then L, R or B: don't recognize" while
  armed. Pressing the pill never acts on its own, so a user who reads it as
  "both" sees the choice and picks "either".
- **The pill holds still when armed.** Each half keeps the width of the widest
  label it can show, so nothing moves under the pointer: "Cancel" takes the place
  of "Don't recognize…", and a second click where the first was cancels rather
  than marking both.
- Remove (the trash can) stays on each card. The ranked list's rows have the same
  control, and both record the same removal (6.2).

### 10.5 Object drill-in

Comparison cards display:

- primary label from `roles.labelField`
- optional summary lines for secondary fields, each drawn as plain text or by a
  renderer
- one picture slot and one play button. Each renderer belongs to a slot
  (its `slot` in `lib/renderers/registry.ts`): picture renderers (image, image gallery,
  YouTube, Steam header) all feed one gallery in field order, and play-button
  renderers (Apple Music, Deezer) form a fallback chain, each catalogue asked
  only once the one before it has no clip. Deezer sends no CORS headers, so the
  browser reads it as JSONP (`lib/preview/deezerPreview.ts`)
- an expandable detail region rendering remaining fields recursively

## 11. Testing strategy

Unit tests:

- the fit, evidence weights and the eligibility rule
- placements, priors and the tie order
- the warm path, undo snapshot, checkpoints and persisted snapshots against a
  fresh replay, over hundreds of simulated histories (the property test)
- one action, one implementation: each route of an action records the same
  events
- undo of every kind of action, and after a reload
- format sniffing, including the YAML-vs-plain-list overlap
- plain-list marker stripping, including the `-40 below zero` non-strip
- array discovery: nesting, depth cap, mixed-type rejection, no descent into
  array elements
- label and position field detection
- the document as it stands: wrapper keys survive, every opened list ranked,
  unopened lists untouched, position rewritten in place, removed items excluded
- the storage protocol, including two tabs and a full quota
- the simulation's release gates, and the progress levels: a replay of 60-item
  lists that fails if a level claims more accuracy than the simulation measured
  for it
- the fit on known small cases; uniqueness (the same evidence in any order gives
  the same strengths within tolerance); convergence quality (solving far past the
  stopping test changes neither the displayed order nor the next question)
- strength bands and tied placement: three items pairwise within `1e-6` that span
  a grid line never reorder the two in different bands; a move into a tied region
  shows exactly between its neighbours for each case of the splice rule (6.6)
- arrival sequence: shuffling the items array changes neither the displayed order
  nor the next question; a removal after a placement does not change how that
  placement replays
- the picker is deterministic and never offers the previous pair

Integration tests:

- paste page -> setup: choose array, label, position -> start ranking
- the gear -> setup of an existing list: starting order read-only, field changes saved
- reload restores the workspace, source document and last undo step included
- corrupt or newer-version snapshots start clean
- a cold build shows "Restoring" and accepts nothing until it finishes

End-to-end tests:

- rank a plain list and export it
- rank one array inside a larger document; the rest survives export
- reload and resume, then start over
- open list setup mid-run and keep the answers

**Release gates** (`tests/unit/sim/gates.test.ts`, `tests/sim/`), all on the real
engine:

- a 400-item list with a typical user reaches 90% of items within 5% of their
  true place within `6n` pair answers (measured 3.57n)
- the placement test in 6.8 step 11, after a further `8n` answers
- the speed budgets in 6.11 on the benchmark corpus, with no solve missing its
  stopping test

The simulation is `tests/sim/`; its users are careful, typical, fuzzy and sloppy,
plus users who use "Much better" often, rarely or inconsistently, lists with true
ties, clusters and gaps, bad "Ranked" imports and reversed sections, users who
move items wrongly and then correct, and lists with many "don't recognize"
items. It measures, at every quarter of `n` answers, mean, median and
worst-decile displacement, the share within 5% and within 1%, Kendall pair
accuracy, and the accuracy of the top 20.

## 12. Future extension paths

- measured confidence from check questions (below)
- optional share-by-file workflow beyond session files
- list templates
- optional encrypted local snapshots

### Measured confidence (not built)

The engine leaves room for it. About one answer in ten would be a check
question, a pair at a chosen separation in the current order, and agreement
between the user's answers and the current order, by separation band, would be
an observable statement about this list.

It is not a measurement of truth. It measures agreement between the user and the
inferred order on sampled pairs, and depends on which pairs are sampled, on the
order choosing what counts as "10 places apart", on whether a pair was learned
from earlier answers, and on true ties. Copy must say what was observed ("In
recent check comparisons, you agreed with this ordering 9 times out of 10 for
items about 10 places apart"), never a global claim such as "the whole list is
accurate within 10 places". Open questions: whether check answers are held out
of the fit and never asked about a recently shown pair; separation bands;
confidence intervals, so 10 out of 10 on ten checks does not produce a strong
statement; keeping checks sparse; and whether they improve the ranking enough not
to be a pure cost. The release gate would be that every statement matches
held-out simulated truth across user models, list sizes, starting orders and
placements, with local per-band statements only if global estimates stay
unreliable.

Why nothing like it exists today: the analytic estimate was wrong by a factor of
2 to 10, and the share of answers that disagree with the current order sits at 35
to 50% from the first answer to the last, because the picker always asks close
calls.

### Decisions

- **Pairs only.** The app asks one kind of question. A group answer's effort is hard
  to measure and a pair is nearly effortless, so counting answers (where five-card
  sorts looked better) was the wrong measure. The grouped engine's calibration
  stays in `docs/engine-calibration.md` as history, and the live record is its
  "Pairs-only baseline" section.
- **Placement width and horizon.** `PLACEMENT_SD_FRACTION` = 0.1, tested after a
  further 8n answers. The CI floors in `tests/unit/sim/gates.test.ts` are the
  12-seed shares less 0.1: near 0.9, far 0.55. See "Placement re-check under pairs
  only" in `docs/engine-calibration.md`.
- **Reaching a good ranking faster is closed for now.** Levers that were discussed
  and not chosen, kept as ideas: a top-heavy accuracy target (it would change what
  the app promises), faster answering, a signal that says when to stop (the
  progress levels, 6.12, say how close the order is and stop short of that),
  measuring time per answer (every event stores `createdAt`), and other priors
  such as a first tier pass.

## 13. Implementation guardrails

Things that would make the engine a failure even if it technically worked:

- **False reassurance.** Any sentence or visual that implies the list is
  accurate, nearly done or safe to stop, when nothing has measured that. If a
  sentence cannot be validated against the simulation, it does not appear: each
  progress level is held to the accuracy its wording claims by
  `tests/unit/sim/progressGate.test.ts`, and a list the levels were not measured
  on (one that started ranked) gets no level and says why.
- **The app arguing with the user.** An item moved to 30th drifting back toward
  500th over the next few answers.
- **The engine confirming itself.** Gaining confidence because the user pressed
  Done on an order the engine proposed.
- **A second source of truth.** The ranking stays a pure function of the list's
  items and its event history: no stored ratings, no hidden state a replay cannot
  rebuild, no setting that changes the ranking outside the history.
- **Two routes to one action** behaving differently (6.2).
- **A "Pairwise" app that feels like it stopped being pairwise.** Pairs are the
  only question, and that is deliberate.

Also:

- preserve the user's document exactly; never normalise it into a shape of ours
- keep the ranking derivable from the event history, with no setting outside it
- one user action, one implementation, whatever the route
- let the user say how their text should be read when detection is ambiguous
- keep the ranked view gorgeous and useful, but export the source document
- keep the app fully useful without any server dependency
