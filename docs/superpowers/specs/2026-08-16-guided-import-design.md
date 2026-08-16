# Guided import and source-preserving export

Status: approved design, ready for implementation planning
Date: 2026-08-16

## 1. Problem

Two complaints, one root cause.

**The flow is confusing.** The app opens on the comparison workspace with an
empty state, and import is one of several things competing for attention in the
right rail. The rail is simultaneously a preview, an export surface, and a text
editor whose buffer may or may not have been applied to the live list. A first
run gives the user no obvious starting point and no sense of sequence.

**The data model prescribes a format.** Every import is coerced into an
app-defined `ListDocument`:

```ts
{ version, title, kind: 'primitive' | 'object', sortField?, items: [{ id?, value }] }
```

`title` is required. `kind` must be declared. An app-invented Markdown dialect
is treated as a first-class format. Most importantly, the imported document is
**discarded** at the boundary — `workspaceFromDocument` maps it into
`ListItem[]` and export re-serializes from the app's shape. A user who imports

```yaml
version: 3
owner: david
movies:
  - title: Alien
    year: 1979
notes: personal picks
```

cannot get that file back with `movies` reordered. The wrapper keys are gone.

The fix inverts the relationship: **the user's document is the model**, and the
app's concepts (which array, which field labels the cards, which field carries
the rank) are annotations on top of it.

## 2. Decisions

| Question | Decision |
| --- | --- |
| What does export return for a complex import? | The original document verbatim, with the chosen array reordered in place |
| Does the user pick an id/key field? | No. Array position carries the rank |
| Is there a second field role? | Yes — an optional *position field*, rewritten `1..N` on export |
| The app-defined Markdown dialect? | Deleted, import and export |
| Flow shape? | Two routes: `/` data screen with inline config, `/rank` comparison |
| Is the preview rail editable? | No. Read-only preview and export; edits go through the data screen |
| Re-import mid-run? | Preserve rankings for entries that are unchanged |
| Export engine? | Structural: clone document, splice reordered array, serialize |

