# Pairwise List Ranker Architecture

## 1. Technical goals

Build a static web application that:
- stores working state entirely in the browser
- reranks items deterministically from pairwise decisions
- supports both primitive and object-shaped items
- supports round-trip import/export through JSON, YAML, and app-defined Markdown
- can be hosted as static files with no backend dependency

## 2. Non-goals for v1

- user accounts
- shared lists or personal reranking copies
- collaborative real-time editing
- server-side persistence
- arbitrary third-party Markdown import compatibility
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

### 5.1 Canonical client types

```ts
type PrimitiveItemValue = string;

type ComplexItemValue = Record<string, unknown>;

type ItemValue = PrimitiveItemValue | ComplexItemValue;

type ListKind = 'primitive' | 'object';
type ExportFormat = 'gui' | 'yaml' | 'json' | 'markdown';
type ComparisonOutcome = 'left' | 'right' | 'left_strong' | 'right_strong' | 'skip';

interface WorkspaceList {
  id: string;
  title: string;
  description?: string;
  kind: ListKind;
  sortField?: string;
  createdAt: string;
  updatedAt: string;
}

interface ListItem {
  id: string;
  listId: string;
  value: ItemValue;
  active: boolean;
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
  version: number;
  list: WorkspaceList;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  ui: {
    previewMode: ExportFormat;
    editorDrafts: Partial<Record<'yaml' | 'json' | 'markdown', string>>;
  };
}
```

### 5.2 Persistence model

There is no server database in v1.

Persistent state is optional and browser-local only.

Recommended persistence layers:
- in-memory Zustand store for live interaction
- localStorage or IndexedDB for optional draft persistence and reload recovery
- exported YAML/JSON/Markdown as the durable user-controlled backup path

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
4. earlier creation order

## 7. Import/export design

### 7.1 Canonical interchange shape

JSON is the canonical interchange model. YAML and Markdown import/export map to and from this shape.

```json
{
  "version": 1,
  "title": "Favorite sci-fi films",
  "description": "Personal ranking list",
  "kind": "object",
  "sortField": "title",
  "items": [
    { "id": "item-1", "value": { "title": "Arrival", "year": 2016, "director": "Denis Villeneuve" } },
    { "id": "item-2", "value": { "title": "Alien", "year": 1979, "director": "Ridley Scott" } }
  ]
}
```

### 7.2 Simple list handling

Simple list import accepts:
- JSON array of strings
- YAML sequence of strings
- Markdown bullet list

Internal representation normalizes to item objects with IDs.

### 7.3 Complex object handling

Complex object import accepts:
- JSON object using canonical app schema
- YAML object using canonical app schema
- app-defined Markdown dialect

Sort field rules:
- if there is a single obvious scalar string field such as `name` or `title`, preselect it
- otherwise require the user to choose before ranking begins
- preserve all object fields during exports, not just the chosen display field

### 7.4 Markdown dialect

Use a strict app-defined dialect for round-trippable complex-object exports.

Example:

```md
# Favorite sci-fi films

Kind: object
Sort field: title

## Arrival

```yaml
title: Arrival
year: 2016
director: Denis Villeneuve
```

## Alien

```yaml
title: Alien
year: 1979
director: Ridley Scott
```
```

For primitive lists, export as a clean bullet list under the document title.

Important product rule:
- GUI preview is not exportable
- only YAML, JSON, and Markdown generate copy/download output

## 8. Client architecture

### 8.1 Main modules

- `lib/validation/`: import schemas and data guards
- `lib/formats/`: JSON/YAML/Markdown parse + serialize
- `lib/ranking/`: Elo updates, pair scoring, ranking rebuild
- `lib/state/`: Zustand store and selectors
- `lib/persistence/`: localStorage or IndexedDB adapters
- `components/comparison/`: pairwise UI
- `components/preview/`: GUI preview and text preview modes
- `components/editor/`: editable text modes and import actions

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
- explicit export to YAML/JSON/Markdown for portability and backup

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
- sort-field change

### 10.2 Editable text modes

YAML/JSON/Markdown modes need a decoupled text buffer.

Rules:
- typing in the editor does not mutate the live list until the user clicks import/apply
- parse errors remain local to the editor buffer
- successful import replaces the live working list state

### 10.3 Object drill-in

Comparison cards display:
- primary label from `sortField`
- optional summary chips for 1-3 secondary fields
- expandable detail region rendering remaining fields recursively

## 11. Testing strategy

Unit tests:
- Elo math
- strong-win weighting
- skip behavior
- delete-without-rerank behavior
- pair selection heuristics
- JSON/YAML/Markdown round-trip
- sort-field detection
- snapshot persistence serialization

Integration tests:
- import object list -> choose sort field -> compare -> export
- editor buffer parse errors do not destroy live list state
- reload restores persisted workspace when enabled
- reset clears local workspace cleanly

End-to-end tests:
- create list from YAML
- perform several comparisons
- switch preview formats
- copy/download export
- reload and recover local state
- clear workspace and start fresh

## 12. Future extension paths

Potential later additions:
- optional share-by-file workflow instead of server-backed sharing
- algorithm alternatives like Bradley-Terry or TrueSkill
- analytics on confidence/convergence
- list templates
- optional encrypted local snapshots

## 13. Implementation guardrails

- preserve canonical data shape across all formats
- keep ranking derivable from event history
- treat Markdown import as strict dialect support, not free-form Markdown fantasy
- keep GUI preview gorgeous and useful, but never export it
- keep the app fully useful without any server dependency
