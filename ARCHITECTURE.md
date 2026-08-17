# Pairwise List Ranker Architecture

## 1. Technical goals

Build a static web application that:
- stores working state entirely in the browser
- reranks items deterministically from pairwise decisions
- supports both primitive and object-shaped items
- gives the user their own document back, with the ranked array reordered in place
- can be hosted as static files with no backend dependency

## 2. Non-goals for v1

- user accounts
- shared lists or personal reranking copies
- collaborative real-time editing
- server-side persistence
- an app-defined document format of any kind
- configurable ranking algorithms in the UI

## 3. Stack choice

Frontend:
- Expo with TypeScript
- Expo Router
- React Native Web
- Zustand for local workspace state
- Zod for schema validation
- `yaml` package for YAML parsing/serialization
- `idb-keyval` or `localForage` for optional browser persistence

Testing:
- Vitest for unit tests
- React Testing Library for component/integration tests
- Playwright for web end-to-end tests

Deployment:
- static build output
- optional single-container Docker image for serving built files
- optional one-service Docker Compose stack for hosting convenience

## 4. Architecture direction: static browser-only app

The app should run entirely in the browser.

That means:
- no backend API
- no database
- no authentication
- no server-managed sharing

Why this is a strong fit:
- the user’s primary workflow is import -> compare -> export
- the ranking engine is deterministic and purely client-side
- the imported item payloads are already JSON-like and easy to keep in browser state
- cutting sharing removes nearly all of the hard distributed-state and permissions complexity
- deployment becomes radically simpler: build static files, serve static files, go outside and enjoy the weather or at least stare at it resentfully

## 5. Data model

### 5.1 Client types

The user's own parsed document is the model. The app stores it verbatim and
annotates it: which array inside it is being ranked, and which fields play a
role. Nothing is normalised, renamed, or dropped on the way in.

```ts
type SourceFormat = 'list' | 'yaml' | 'json';
type PreviewTab = 'ranked' | SourceFormat;

interface DataSource {
  format: SourceFormat;   // how it parsed; also the default export format
  rawText: string;        // exactly what the user gave us
  document: unknown;      // the parsed value, verbatim; string[] for 'list'
  arrayPath: string[];    // path to the ranked array; [] when the document is it
}

interface FieldRoles {
  labelField?: string;    // object entries only: what titles each card
  positionField?: string; // optional: rewritten with 1..N on export
}

interface Workspace {
  id: string;
  name: string;           // app-local only; never written into the document
  source: DataSource;
  roles: FieldRoles;
  createdAt: string;
  updatedAt: string;
}

interface ListItem {
  id: string;
  listId: string;
  value: ItemValue;       // one entry of the ranked array, as imported
  active: boolean;        // deleted items leave the pool but stay in history
  createdAt: string;
  updatedAt: string;
}

interface RankingState {
  itemId: string;
  rating: number;
  comparisons: number;
  wins: number;
  losses: number;
  skips: number;
  lastComparedAt?: string;
}

interface ComparisonEvent {
  id: string;
  listId: string;
  leftItemId: string;
  rightItemId: string;
  outcome: ComparisonOutcome;
  createdAt: string;
}

interface WorkspaceSnapshot {
  version: 2;
  workspace: Workspace;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  ui: { previewTab: PreviewTab };
}
```

There is deliberately no app-defined document schema. A `kind` discriminator,
a required title, and a canonical item wrapper were all removed: they forced
the user's data into a shape the app had invented.

### 5.2 Persistence model

There is no server database in v1.

Persistent state is optional and browser-local only.

Recommended persistence layers:
- in-memory Zustand store for live interaction
- localStorage or IndexedDB for optional draft persistence and reload recovery
- exported YAML/JSON/plain text as the durable user-controlled backup path

Important rule:
- browser persistence is a convenience, not the system of record
- exported files are the user’s durable portable artifact

## 6. Ranking design

### 6.1 Algorithm choice

Use weighted Elo for v1.

Why:
- simple to implement and test
- deterministic
- intuitive enough for pairwise preference ranking
- allows weighted outcomes for “much better” selections
- easy to recompute from append-only comparison history

