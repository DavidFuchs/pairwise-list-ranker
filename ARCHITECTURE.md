# Pairwise List Ranker Architecture

## 1. Technical goals

Build a web-first Expo application that:
- stores structured lists and comparison history safely
- reranks items deterministically from pairwise decisions
- supports both primitive and object-shaped items
- provides owner-controlled sharing through personal editable copies
- supports round-trip import/export through JSON, YAML, and app-defined Markdown

## 2. Non-goals for v1

- collaborative real-time editing on the same list
- arbitrary third-party Markdown import compatibility
- merge-back from recipient copies into the owner master list
- configurable ranking algorithms in the UI

## 3. Stack choice

Frontend:
- Expo with TypeScript
- Expo Router
- React Native Web
- Zustand for local workspace state
- TanStack Query for server data fetching/caching
- Zod for schema validation
- `yaml` package for YAML parsing/serialization

Backend:
- Supabase Postgres
- Supabase Auth
- Supabase Row Level Security
- Supabase Storage only if attachments or future assets are added

Testing:
- Vitest for unit tests
- React Testing Library for component/integration tests
- Playwright for web end-to-end tests

## 4. Why Supabase

The app needs authenticated ownership, shareable personal copies, and strict separation between master lists and recipient copies. Supabase is a pragmatic fit because it provides:
- authentication
- relational data modeling
- row-level security
- simple linkable share-token workflows
- a straightforward TypeScript client story

## 5. Data model

### 5.1 Canonical client types

```ts
type PrimitiveItemValue = string;

type ComplexItemValue = Record<string, unknown>;

type ItemValue = PrimitiveItemValue | ComplexItemValue;

type ListKind = 'primitive' | 'object';
type ExportFormat = 'gui' | 'yaml' | 'json' | 'markdown';
type ComparisonOutcome = 'left' | 'right' | 'left_strong' | 'right_strong' | 'skip';

interface ListDefinition {
  id: string;
  ownerUserId: string;
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
  sourceItemId?: string | null;
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
  actorUserId: string;
  createdAt: string;
}

interface ShareLink {
  id: string;
  ownerListId: string;
  token: string;
  allowRecipientEdits: boolean;
  createdByUserId: string;
  createdAt: string;
}

interface SharedCopy {
  id: string;
  shareLinkId: string;
  sourceListId: string;
  recipientUserId: string;
  title: string;
  description?: string;
  kind: ListKind;
  sortField?: string;
  allowEdits: boolean;
  createdAt: string;
  updatedAt: string;
}
```

### 5.2 Database tables

Recommended tables:
- `lists`
- `list_items`
- `comparison_events`
- `share_links`
- `shared_copies`
- `shared_copy_items`
- `shared_copy_comparison_events`

Important rule:
- the owner master list and recipient copy are different records with different item rows and different comparison histories
- recipient operations never mutate `lists` or `list_items`

## 6. Ranking design

## 6.1 Algorithm choice

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

Do not pick pairs randomly forever. Use a heuristic score combining:
- rating proximity: compare neighbors and near-neighbors often
- low exposure: prioritize items with fewer total comparisons
- recency cooldown: avoid repeating the exact same pair too soon
- uncertainty proxy: prefer items whose rating is still volatile

This keeps the experience from feeling both repetitive and useless, which is a remarkable trick many ranking interfaces fail to pull off.

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

## 7.1 Canonical interchange shape

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

## 7.2 Simple list handling

Simple list import accepts:
- JSON array of strings
- YAML sequence of strings
- Markdown bullet list

Internal representation still normalizes to item objects with IDs.

## 7.3 Complex object handling

Complex object import accepts:
- JSON object using canonical app schema
- YAML object using canonical app schema
- app-defined Markdown dialect

Sort field rules:
- if there is a single obvious scalar string field such as `name` or `title`, preselect it
- otherwise require the user to choose before ranking begins
- preserve all object fields during exports, not just the chosen display field

## 7.4 Markdown dialect

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

## 8.1 Main modules