Comment-preserving YAML export (manipulating the `yaml` package's CST so the
user's comments and formatting survive a round trip) was considered and
deferred. It is a second export engine that only helps one format, and it can
be added later without redoing the structural path.

## 3. Data model

### 3.1 New types

```ts
type SourceFormat = 'list' | 'yaml' | 'json';

interface DataSource {
  /** How the text parsed. Also the default export format. */
  format: SourceFormat;
  /** Exactly what the user gave us, for the Edit data screen. */
  rawText: string;
  /** The parsed value, verbatim. A string[] when format is 'list'. */
  document: unknown;
  /** Path to the ranked array within document. Empty when document is the array. */
  arrayPath: string[];
}

interface FieldRoles {
  /** Object entries only: which field shows on the comparison cards. */
  labelField?: string;
  /** Optional: which field is rewritten with 1..N on export. */
  positionField?: string;
}

interface Workspace {
  id: string;
  /** App-local metadata. Never written into the user's document. */
  name: string;
  source: DataSource;
  roles: FieldRoles;
  createdAt: string;
  updatedAt: string;
}
```

`ListItem` keeps its current shape — `id`, `listId`, `value`, `active`,
`createdAt`, `updatedAt` — where `value` is an entry of the ranked array as
imported. `ComparisonEvent`, `RankingState`, and everything in `lib/ranking/`
are unchanged.

### 3.2 Removed types

- `ListKind` (`'primitive' | 'object'`). Whether entries are scalars or objects
  is *derived* from the data, not declared by the user.
- `WorkspaceList.sortField` — becomes `roles.labelField`. The word *sort* was
  overloaded: it meant both "the field we display" and "an ordering". The two
  roles are now named separately.
- `ListDocument`, `ListDocumentItem`, `LIST_DOCUMENT_VERSION`,
  `listDocumentSchema`, `parseListDocument`, `coerceToListDocument`. This
  schema *is* the prescription being removed: it required a title, demanded a
  `kind`, and rejected documents that did not match.

### 3.3 Naming

The workspace `name` is app-local: it titles the header and the download
filename. It defaults to `Untitled list`, is editable inline, and is **never**
injected into the exported document. This replaces the old required `title`
field, which forced a concept onto data that had no room for it.

## 4. Import pipeline

New module `lib/import/`, all pure functions, no React and no store access.

### 4.1 Format detection — `sniffFormat(text): SourceFormat`

1. `JSON.parse` succeeds → `json`.
2. YAML parse succeeds *and* yields an object or array → `yaml`.
3. Otherwise → `list`.

Detection is a default, not a verdict. The data screen exposes
`Read as: Auto / Plain list / YAML / JSON`. This matters because valid YAML and
an intended plain list overlap:

```
Alien: 1979
Arrival: 2016
```

is a YAML mapping with no rankable array, but the user may have meant two
items. The override is the escape hatch; without it that input is a dead end.

### 4.2 Plain lists — `parsePlainList(text): string[]`

Split on newlines, trim, drop blank lines, then strip **one** leading marker
per line, and **only when whitespace follows it**:

- bullets: `-` `*` `+` `•` `–` `—` `>`
- numbers: `1.` `1)` `(1)`
- task boxes: `- [ ]` `- [x]`

The whitespace requirement is what keeps `-40 below zero` intact. No other
transformation is applied: the remaining text is the item, verbatim.

### 4.3 Array discovery — `findArrayCandidates(document): ArrayCandidate[]`

```ts
interface ArrayCandidate {
  path: string[];
  count: number;
  entryKind: 'object' | 'scalar';
  samples: string[];
}
```

Walk **object properties only**, never descending into array elements, to a
maximum depth of 5. An array qualifies when it has at least 2 entries and its
entries are uniformly objects or uniformly scalars.

Not descending into elements is what prevents nonsense candidates like
`movies.0.tags` — a per-item field, not a list the user means to rank.

Mixed-type arrays are excluded and reported as a non-blocking warning naming
the path, so the user understands why an array they can see is not offered.

If the document itself qualifies, the single candidate has `path: []`. Exactly
one candidate is auto-selected.

### 4.4 Label field

`lib/validation/sortFieldRules.ts` moves to `lib/import/labelField.ts`
unchanged in behaviour, with `sortField` renamed to `labelField` throughout.
`collectSortFieldCandidates` and `preferredSortField` keep their current rules:
only fields with full coverage and uniformly string values auto-select, with
`title`, `name`, `label` preferred in that order; otherwise the user chooses.

Scalar-entry arrays have no label field. The entry is the label.

### 4.5 Position field — `detectPositionField(entries)`

Offers every field whose value is numeric across all entries that carry it.
Preselects one whose name matches `/^(order|rank|position|index|sort|priority|seq(uence)?)$/i`.
Otherwise defaults to none: writing into the user's data is opt-in.

Not offered for scalar-entry arrays — there is nowhere to write.

### 4.6 Zero-decision path

A pasted plain list, or a single candidate array whose entries carry an
obvious label field, presents **no controls**. The panel reports what was found
and offers `Start ranking`.

## 5. Screens

### 5.1 `/` — the data screen

```
┌──────────────────────────────────────────────────────────────┐
│  Pairwise Ranker                    [← Back to ranking] [◐]  │
├───────────────────────────────┬──────────────────────────────┤
│  Add your list                │  What we found               │
│                               │                              │
│  Paste, type, or drop a file. │  YAML · 3 arrays             │
│  ┌─────────────────────────┐  │                              │
│  │ version: 3              │  │  Rank which list?            │
│  │ owner: david            │  │  (•) movies    12 objects    │
│  │ movies:                 │  │  ( ) actors     4 objects    │
│  │   - title: Alien        │  │  ( ) tags      31 texts      │
│  │     year: 1979          │  │                              │
│  │   ...                   │  │  Show each item by           │
│  └─────────────────────────┘  │  [ title ▾ ]  → "Alien"      │
│  [ Choose a file ]            │                              │
│  Read as: [ Auto ▾ ]          │  Write the new order into    │
│                               │  [ order ▾ ]  (optional)     │
│                               │  ────────────────────────    │
│                               │  12 items · 1 duplicate      │
│                               │  [   Start ranking →   ]     │
└───────────────────────────────┴──────────────────────────────┘
```

Input accepts paste, typing, and a file picker with drag-and-drop. Parsing runs
on a debounce as the text changes.

The found-panel re-renders live on every choice: the label picker shows the
actual string that will appear on the cards.

Warnings are non-blocking and specific — a mixed-type array was excluded, N
entries are missing the label field, N labels are duplicates.

The CTA disables only when something is genuinely unresolved, and states which:
no rankable array was found, fewer than two items to compare, or object entries
with no label field chosen.

Parse failures keep the user's text intact and report a line number when the
format can pinpoint one.

### 5.2 `/rank` — the comparison screen

The existing `AppShell` with its rails re-tasked.

**Left rail:** inline-editable list name; a context line reading
`movies · shown by title · order written back`; progress; `Edit data` and
`Start over`. The sort-field picker moves to the data screen, where the
decision belongs. `ListControls`' add/remove is gone.

**Centre:** `ComparisonDeck` unchanged — the cards, remove-during-comparison,
and the keyboard shortcuts all keep working against the same `ListItem` shape.

**Right rail:** `Ranked` / `YAML` / `JSON` tabs (plus `List` for plain-list
sources), read-only, monospace, with copy and download. Default tab is the
source format. A note appears when removed items are being excluded from the
export.

### 5.3 Navigation

On load the store hydrates. If a saved workspace exists, redirect once to
`/rank`, guarded by a flag so `Edit data` does not bounce back.

`Edit data` returns to `/` with `rawText` prefilled, the workspace intact, and
a banner — `Editing "Sci-fi films" · 47 comparisons so far`. The CTA becomes
`Apply edits` and opens the summary in §7.

`Start over` confirms, clears local storage, and returns to `/`.

Mobile stacks the data screen with the input above the found-panel, and keeps
the rank screen's existing responsive behaviour.

## 6. Export

`lib/export/buildExport.ts`:

```ts
buildExport(
  source: DataSource,
  roles: FieldRoles,
  rankedItems: ListItem[],
  format: SourceFormat,
): string
```

1. Deep-clone `source.document`.
2. Build `entries` from `rankedItems` in ranked order, filtered to
   `active === true`. Items removed during comparison are excluded from the
   export; the rail states how many.
3. If `roles.positionField` is set, map each entry to
   `{ ...entry, [positionField]: index + 1 }`. Object spread rewrites an
   existing key **in place**, so an existing `order` keeps its position among
   the object's keys; a field that did not exist is appended.
4. Write `entries` back at `source.arrayPath`, or replace the whole document
   when the path is empty.
5. Serialize by format: `JSON.stringify(doc, null, 2)`, `yaml.stringify(doc)`,
   or one label per line for `list`.

The function is pure and total: given the same source, roles, and ranking, it
produces the same text. Every field of every entry survives, whether or not the
app understands it.

Download filenames reuse the existing `slugify` and `exportFilename`, keyed on
the workspace name: `sci-fi-films-2026-08-16.yaml`.

## 7. Applying edits

`lib/import/diff.ts`:

```ts
interface ImportDiff {
  kept: { item: ListItem; entry: unknown }[];
  added: unknown[];
  removed: ListItem[];
  /** Comparison events that survive, for the summary line. */
  keptComparisons: number;
}

diffImport(existingItems: ListItem[], nextEntries: unknown[]): ImportDiff
```

Matches entries to existing items by **deep value equality**, greedily and in
order, consuming each existing item at most once so duplicate values match by
position among equals.

- **Matched** entries keep their existing item id. This is what preserves the
  comparison events pointing at them, and therefore their ratings.
- **Absent** items are marked `active: false` rather than deleted — the same
  mechanism as removing during a comparison. Their events stay resolvable and
  `rebuildRanking` needs no change.
- **New** entries become fresh items with no comparisons, entering the pair
  pool immediately.

The summary is rendered directly from the diff and confirmed before anything is
applied:

```
Applying your edits
──────────────────────────────
  9 items unchanged  — rankings kept
  2 items added      — not yet ranked
  1 item removed     — 47 comparisons kept

     [ Cancel ]  [ Apply edits ]
```

A wholesale document replacement needs no special case: it reports
`0 kept, N added, M removed`. Changing the label or position field on the edit
screen does not touch history, since matching is keyed on item ids and values,
not on roles.

## 8. Persistence

`WORKSPACE_VERSION` becomes `2`:

```ts
{
  version: 2,
  workspace: { id, name, source, roles, createdAt, updatedAt },
  items: ListItem[],
  comparisonEvents: ComparisonEvent[],
  ui: { previewTab: 'ranked' | SourceFormat },
}
```

Version 1 snapshots **cannot** be migrated — they hold no source document, so
there is nothing to reconstruct an export from. They are dropped on load rather
than half-restored, and the user lands on the data screen.

Because the snapshot now holds both `rawText` and the parsed `document`, add a
write-size guard: if the payload exceeds the browser's storage budget, skip
persisting and surface `Too large to save in this browser` in the status line
rather than throwing. The app stays fully usable in memory, as it does today
when localStorage is unavailable.

## 9. Testing

**Unit**

- `sniffFormat` truth table, including the YAML-mapping-vs-plain-list overlap
- `parsePlainList`: every marker, and the `-40 below zero` non-strip case
- `findArrayCandidates`: nesting, depth cap, mixed-type rejection, no descent
  into array elements, bare-array document, exactly-one auto-selection
- `preferredSortField` / `detectPositionField` (behaviour carried over, renamed)
- `buildExport`: wrapper keys survive untouched; array reordered at a nested
  path; position field rewritten in place vs. appended; inactive items excluded;
  each output format
- `diffImport`: all-kept, all-new, duplicates matched by position, partial
  overlap, wholesale replacement

**Integration**

- data screen → choose array, label, position → start ranking → compare →
  exported text equals the expected document
- edit data → apply → ratings preserved for unchanged items, new items unranked
- v1 snapshot on disk → dropped cleanly, user lands on the data screen

**End-to-end**

- plain-list path: paste, rank, copy, download
- nested-YAML path: paste, choose array and fields, rank, reload and resume,
  edit data, apply, export

## 10. File plan

**New**

- `lib/import/sniff.ts`, `plainList.ts`, `arrayCandidates.ts`,
  `labelField.ts` (moved from `lib/validation/sortFieldRules.ts`),
  `positionField.ts`, `diff.ts`
- `lib/export/buildExport.ts`
- `app/rank.tsx`
- `components/data/SourceInput.tsx`, `FoundPanel.tsx`, `ArrayPicker.tsx`,
  `LabelPicker.tsx`, `PositionPicker.tsx`, `ApplySummary.tsx`

**Rewritten**

- `app/index.tsx` — becomes the data screen
- `app/_layout.tsx` — route registration
- `lib/state/useListStore.ts` — actions become `setSourceText`,
  `setFormatOverride`, `setArrayPath`, `setRoles`, `setName`, `startRanking`,
  `applyEdits`, `recordComparison`, `removeItem`, `reset`
- `lib/state/selectors.ts` — label resolution reads `roles.labelField`
- `components/preview/PreviewPane.tsx` — read-only
- `components/layout/AppShell.tsx`, `components/lists/SortFieldPicker.tsx`
  (retargeted as `LabelPicker`), `components/editor/FormatTabs.tsx`
  (retargeted as the preview tabs), `components/editor/WorkspaceControls.tsx`
  (becomes the left-rail context, `Edit data`, and `Start over`)
- `types/list.ts`, `types/workspace.ts`
- `lib/persistence/browserStorage.ts` — v2 shape, size guard
- `lib/formats/index.ts` — serializers and filename helpers only

**Deleted**

- `lib/formats/markdownFormat.ts`, `documentMapping.ts`, `canonical.ts`
- `lib/validation/listSchemas.ts`
- `components/lists/EmptyState.tsx`, `components/lists/ListControls.tsx`,
  `components/editor/ImportToolbar.tsx`, `components/editor/TextFormatEditor.tsx`
- their tests: `tests/unit/formats/markdownFormat.test.ts`,
  `documentMapping.test.ts`, `tests/unit/listSchemas.test.ts`,
  `tests/integration/editorRoundTrip.test.tsx`

**Existing tests to rewrite rather than delete**

- `tests/unit/sortFieldRules.test.ts` → `tests/unit/import/labelField.test.ts`
- `tests/integration/sortFieldFlow.test.tsx` → data-screen field-selection flow
- `tests/component/SortFieldPicker.test.tsx`, `PreviewPane.test.tsx`,
  `WorkspaceControls.test.tsx` → follow their retargeted components
- `tests/unit/state/useListStore.test.ts`, `selectors.test.ts` → new actions
  and `roles.labelField`
- `tests/e2e/core-flow.spec.ts` → the two flows in §9

**Untouched**

- all of `lib/ranking/` — Elo, pair selection, ranking rebuild
- `components/comparison/` — the cards do not care that the model beneath them
  changed

**Docs**

- `ARCHITECTURE.md` §5 (data model) and §7 (import/export) rewritten
- `UX.md` core layout, empty states, and export presentation rules updated