### 6.2 Rating rules

Defaults:
- initial rating: `1500`
- normal K-factor: `24`
- strong-win multiplier: `1.75`
- optional low-comparison bonus: slightly higher K-factor for early rounds

Outcome mapping:
- `left`: left score `1`, right score `0`
- `right`: left score `0`, right score `1`
- `left_strong`: same winner as left, but K-factor multiplied
- `right_strong`: same winner as right, but K-factor multiplied
- `skip`: no rating change

Deletion during comparison:
- deleting either item removes that item from the active pool
- no Elo update is recorded for that pair
- the UI advances to a fresh pair

### 6.3 Pair selection

Use a heuristic score combining:
- rating proximity: compare neighbors and near-neighbors often
- low exposure: prioritize items with fewer total comparisons
- recency cooldown: avoid repeating the exact same pair too soon
- uncertainty proxy: prefer items whose rating is still volatile

### 6.4 Deterministic ranking rebuild

The displayed ranking is a derived view built from:
1. active items
2. comparison history in timestamp order
3. rating recomputation
4. stable tiebreakers

Recommended tie order:
1. higher rating
2. head-to-head result if available
3. more wins
4. the order the items arrived in

The last one matters more than it looks. Every item of one import is created in
the same millisecond, so a timestamp cannot separate them, and falling back to
the item id would display an unranked list in random UUID order. The position
in the items array is the user's own order, and it is what an unranked list
shows.

### 6.5 Manual ordering

Dragging a row does not override the derived ranking. It rewrites the source
document's array into the dragged order and re-imports it through
`startRanking`, so the ranking stays a pure derivation of comparison history
and there is never a second source of truth for order.

Because that clears the comparison history, it is confirmed whenever there are
rated comparisons to lose. With none, it applies silently, which is what makes
arranging several rows in a row bearable. Items removed during comparison are
not carried into the new session.

## 7. Import/export design

### 7.1 Reading what the user gives us

There is no interchange format. The app reads three shapes and keeps whichever
it was handed:

- a **plain list** — one item per line, with a leading bullet or number
  stripped only when whitespace follows it, so `-40 below zero` survives intact
- **YAML** — parsed to its value, verbatim
- **JSON** — parsed to its value, verbatim

Detection is a default, not a verdict. `sniffFormat` tries JSON, then YAML, and
falls back to a plain list; the data screen exposes a `Read as` override,
because valid YAML and an intended plain list genuinely overlap (`Alien: 1979`
on consecutive lines is both).

### 7.2 Finding the list to rank

`findArrayCandidates` walks **object properties only**, never descending into
array elements, to a depth of five. An array qualifies when its entries are
uniformly objects or uniformly scalars. Not descending into elements is what
keeps per-item fields like `movies[].tags` out of the candidate list.

Exactly one candidate is auto-selected. Mixed-type arrays are excluded with a
named reason. A one-entry array is still offered — it is the list the user
meant — and `describeReadiness` is the single place that blocks ranking, so
the user is told "a ranking needs at least two items" rather than "no list
found".

### 7.3 Field roles

Two roles, both derived from the selected array:

- **label field** — required for object entries, chosen automatically only when
  a full-coverage text field named `title`, `name`, or `label` exists, or when
  exactly one full-coverage text field exists at all
- **position field** — optional and opt-in, offered for any field numeric
  wherever it appears, preselected only when its name plainly means an ordering

No id or key field is ever requested: array position carries the rank.

### 7.4 Export

`buildExport` deep-clones the source document, writes the reordered entries
back at `arrayPath`, and serializes. Every sibling key, at every depth, and
every field the app never understood, survives exactly as it arrived. An
existing position field is rewritten in place, keeping its position among the
object's keys; a new one is appended. Items deleted during comparison are
excluded, and the rail says how many.

Export offers only formats the source can honestly produce: YAML and JSON
always, plus a plain-list rendering when the source was a plain list.

## 8. Client architecture

### 8.1 Main modules