- `lib/validation/`: import schemas and data guards
- `lib/formats/`: JSON/YAML/Markdown parse + serialize
- `lib/ranking/`: Elo updates, pair scoring, ranking rebuild
- `lib/state/`: Zustand store and selectors
- `lib/supabase/`: auth, queries, mutations
- `components/comparison/`: pairwise UI
- `components/preview/`: GUI preview and text preview modes
- `components/editor/`: editable text modes and import actions

## 8.2 State boundaries

Server state:
- list metadata
- list items
- comparison history
- share links
- shared-copy records

Local UI state:
- current preview mode
- current editor text buffer
- unsaved import draft
- expanded drill-in sections
- active pair selection state
- ephemeral toasts/confirmations

## 8.3 Persistence strategy

Recommended approach:
- authoritative persistent data in Supabase
- local draft cache in IndexedDB for editor text and unsaved import work
- optimistic UI for comparison actions and item edits

## 9. Sharing model

## 9.1 Share creation

Owner creates a share link from a master list with:
- tokenized URL
- toggle: `allowRecipientEdits`

## 9.2 Share open flow

1. recipient opens share URL
2. app requires login or creates a gated anonymous session if that feature is later approved
3. app creates a personal shared-copy record if one does not already exist
4. recipient compares and edits only against that copy

## 9.3 Permission rules

Owner on master list can:
- add/remove/edit items
- compare items
- create share links

Recipient on shared copy can always:
- compare items
- skip items
- export their copy

Recipient on editable shared copy can also:
- add items
- remove items
- delete from pair during comparison

Recipient can never:
- mutate owner master list
- modify owner share settings
- alter another recipient’s copy

## 9.4 Row-level security intent

Policies should enforce:
- list owners only on `lists` and `list_items`
- recipient access only to their `shared_copies` and associated tables
- share-link token lookup limited to the link resolution flow

## 10. UI-specific technical behavior

## 10.1 Persistent preview pane

The preview pane should subscribe to derived ranking selectors so it updates immediately after:
- comparison result
- skip
- delete
- add item
- import apply
- sort-field change

## 10.2 Editable text modes

YAML/JSON/Markdown modes need a decoupled text buffer.

Rules:
- typing in the editor does not mutate the live list until the user clicks import/apply
- parse errors remain local to the editor buffer
- successful import replaces the live working list state

## 10.3 Object drill-in

Comparison cards display:
- primary label from `sortField`
- optional summary chips for 1-3 secondary fields
- expandable detail region rendering remaining fields recursively

## 11. API/query shape

Representative operations:
- `createList`
- `updateListMetadata`
- `replaceListItems`
- `appendComparisonEvent`
- `createShareLink`
- `resolveShareLink`
- `createOrLoadSharedCopy`
- `appendSharedCopyComparisonEvent`
- `addSharedCopyItem`
- `removeSharedCopyItem`

Prefer coarse, explicit mutations over magical generic ones.

## 12. Testing strategy

Unit tests:
- Elo math
- strong-win weighting
- skip behavior
- delete-without-rerank behavior
- pair selection heuristics
- JSON/YAML/Markdown round-trip
- sort-field detection

Integration tests:
- import object list -> choose sort field -> compare -> export
- shared read-only copy permissions
- shared editable copy permissions
- editor buffer parse errors do not destroy live list state

End-to-end tests:
- create list from YAML
- perform several comparisons
- switch preview formats
- copy/download export
- open shared link as recipient
- verify shared copy isolation

## 13. Deployment notes

Recommended deployment shape:
- static Expo web bundle hosted on a standard web host or CDN
- Supabase project for auth and database
- environment variables for Supabase URL and anon key

## 14. Future extension paths

Potential later additions:
- merge suggestions from shared copies back to owner inbox
- algorithm alternatives like Bradley-Terry or TrueSkill
- analytics on confidence/convergence
- list templates
- collaborative comments on items

## 15. Implementation guardrails

- preserve canonical data shape across all formats
- never allow shared-copy writes to touch master-list records
- keep ranking derivable from event history
- treat Markdown import as strict dialect support, not free-form Markdown fantasy
- keep GUI preview gorgeous and useful, but never export it