- `lib/import/`: format sniffing, plain-list parsing, array discovery, field
  roles, readiness, and the re-import diff
- `lib/export/`: clone-splice-serialize, and download filenames
- `lib/ranking/`: Elo updates, pair scoring, ranking rebuild
- `lib/state/`: Zustand store and selectors
- `lib/persistence/`: the v2 snapshot schema and the localStorage adapter
- `lib/hooks/useSourceDraft`: the data screen's form state
- `components/data/`: the source input and the found panel's pickers
- `components/comparison/`: pairwise UI
- `components/rank/`: the rank screen's rail
- `components/preview/`: ranked view and read-only export tabs

### 8.2 State boundaries

Persistent browser-local state:
- list metadata
- list items
- comparison history
- preview mode
- editor drafts

Ephemeral UI state:
- expanded drill-in sections
- active pair selection state
- transient toasts and confirmations

### 8.3 Persistence strategy

Recommended approach:
- authoritative live state in a local Zustand store
- optional snapshot persistence in localStorage or IndexedDB
- explicit export to YAML/JSON/plain text for portability and backup

Persistence safety rules:
- never overwrite the current live workspace just because a text editor draft is invalid
- version persisted workspace snapshots
- fail safely when reading malformed saved data
- provide a visible clear/reset action

## 9. Static deployment model

### 9.1 Hosting shape

Recommended deployment shape:
- static Expo web bundle
- served by nginx, caddy, or another static file server
- optional single-service Docker Compose stack purely as a hosting wrapper

### 9.2 Docker option

A Compose file is still fine if you want easy deployment, but it becomes tiny:
- `web` service only
- no API
- no database

### 9.3 User expectations

Users should understand:
- their data lives in the browser while they work
- exported files are how they keep or move their ranked list
- clearing browser storage may remove saved local workspace state

## 10. UI-specific technical behavior

### 10.1 Persistent preview pane

The preview pane should subscribe to derived ranking selectors so it updates immediately after:
- comparison result
- skip
- delete
- add item
- import apply
- label or position field change

### 10.2 Editing data

The preview rail is read-only. Editing goes back to the data screen, where the
current text is prefilled and re-importing is an explicit act.

Rules:
- typing never mutates the live list; parse errors stay local to the text
- applying edits shows a summary first: how many entries are unchanged, added,
  and removed, and how many comparisons survive
- entries matched by deep value equality keep their item id, and therefore
  their rating and history; absent entries are deactivated, not deleted

### 10.3 Object drill-in

Comparison cards display:
- primary label from `roles.labelField`
- optional summary chips for 1-3 secondary fields
- expandable detail region rendering remaining fields recursively

## 11. Testing strategy

Unit tests:
- Elo math
- strong-win weighting
- skip behavior
- delete-without-rerank behavior
- pair selection heuristics
- format sniffing, including the YAML-vs-plain-list overlap
- plain-list marker stripping, including the `-40 below zero` non-strip
- array discovery: nesting, depth cap, mixed-type rejection, no descent into
  array elements
- label and position field detection
- source-preserving export: wrapper keys survive, position rewritten in place,
  inactive items excluded
- the re-import diff, including duplicates matched by position
- snapshot persistence, including dropping version 1

Integration tests:
- data screen -> choose array, label, position -> start ranking
- edit data -> apply -> ratings preserved for unchanged entries
- reload restores the workspace, source document included
- corrupt or newer-version snapshots start clean

End-to-end tests:
- rank a plain list and export it
- rank one array inside a larger document; the rest survives export
- reload and resume, then start over
- edit data mid-run and keep the rankings

## 12. Future extension paths

Potential later additions:
- optional share-by-file workflow instead of server-backed sharing
- algorithm alternatives like Bradley-Terry or TrueSkill
- analytics on confidence/convergence
- list templates
- optional encrypted local snapshots

## 13. Implementation guardrails

- preserve the user's document exactly; never normalise it into a shape of ours
- keep ranking derivable from event history
- let the user say how their text should be read when detection is ambiguous
- keep the ranked view gorgeous and useful, but export the source document
- keep the app fully useful without any server dependency
