# Guided Import and Source-Preserving Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the app's prescribed list format with the user's own parsed document, and split the flow into a guided data screen followed by the comparison screen.

**Architecture:** The user's parsed document becomes the model. A `DataSource` holds the parsed value verbatim plus a path to the array being ranked; `FieldRoles` names which field labels the cards and which optional field receives the new rank. Export deep-clones the document, splices the reordered array back at that path, and serializes. Ranking (Elo, pair selection, rebuild) is untouched throughout.

**Tech Stack:** Expo Router, React Native Web, Zustand, Zod, the `yaml` package, Vitest + React Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-16-guided-import-design.md` — read it before starting. Every task below implements a section of it.

## Global Constraints

- **Path alias:** `@/` resolves to the repo root. Import as `@/lib/...`, never by relative path.
- **Components are React Native**, rendered through `react-native-web`. Use `View`, `Text`, `Pressable`, `TextInput` from `react-native`; never raw DOM elements except in `FileDrop.tsx`, which is explicitly web-only.
- **Styling** uses `StyleSheet.create` with tokens from `@/lib/theme` (`colors`, `fonts`, `radius`, `space`, `typeScale`). Never hard-code a colour or a pixel spacing that has a token.
- **Test environment:** logic tests run in node; component tests must start with the docblock `/** @vitest-environment jsdom */` on line 1.
- **Run a single test file:** `npx vitest run tests/path/to/file.test.ts`. Whole suite: `npm test`. Types: `npm run typecheck`. Lint: `npm run lint`.
- **Every commit message ends with the trailer** `Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>` on its own line after a blank line.
- **Accessibility:** every interactive element needs an `accessibilityLabel`. Selected states use `aria-pressed` or `aria-checked`. Tests query by role and accessible name, following `tests/component/SortFieldPicker.test.tsx`.
- **The workspace `name` is never written into the user's document.** It titles the header and the download filename only.
- **Tasks 1–10 are additive** — the existing app keeps compiling and its tests keep passing. Tasks 11 and 12 are the switchover: 11 replaces the store, 12 rewires the screens and deletes the old model.

## File Structure

**New — `lib/import/` (pure, no React, no store access)**

| File | Responsibility |
| --- | --- |
| `types.ts` | `ParseIssue`, `ParseResult<T>` (moved out of the deleted `listSchemas.ts`) |
| `text.ts` | `normalizeText`, `isBlank` (moved out of the deleted `canonical.ts`) |
| `sniff.ts` | `sniffFormat`, `parseSource` — text to a parsed value |
| `plainList.ts` | `parsePlainList` — one item per line, markers stripped |
| `arrayCandidates.ts` | `findArrayCandidates`, `entriesAtPath`, `formatPath` |
| `labelField.ts` | moved `sortFieldRules.ts`, renamed to label-field vocabulary |
| `positionField.ts` | `detectPositionFields`, `preferredPositionField` |
| `roles.ts` | `resolveRoles` — auto-pick label and position fields |
| `analyze.ts` | `analyzeSource` — the data screen's whole read of a text blob |
| `deepEqual.ts` | `deepEqual` — structural equality for diffing |
| `diff.ts` | `diffImport` — match re-imported entries to existing items |

**New — `lib/export/`**

| File | Responsibility |
| --- | --- |
| `buildExport.ts` | `buildExportDocument`, `buildExport`, `setAtPath` |
| `filenames.ts` | `slugify`, `exportFilename`, `mimeTypeFor`, `extensionFor` |

**New — components and routes**

| File | Responsibility |
| --- | --- |
| `types/source.ts` | `SourceFormat`, `PreviewTab`, `DataSource`, `FieldRoles`, `Workspace` |
| `components/data/SourceInput.tsx` | textarea, `Read as` override, file drop |
| `components/data/FileDrop.tsx` | web-only file input and drag target |
| `components/data/ArrayPicker.tsx` | choose which array to rank |
| `components/data/LabelPicker.tsx` | choose the label field (from `SortFieldPicker`) |
| `components/data/PositionPicker.tsx` | choose the optional position field |
| `components/data/FoundPanel.tsx` | composes the three pickers, warnings, CTA |
| `components/data/ApplySummary.tsx` | the kept/added/removed confirmation |
| `components/rank/RankRail.tsx` | left rail: name, context, progress, actions |
| `components/preview/PreviewTabs.tsx` | `Ranked` / format tabs (from `FormatTabs`) |
| `components/preview/ExportToolbar.tsx` | copy and download (from `ImportToolbar`) |
| `components/preview/ReadOnlyCode.tsx` | monospace scroll block |
| `app/rank.tsx` | the comparison route |

`app/_layout.tsx` needs **no change** — expo-router registers `app/rank.tsx` from the filename.

**Deleted in Task 12:** all of `lib/formats/`, `lib/validation/listSchemas.ts`, `lib/validation/sortFieldRules.ts`, `components/lists/`, `components/editor/`, and their tests.

---

### Task 1: Source types and format detection

**Files:**
- Create: `types/source.ts`, `lib/import/types.ts`, `lib/import/text.ts`, `lib/import/sniff.ts`
- Test: `tests/unit/import/sniff.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type SourceFormat = 'list' | 'yaml' | 'json'`
  - `type PreviewTab = 'ranked' | SourceFormat`
  - `interface DataSource { format: SourceFormat; rawText: string; document: unknown; arrayPath: string[] }`
  - `interface FieldRoles { labelField?: string; positionField?: string }`
  - `interface Workspace { id: string; name: string; source: DataSource; roles: FieldRoles; createdAt: string; updatedAt: string }`
  - `const DEFAULT_WORKSPACE_NAME = 'Untitled list'`
  - `interface ParseIssue { path: string; message: string; line?: number }`
  - `type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ParseIssue[] }`
  - `normalizeText(text: string): string`, `isBlank(text: string): boolean`
  - `sniffFormat(text: string): SourceFormat`
  - `parseSource(text: string, format: SourceFormat): ParseResult<unknown>`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/import/sniff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseSource, sniffFormat } from '@/lib/import/sniff';

describe('sniffFormat', () => {
  it('detects JSON', () => {
    expect(sniffFormat('[{"title":"Alien"}]')).toBe('json');
  });

  it('detects YAML mappings', () => {
    expect(sniffFormat('movies:\n  - title: Alien\n')).toBe('yaml');
  });

  it('detects YAML sequences', () => {
    expect(sniffFormat('- title: Alien\n- title: Arrival\n')).toBe('yaml');
  });

  it('treats bare lines as a plain list', () => {
    expect(sniffFormat('Alien\nArrival\nSolaris\n')).toBe('list');
  });

  it('treats a bulleted list of plain text as YAML, which reads it the same way', () => {
    expect(sniffFormat('- Alien\n- Arrival\n')).toBe('yaml');
  });

  it('treats a single word as a plain list, not a YAML scalar', () => {
    expect(sniffFormat('Alien')).toBe('list');
  });
});

describe('parseSource', () => {
  it('parses JSON to the value verbatim', () => {
    const result = parseSource('{"a":[1,2]}', 'json');

    expect(result).toEqual({ ok: true, data: { a: [1, 2] } });
  });

  it('parses YAML to the value verbatim', () => {
    const result = parseSource('owner: david\nmovies:\n  - Alien\n', 'yaml');

    expect(result).toEqual({ ok: true, data: { owner: 'david', movies: ['Alien'] } });
  });

  it('parses a plain list to an array of strings', () => {
    const result = parseSource('Alien\nArrival\n', 'list');

    expect(result).toEqual({ ok: true, data: ['Alien', 'Arrival'] });
  });

  it('reports a JSON syntax error with a line number', () => {
    const result = parseSource('{\n  "a": ,\n}', 'json');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.line).toBe(2);
  });

  it('reports a YAML syntax error with a line number', () => {
    const result = parseSource('movies:\n  - a\n - b\n', 'yaml');

    expect(result.ok).toBe(false);
  });

  it('refuses empty text', () => {
    const result = parseSource('   \n  ', 'yaml');

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.issues[0]?.message).toMatch(/nothing to read/i);
  });

  it('strips a byte order mark before parsing', () => {
    const result = parseSource('﻿{"a":1}', 'json');

    expect(result).toEqual({ ok: true, data: { a: 1 } });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/sniff.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/sniff"`.

- [ ] **Step 3: Create the shared types**

Create `types/source.ts`:

```ts
/** The user's own document is the model. See the guided-import spec, section 3. */

export type SourceFormat = 'list' | 'yaml' | 'json';

/** The preview rail's tabs: the ranked view, or the data in a text format. */
export type PreviewTab = 'ranked' | SourceFormat;

export interface DataSource {
  /** How the text parsed. Also the default export format. */
  format: SourceFormat;
  /** Exactly what the user gave us, so the data screen can show it back. */
  rawText: string;
  /** The parsed value, verbatim. A string[] when format is 'list'. */
  document: unknown;
  /** Path to the ranked array within document. Empty when document is the array. */
  arrayPath: string[];
}

export interface FieldRoles {
  /** Object entries only: which field shows on the comparison cards. */
  labelField?: string;
  /** Optional: which field is rewritten with 1..N on export. */
  positionField?: string;
}

export interface Workspace {
  id: string;
  /** App-local metadata. Never written into the user's document. */
  name: string;
  source: DataSource;
  roles: FieldRoles;
  createdAt: string;
  updatedAt: string;
}

export const DEFAULT_WORKSPACE_NAME = 'Untitled list';
```

Create `lib/import/types.ts`:

```ts
export interface ParseIssue {
  /** Dotted path into the payload. Empty for whole-document issues. */
  path: string;
  message: string;
  /** 1-based line in the source text, when the format can pinpoint one. */
  line?: number;
}

export type ParseResult<T> = { ok: true; data: T } | { ok: false; issues: ParseIssue[] };
```

Create `lib/import/text.ts`:

```ts
/** Make pasted text safe to parse: drop the BOM and normalize line endings. */
export function normalizeText(text: string): string {
  return text.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function isBlank(text: string): boolean {
  return normalizeText(text).trim().length === 0;
}

/** 1-based line number for a character offset, for editor diagnostics. */
export function lineForOffset(text: string, offset: number): number {
  const clamped = Math.max(0, Math.min(offset, text.length));
  let line = 1;
  for (let i = 0; i < clamped; i += 1) {
    if (text[i] === '\n') line += 1;
  }
  return line;
}
```

- [ ] **Step 4: Implement the sniffer**

Create `lib/import/sniff.ts`:

```ts
import { parse as parseYamlText } from 'yaml';

import { parsePlainList } from '@/lib/import/plainList';
import { isBlank, lineForOffset, normalizeText } from '@/lib/import/text';
import type { ParseIssue, ParseResult } from '@/lib/import/types';
import type { SourceFormat } from '@/types/source';

/**
 * A default, not a verdict: the data screen lets the user override it. Valid
 * YAML and an intended plain list overlap, so the override is the escape hatch.
 */
export function sniffFormat(text: string): SourceFormat {
  const source = normalizeText(text);
  if (isBlank(source)) return 'list';

  try {
    JSON.parse(source);
    return 'json';
  } catch {
    // Not JSON; try YAML next.
  }

  try {
    const payload = parseYamlText(source, { logLevel: 'silent' });
    // A bare scalar means YAML read the whole blob as one string, which is
    // never what a user pasting a list meant.
    if (payload !== null && typeof payload === 'object') return 'yaml';
  } catch {
    // Not YAML either.
  }

  return 'list';
}

export function parseSource(text: string, format: SourceFormat): ParseResult<unknown> {
  if (isBlank(text)) {
    return { ok: false, issues: [{ path: '', message: 'There is nothing to read yet.' }] };
  }

  const source = normalizeText(text);

  switch (format) {
    case 'list':
      return { ok: true, data: parsePlainList(source) };
    case 'json':
      return parseJsonSource(source);
    case 'yaml':
      return parseYamlSource(source);
  }
}

function parseJsonSource(source: string): ParseResult<unknown> {
  try {
    return { ok: true, data: JSON.parse(source) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const offset = Number(/position (\d+)/.exec(message)?.[1] ?? NaN);
    const line = Number.isNaN(offset) ? undefined : lineForOffset(source, offset);

    return {
      ok: false,
      issues: [{ path: '', message: `Invalid JSON: ${message}`, ...(line ? { line } : {}) }],
    };
  }
}

interface YamlParseError extends Error {
  linePos?: { line: number; col: number }[];
}

function parseYamlSource(source: string): ParseResult<unknown> {
  try {
    // 'error' keeps real errors throwing but drops warnings, so malformed
    // pasted text surfaces on the data screen instead of the browser console.
    return { ok: true, data: parseYamlText(source, { logLevel: 'error' }) };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const line = (error as YamlParseError)?.linePos?.[0]?.line;
    const issue: ParseIssue = {
      path: '',
      message: `Invalid YAML: ${message}`,
      ...(typeof line === 'number' ? { line } : {}),
    };

    return { ok: false, issues: [issue] };
  }
}
```

Create a placeholder `lib/import/plainList.ts` so this compiles — Task 2 replaces its body with the tested implementation:

```ts
export function parsePlainList(text: string): string[] {
  return text.split('\n').map((line) => line.trim()).filter((line) => line !== '');
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/sniff.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Verify nothing else broke**

Run: `npm test && npm run typecheck`
Expected: PASS. Nothing imports the new modules yet.

- [ ] **Step 7: Commit**

```bash
git add types/source.ts lib/import tests/unit/import
git commit -m "feat: add source types and format detection"
```

---

### Task 2: Plain list parsing

**Files:**
- Modify: `lib/import/plainList.ts` (replaces the Task 1 placeholder)
- Test: `tests/unit/import/plainList.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `parsePlainList(text: string): string[]` — one item per non-blank line, with a single leading list marker stripped.

- [ ] **Step 1: Write the failing test**

Create `tests/unit/import/plainList.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parsePlainList } from '@/lib/import/plainList';

describe('parsePlainList', () => {
  it('takes one item per line', () => {
    expect(parsePlainList('Alien\nArrival\nSolaris')).toEqual(['Alien', 'Arrival', 'Solaris']);
  });

  it('drops blank lines and surrounding whitespace', () => {
    expect(parsePlainList('  Alien  \n\n\n  Arrival\n')).toEqual(['Alien', 'Arrival']);
  });

  it('strips dash, star, plus, and unicode bullets', () => {
    expect(parsePlainList('- Alien\n* Arrival\n+ Solaris\n• Stalker\n')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
      'Stalker',
    ]);
  });

  it('strips en dashes, em dashes, and blockquote markers', () => {
    expect(parsePlainList('– Alien\n— Arrival\n> Solaris')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
    ]);
  });

  it('strips numbered markers in every common style', () => {
    expect(parsePlainList('1. Alien\n2) Arrival\n(3) Solaris\n10. Stalker')).toEqual([
      'Alien',
      'Arrival',
      'Solaris',
      'Stalker',
    ]);
  });

  it('strips task boxes, checked or not', () => {
    expect(parsePlainList('- [ ] Alien\n- [x] Arrival')).toEqual(['Alien', 'Arrival']);
  });

  it('strips only one marker per line', () => {
    expect(parsePlainList('- - Alien')).toEqual(['- Alien']);
  });

  it('keeps a leading dash that is part of the text', () => {
    expect(parsePlainList('-40 below zero\n-fatal error')).toEqual([
      '-40 below zero',
      '-fatal error',
    ]);
  });

  it('keeps a number that is part of the text', () => {
    expect(parsePlainList('1984\n2001: A Space Odyssey')).toEqual([
      '1984',
      '2001: A Space Odyssey',
    ]);
  });

  it('keeps indentation-only differences from creating duplicates', () => {
    expect(parsePlainList('  - Alien\n    - Arrival')).toEqual(['Alien', 'Arrival']);
  });

  it('returns nothing for blank text', () => {
    expect(parsePlainList('   \n\n  ')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/plainList.test.ts`
Expected: FAIL — the placeholder does not strip markers, so the bullet tests fail.

- [ ] **Step 3: Implement the parser**

Replace the whole body of `lib/import/plainList.ts`:

```ts
import { normalizeText } from '@/lib/import/text';

/**
 * A marker is only stripped when whitespace follows it. That single rule is
 * what keeps `-40 below zero` and `1984` intact while still reading every
 * common bullet and numbering style as a list.
 */
const MARKER = /^(?:[-*+•–—>]|\d+[.)]|\(\d+\))\s+/;
const TASK_BOX = /^\[[ xX]\]\s+/;

export function parsePlainList(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((line) => stripMarker(line.trim()))
    .filter((line) => line !== '');
}

function stripMarker(line: string): string {
  const withoutMarker = line.replace(MARKER, '');
  if (withoutMarker === line) return line;
  // `- [x] Alien` is a bullet followed by a task box, not two bullets.
  return withoutMarker.replace(TASK_BOX, '').trim();
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/plainList.test.ts`
Expected: PASS, 11 tests.

- [ ] **Step 5: Re-run the sniffer test, which depends on this**

Run: `npx vitest run tests/unit/import/`
Expected: PASS, both files.

- [ ] **Step 6: Commit**

```bash
git add lib/import/plainList.ts tests/unit/import/plainList.test.ts
git commit -m "feat: parse plain lists with any common bullet style"
```

---

### Task 3: Array discovery and source analysis

**Files:**
- Create: `lib/import/arrayCandidates.ts`, `lib/import/analyze.ts`
- Test: `tests/unit/import/arrayCandidates.test.ts`, `tests/unit/import/analyze.test.ts`

**Interfaces:**
- Consumes: `sniffFormat`, `parseSource` (Task 1); `ParseIssue`, `ParseResult` (Task 1).
- Produces:
  - `interface ArrayCandidate { path: string[]; count: number; entryKind: 'object' | 'scalar'; samples: string[] }`
  - `interface CandidateScan { candidates: ArrayCandidate[]; warnings: string[] }`
  - `findArrayCandidates(document: unknown): CandidateScan`
  - `entriesAtPath(document: unknown, path: string[]): unknown[]`
  - `formatPath(path: string[]): string` — `[]` renders as `the list`, `['a','b']` as `a.b`
  - `MIN_RANKABLE = 2`
  - `interface SourceAnalysis { format: SourceFormat; document: unknown; candidates: ArrayCandidate[]; warnings: string[]; issues: ParseIssue[] }`
  - `analyzeSource(rawText: string, override: SourceFormat | 'auto'): SourceAnalysis`

- [ ] **Step 1: Write the failing test for array discovery**

Create `tests/unit/import/arrayCandidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { entriesAtPath, findArrayCandidates, formatPath } from '@/lib/import/arrayCandidates';

const nested = {
  version: 3,
  owner: 'david',
  movies: [
    { title: 'Alien', year: 1979, tags: ['horror', 'space'] },
    { title: 'Arrival', year: 2016, tags: ['drama'] },
  ],
  actors: ['Sigourney Weaver', 'Amy Adams'],
};

describe('findArrayCandidates', () => {
  it('finds arrays of objects', () => {
    const { candidates } = findArrayCandidates(nested);
    const movies = candidates.find((entry) => entry.path.join('.') === 'movies');

    expect(movies).toMatchObject({ count: 2, entryKind: 'object' });
  });

  it('finds arrays of scalars', () => {
    const { candidates } = findArrayCandidates(nested);
    const actors = candidates.find((entry) => entry.path.join('.') === 'actors');

    expect(actors).toMatchObject({ count: 2, entryKind: 'scalar' });
  });

  it('never descends into array elements', () => {
    const { candidates } = findArrayCandidates(nested);

    expect(candidates.map((entry) => entry.path.join('.'))).toEqual(['movies', 'actors']);
  });

  it('finds arrays nested inside plain objects', () => {
    const { candidates } = findArrayCandidates({ data: { results: [{ a: 1 }, { a: 2 }] } });

    expect(candidates[0]?.path).toEqual(['data', 'results']);
  });

  it('treats a bare array document as the only candidate, with an empty path', () => {
    const { candidates } = findArrayCandidates(['Alien', 'Arrival']);

    expect(candidates).toEqual([
      { path: [], count: 2, entryKind: 'scalar', samples: ['Alien', 'Arrival'] },
    ]);
  });

  it('skips arrays with fewer than two entries', () => {
    const { candidates } = findArrayCandidates({ only: [{ a: 1 }] });

    expect(candidates).toEqual([]);
  });

  it('skips arrays that mix scalars and objects, and says why', () => {
    const { candidates, warnings } = findArrayCandidates({ mixed: ['Alien', { title: 'Arrival' }] });

    expect(candidates).toEqual([]);
    expect(warnings[0]).toMatch(/mixed/i);
    expect(warnings[0]).toMatch(/mixed:|"mixed"/);
  });

  it('stops descending past five levels', () => {
    const deep = { a: { b: { c: { d: { e: { f: [1, 2] } } } } } };

    expect(findArrayCandidates(deep).candidates).toEqual([]);
  });

  it('samples up to three entries for the preview', () => {
    const { candidates } = findArrayCandidates({ many: ['a', 'b', 'c', 'd', 'e'] });

    expect(candidates[0]?.samples).toEqual(['a', 'b', 'c']);
  });

  it('finds nothing in a document with no arrays', () => {
    expect(findArrayCandidates({ owner: 'david' }).candidates).toEqual([]);
  });
});

describe('entriesAtPath', () => {
  it('reads a nested array', () => {
    expect(entriesAtPath(nested, ['movies'])).toHaveLength(2);
  });

  it('reads the document itself for an empty path', () => {
    expect(entriesAtPath(['a', 'b'], [])).toEqual(['a', 'b']);
  });

  it('returns nothing when the path misses', () => {
    expect(entriesAtPath(nested, ['nope'])).toEqual([]);
  });
});

describe('formatPath', () => {
  it('names a nested path', () => {
    expect(formatPath(['data', 'results'])).toBe('data.results');
  });

  it('names the document itself', () => {
    expect(formatPath([])).toBe('the list');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/arrayCandidates.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/arrayCandidates"`.

- [ ] **Step 3: Implement array discovery**

Create `lib/import/arrayCandidates.ts`:

```ts
export interface ArrayCandidate {
  path: string[];
  count: number;
  entryKind: 'object' | 'scalar';
  /** A few entries rendered as text, for the picker's preview. */
  samples: string[];
}

export interface CandidateScan {
  candidates: ArrayCandidate[];
  /** Arrays that were skipped, and why, so the user is not left guessing. */
  warnings: string[];
}

/** Ranking one item is not ranking. */
export const MIN_RANKABLE = 2;

const MAX_DEPTH = 5;
const MAX_SAMPLES = 3;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isScalar(value: unknown): boolean {
  return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
}

/**
 * Walks object properties only, never descending into array elements. That is
 * what keeps per-item fields like `movies[].tags` out of the candidate list:
 * they are a field of an item, not a list the user means to rank.
 */
export function findArrayCandidates(document: unknown): CandidateScan {
  const candidates: ArrayCandidate[] = [];
  const warnings: string[] = [];

  function visit(value: unknown, path: string[], depth: number): void {
    if (depth > MAX_DEPTH) return;

    if (Array.isArray(value)) {
      const candidate = describeArray(value, path);
      if (candidate !== null) {
        candidates.push(candidate);
      } else if (value.length >= MIN_RANKABLE) {
        warnings.push(
          `Skipped "${formatPath(path)}" — it mixes text and objects, so it cannot be ranked as one list.`,
        );
      }
      return;
    }

    if (!isPlainObject(value)) return;

    for (const key of Object.keys(value)) {
      visit(value[key], [...path, key], depth + 1);
    }
  }

  visit(document, [], 0);
  return { candidates, warnings };
}

function describeArray(entries: unknown[], path: string[]): ArrayCandidate | null {
  if (entries.length < MIN_RANKABLE) return null;

  const allObjects = entries.every(isPlainObject);
  const allScalars = entries.every(isScalar);
  if (!allObjects && !allScalars) return null;

  return {
    path,
    count: entries.length,
    entryKind: allObjects ? 'object' : 'scalar',
    samples: entries.slice(0, MAX_SAMPLES).map(describeEntry),
  };
}

function describeEntry(entry: unknown): string {
  if (isScalar(entry)) return String(entry);
  if (isPlainObject(entry)) {
    const firstText = Object.values(entry).find((value) => typeof value === 'string');
    return typeof firstText === 'string' ? firstText : Object.keys(entry).join(', ');
  }
  return '';
}

export function entriesAtPath(document: unknown, path: string[]): unknown[] {
  let current: unknown = document;
  for (const key of path) {
    if (!isPlainObject(current)) return [];
    current = current[key];
  }
  return Array.isArray(current) ? current : [];
}

export function formatPath(path: string[]): string {
  return path.length === 0 ? 'the list' : path.join('.');
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/arrayCandidates.test.ts`
Expected: PASS, 15 tests.

- [ ] **Step 5: Write the failing test for `analyzeSource`**

Create `tests/unit/import/analyze.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { analyzeSource } from '@/lib/import/analyze';

describe('analyzeSource', () => {
  it('reads a plain list end to end', () => {
    const analysis = analyzeSource('Alien\nArrival\n', 'auto');

    expect(analysis.format).toBe('list');
    expect(analysis.candidates[0]).toMatchObject({ path: [], count: 2, entryKind: 'scalar' });
    expect(analysis.issues).toEqual([]);
  });

  it('reads nested YAML and offers each array', () => {
    const analysis = analyzeSource('movies:\n  - title: Alien\n  - title: Arrival\n', 'auto');

    expect(analysis.format).toBe('yaml');
    expect(analysis.candidates.map((entry) => entry.path.join('.'))).toEqual(['movies']);
  });

  it('honours a format override', () => {
    const analysis = analyzeSource('Alien: 1979\nArrival: 2016\n', 'list');

    expect(analysis.format).toBe('list');
    expect(analysis.candidates[0]?.count).toBe(2);
  });

  it('reports parse failures without throwing', () => {
    const analysis = analyzeSource('{ "a": , }', 'json');

    expect(analysis.issues).toHaveLength(1);
    expect(analysis.candidates).toEqual([]);
  });

  it('reports no candidates for a mapping with no arrays', () => {
    const analysis = analyzeSource('Alien: 1979\nArrival: 2016\n', 'auto');

    expect(analysis.format).toBe('yaml');
    expect(analysis.candidates).toEqual([]);
  });

  it('is blank-safe', () => {
    const analysis = analyzeSource('', 'auto');

    expect(analysis.candidates).toEqual([]);
    expect(analysis.issues).toHaveLength(1);
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/analyze.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/analyze"`.

- [ ] **Step 7: Implement `analyzeSource`**

Create `lib/import/analyze.ts`:

```ts
import { findArrayCandidates } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { parseSource, sniffFormat } from '@/lib/import/sniff';
import type { ParseIssue } from '@/lib/import/types';
import type { SourceFormat } from '@/types/source';

export interface SourceAnalysis {
  format: SourceFormat;
  document: unknown;
  candidates: ArrayCandidate[];
  warnings: string[];
  issues: ParseIssue[];
}

/**
 * Everything the data screen knows about a blob of text, in one pure call, so
 * the screen itself holds no parsing logic.
 */
export function analyzeSource(
  rawText: string,
  override: SourceFormat | 'auto',
): SourceAnalysis {
  const format = override === 'auto' ? sniffFormat(rawText) : override;
  const parsed = parseSource(rawText, format);

  if (!parsed.ok) {
    return { format, document: null, candidates: [], warnings: [], issues: parsed.issues };
  }

  const { candidates, warnings } = findArrayCandidates(parsed.data);
  return { format, document: parsed.data, candidates, warnings, issues: [] };
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run tests/unit/import/`
Expected: PASS, four files.

- [ ] **Step 9: Commit**

```bash
git add lib/import/arrayCandidates.ts lib/import/analyze.ts tests/unit/import
git commit -m "feat: discover rankable arrays in an imported document"
```

---

### Task 4: Field roles — label and position

**Files:**
- Create: `lib/import/labelField.ts` (moved from `lib/validation/sortFieldRules.ts`), `lib/import/positionField.ts`, `lib/import/roles.ts`
- Test: `tests/unit/import/labelField.test.ts` (moved from `tests/unit/sortFieldRules.test.ts`), `tests/unit/import/positionField.test.ts`, `tests/unit/import/roles.test.ts`

**Interfaces:**
- Consumes: `FieldRoles` (Task 1).
- Produces:
  - `interface LabelFieldCandidate { field: string; coverage: number; uniqueness: number; types: ScalarType[]; samples: string[] }`
  - `collectLabelFieldCandidates(values: Record<string, unknown>[]): LabelFieldCandidate[]`
  - `preferredLabelField(candidates: LabelFieldCandidate[]): string | undefined`
  - `isUsableLabelField(field: string | undefined, candidates: LabelFieldCandidate[]): boolean`
  - `describeObjectSchema(values: Record<string, unknown>[]): ObjectSchemaHint`
  - `PREFERRED_LABEL_FIELDS`
  - `interface PositionFieldCandidate { field: string; suggested: boolean }`
  - `detectPositionFields(entries: unknown[]): PositionFieldCandidate[]`
  - `preferredPositionField(entries: unknown[]): string | undefined`
  - `resolveRoles(entries: unknown[], previous?: FieldRoles): FieldRoles`

**Note on the move:** `sortFieldRules.ts` keeps its behaviour exactly. Only the vocabulary changes, because "sort field" meant two different things — the field we display, and an ordering. The old file and its test are deleted in this task, not in Task 11, because nothing else about them changes: their consumers are repointed in the same commit.

- [ ] **Step 1: Move the module and rename its vocabulary**

```bash
git mv lib/validation/sortFieldRules.ts lib/import/labelField.ts
git mv tests/unit/sortFieldRules.test.ts tests/unit/import/labelField.test.ts
```

In `lib/import/labelField.ts`, rename exactly these identifiers, leaving every function body unchanged:

- `SortFieldCandidate` → `LabelFieldCandidate`
- `collectSortFieldCandidates` → `collectLabelFieldCandidates`
- `preferredSortField` → `preferredLabelField`
- `isUsableSortField` → `isUsableLabelField`
- `PREFERRED_SORT_FIELDS` → `PREFERRED_LABEL_FIELDS`

`ScalarType`, `ObjectSchemaField`, `ObjectSchemaHint`, and `describeObjectSchema` keep their names. The import of `ComplexItemValue` from `@/types/list` stays as it is — that type survives Task 11.

Apply the same renames throughout `tests/unit/import/labelField.test.ts`, and repoint its import to `@/lib/import/labelField`.

- [ ] **Step 2: Repoint the existing consumers**

In `lib/state/selectors.ts`, replace the two import lines:

```ts
import { collectLabelFieldCandidates, describeObjectSchema } from '@/lib/import/labelField';
import type { LabelFieldCandidate, ObjectSchemaHint } from '@/lib/import/labelField';
```

and update the uses in that file: `collectSortFieldCandidates(` → `collectLabelFieldCandidates(`, and the return type `SortFieldCandidate[]` → `LabelFieldCandidate[]` on `selectSortFieldOptions`.

In `lib/validation/listSchemas.ts`, replace the import:

```ts
import { collectLabelFieldCandidates, preferredLabelField } from '@/lib/import/labelField';
```

and the last line of `detectSortField`:

```ts
  return preferredLabelField(collectLabelFieldCandidates(objects));
```

In `tests/component/SortFieldPicker.test.tsx`, repoint the import to `@/lib/import/labelField` and rename `collectSortFieldCandidates` to `collectLabelFieldCandidates`.

- [ ] **Step 3: Run the suite to verify the move changed no behaviour**

Run: `npm test && npm run typecheck`
Expected: PASS, with the same test count as before the move.

- [ ] **Step 4: Write the failing test for position fields**

Create `tests/unit/import/positionField.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { detectPositionFields, preferredPositionField } from '@/lib/import/positionField';

const ranked = [
  { title: 'Alien', year: 1979, order: 2 },
  { title: 'Arrival', year: 2016, order: 1 },
];

describe('detectPositionFields', () => {
  it('offers every field that is numeric everywhere it appears', () => {
    expect(detectPositionFields(ranked).map((entry) => entry.field)).toEqual(['year', 'order']);
  });

  it('leaves out text fields', () => {
    expect(detectPositionFields(ranked).some((entry) => entry.field === 'title')).toBe(false);
  });

  it('leaves out fields that are numeric in only some entries', () => {
    const patchy = [{ rank: 1 }, { rank: 'first' }];

    expect(detectPositionFields(patchy)).toEqual([]);
  });

  it('offers a field only some entries carry, as long as it is always numeric', () => {
    const partial = [{ title: 'Alien', order: 2 }, { title: 'Arrival' }];

    expect(detectPositionFields(partial).map((entry) => entry.field)).toEqual(['order']);
  });

  it('marks well-known ordering names as suggested', () => {
    const byField = new Map(detectPositionFields(ranked).map((entry) => [entry.field, entry]));

    expect(byField.get('order')?.suggested).toBe(true);
    expect(byField.get('year')?.suggested).toBe(false);
  });

  it('recognises rank, position, index, sort, priority, seq, and sequence', () => {
    const entries = [
      { rank: 1, position: 1, index: 1, sort: 1, priority: 1, seq: 1, sequence: 1 },
      { rank: 2, position: 2, index: 2, sort: 2, priority: 2, seq: 2, sequence: 2 },
    ];

    expect(detectPositionFields(entries).every((entry) => entry.suggested)).toBe(true);
  });

  it('offers nothing for scalar entries, which have nowhere to write', () => {
    expect(detectPositionFields(['Alien', 'Arrival'])).toEqual([]);
  });
});

describe('preferredPositionField', () => {
  it('picks a suggested field', () => {
    expect(preferredPositionField(ranked)).toBe('order');
  });

  it('picks nothing when no name looks like an ordering', () => {
    expect(preferredPositionField([{ year: 1979 }, { year: 2016 }])).toBeUndefined();
  });
});
```

- [ ] **Step 5: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/positionField.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/positionField"`.

- [ ] **Step 6: Implement position-field detection**

Create `lib/import/positionField.ts`:

```ts
/**
 * The optional second field role: which key receives the new rank on export.
 * Writing into the user's data is opt-in, so only names that plainly mean an
 * ordering are ever preselected.
 */

export interface PositionFieldCandidate {
  field: string;
  /** True when the name plainly means an ordering, so it can be preselected. */
  suggested: boolean;
}

const ORDERING_NAME = /^(order|rank|position|index|sort|priority|seq(uence)?)$/i;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * A field qualifies when every entry that carries it carries a number. Entries
 * missing the field are fine: export writes the rank into all of them.
 */
export function detectPositionFields(entries: unknown[]): PositionFieldCandidate[] {
  const objects = entries.filter(isPlainObject);
  if (objects.length === 0) return [];

  const fields: string[] = [];
  for (const entry of objects) {
    for (const field of Object.keys(entry)) {
      if (!fields.includes(field)) fields.push(field);
    }
  }

  return fields
    .filter((field) => {
      const present = objects.map((entry) => entry[field]).filter((value) => value !== undefined);
      return (
        present.length > 0 &&
        present.every((value) => typeof value === 'number' && Number.isFinite(value))
      );
    })
    .map((field) => ({ field, suggested: ORDERING_NAME.test(field) }));
}

export function preferredPositionField(entries: unknown[]): string | undefined {
  return detectPositionFields(entries).find((candidate) => candidate.suggested)?.field;
}
```

- [ ] **Step 7: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/positionField.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 8: Write the failing test for `resolveRoles`**

Create `tests/unit/import/roles.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { resolveRoles } from '@/lib/import/roles';

describe('resolveRoles', () => {
  it('preselects an obvious label field', () => {
    expect(resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }]).labelField).toBe('title');
  });

  it('leaves the label unset when the choice is ambiguous', () => {
    const roles = resolveRoles([
      { alpha: 'Alien', beta: 'Scott' },
      { alpha: 'Arrival', beta: 'Villeneuve' },
    ]);

    expect(roles.labelField).toBeUndefined();
  });

  it('preselects an ordering field', () => {
    const roles = resolveRoles([
      { title: 'Alien', order: 2 },
      { title: 'Arrival', order: 1 },
    ]);

    expect(roles).toEqual({ labelField: 'title', positionField: 'order' });
  });

  it('assigns no roles to scalar entries', () => {
    expect(resolveRoles(['Alien', 'Arrival'])).toEqual({});
  });

  it('keeps a previous label choice that still works', () => {
    const entries = [
      { alpha: 'Alien', beta: 'Scott' },
      { alpha: 'Arrival', beta: 'Villeneuve' },
    ];

    expect(resolveRoles(entries, { labelField: 'beta' }).labelField).toBe('beta');
  });

  it('drops a previous label choice the new data no longer has', () => {
    const roles = resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }], { labelField: 'gone' });

    expect(roles.labelField).toBe('title');
  });

  it('keeps a previous position field that still works', () => {
    const entries = [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
    ];

    expect(resolveRoles(entries, { positionField: 'year' }).positionField).toBe('year');
  });

  it('drops a previous position field the new data cannot carry', () => {
    const roles = resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }], {
      positionField: 'year',
    });

    expect(roles.positionField).toBeUndefined();
  });
});
```

- [ ] **Step 9: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/roles.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/roles"`.

- [ ] **Step 10: Implement `resolveRoles`**

Create `lib/import/roles.ts`:

```ts
import {
  collectLabelFieldCandidates,
  isUsableLabelField,
  preferredLabelField,
} from '@/lib/import/labelField';
import { detectPositionFields, preferredPositionField } from '@/lib/import/positionField';
import type { ComplexItemValue } from '@/types/list';
import type { FieldRoles } from '@/types/source';

function isPlainObject(value: unknown): value is ComplexItemValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * The roles the app would choose on its own. A previous choice wins whenever
 * the new data can still honour it, so re-importing edited text does not
 * silently relabel every card.
 */
export function resolveRoles(entries: unknown[], previous: FieldRoles = {}): FieldRoles {
  const objects = entries.filter(isPlainObject);
  if (objects.length === 0) return {};

  const labelCandidates = collectLabelFieldCandidates(objects);
  const labelField = isUsableLabelField(previous.labelField, labelCandidates)
    ? previous.labelField
    : preferredLabelField(labelCandidates);

  const keepsPosition = detectPositionFields(entries).some(
    (candidate) => candidate.field === previous.positionField,
  );
  const positionField = keepsPosition ? previous.positionField : preferredPositionField(entries);

  return {
    ...(labelField === undefined ? {} : { labelField }),
    ...(positionField === undefined ? {} : { positionField }),
  };
}
```

- [ ] **Step 11: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 12: Commit**

```bash
git add lib/import lib/state/selectors.ts lib/validation tests
git commit -m "feat: add label and position field roles"
```

---

### Task 5: Source-preserving export

**Files:**
- Create: `lib/export/buildExport.ts`, `lib/export/filenames.ts`
- Test: `tests/unit/export/buildExport.test.ts`, `tests/unit/export/filenames.test.ts`

**Interfaces:**
- Consumes: `DataSource`, `FieldRoles`, `SourceFormat` (Task 1); `ListItem` from `@/types/list`.
- Produces:
  - `setAtPath(document: unknown, path: string[], value: unknown): unknown`
  - `buildExportDocument(source: DataSource, roles: FieldRoles, entries: unknown[]): unknown`
  - `buildExport(source: DataSource, roles: FieldRoles, rankedItems: ListItem[], format: SourceFormat): string`
  - `slugify(name: string): string`
  - `extensionFor(format: SourceFormat): string`
  - `mimeTypeFor(format: SourceFormat): string`
  - `exportFilename(name: string, format: SourceFormat, at?: Date): string`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/export/buildExport.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { buildExport, buildExportDocument, setAtPath } from '@/lib/export/buildExport';
import type { ListItem } from '@/types/list';
import type { DataSource } from '@/types/source';

function item(id: string, value: unknown, active = true): ListItem {
  return {
    id,
    listId: 'list-1',
    value: value as ListItem['value'],
    active,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

const nestedSource: DataSource = {
  format: 'yaml',
  rawText: '',
  document: {
    version: 3,
    owner: 'david',
    movies: [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
    ],
    notes: 'personal picks',
  },
  arrayPath: ['movies'],
};

const ranked = [
  item('a', { title: 'Arrival', year: 2016 }),
  item('b', { title: 'Alien', year: 1979 }),
];

describe('setAtPath', () => {
  it('replaces a nested value without touching its siblings', () => {
    expect(setAtPath({ a: 1, b: { c: [1] } }, ['b', 'c'], [9])).toEqual({ a: 1, b: { c: [9] } });
  });

  it('replaces the whole document for an empty path', () => {
    expect(setAtPath({ a: 1 }, [], [9])).toEqual([9]);
  });

  it('does not mutate the input', () => {
    const input = { a: { b: [1] } };
    setAtPath(input, ['a', 'b'], [9]);

    expect(input).toEqual({ a: { b: [1] } });
  });
});

describe('buildExportDocument', () => {
  it('keeps every wrapper key, in order', () => {
    const result = buildExportDocument(nestedSource, {}, [{ title: 'Arrival' }]);

    expect(Object.keys(result as object)).toEqual(['version', 'owner', 'movies', 'notes']);
  });

  it('keeps sibling values untouched', () => {
    const result = buildExportDocument(nestedSource, {}, [{ title: 'Arrival' }]) as Record<
      string,
      unknown
    >;

    expect(result.version).toBe(3);
    expect(result.notes).toBe('personal picks');
  });

  it('writes the reordered entries at the array path', () => {
    const result = buildExportDocument(nestedSource, {}, [
      { title: 'Arrival', year: 2016 },
      { title: 'Alien', year: 1979 },
    ]) as { movies: { title: string }[] };

    expect(result.movies.map((entry) => entry.title)).toEqual(['Arrival', 'Alien']);
  });

  it('keeps fields the app never understood', () => {
    const result = buildExportDocument(nestedSource, {}, [
      { title: 'Arrival', year: 2016, cast: ['Amy Adams'], nested: { a: 1 } },
    ]) as { movies: Record<string, unknown>[] };

    expect(result.movies[0]).toEqual({
      title: 'Arrival',
      year: 2016,
      cast: ['Amy Adams'],
      nested: { a: 1 },
    });
  });

  it('rewrites an existing position field in place, keeping its key order', () => {
    const result = buildExportDocument(nestedSource, { positionField: 'order' }, [
      { title: 'Arrival', order: 7, year: 2016 },
      { title: 'Alien', order: 4, year: 1979 },
    ]) as { movies: Record<string, unknown>[] };

    expect(result.movies[0]).toEqual({ title: 'Arrival', order: 1, year: 2016 });
    expect(Object.keys(result.movies[0] ?? {})).toEqual(['title', 'order', 'year']);
    expect(result.movies[1]?.order).toBe(2);
  });

  it('appends a position field that did not exist', () => {
    const result = buildExportDocument(nestedSource, { positionField: 'rank' }, [
      { title: 'Arrival' },
    ]) as { movies: Record<string, unknown>[] };

    expect(Object.keys(result.movies[0] ?? {})).toEqual(['title', 'rank']);
  });

  it('leaves scalar entries alone even when a position field is set', () => {
    const listSource: DataSource = {
      format: 'list',
      rawText: '',
      document: ['Alien', 'Arrival'],
      arrayPath: [],
    };

    expect(
      buildExportDocument(listSource, { positionField: 'order' }, ['Arrival', 'Alien']),
    ).toEqual(['Arrival', 'Alien']);
  });
});

describe('buildExport', () => {
  it('serializes YAML with the wrapper intact', () => {
    const text = buildExport(nestedSource, {}, ranked, 'yaml');

    expect(text).toContain('version: 3');
    expect(text).toContain('notes: personal picks');
    expect(text.indexOf('Arrival')).toBeLessThan(text.indexOf('Alien'));
  });

  it('serializes JSON with two-space indentation', () => {
    const text = buildExport(nestedSource, {}, ranked, 'json');

    expect(text.startsWith('{\n  "version": 3,')).toBe(true);
  });

  it('serializes a plain list as one label per line', () => {
    const listSource: DataSource = {
      format: 'list',
      rawText: '',
      document: ['Alien', 'Arrival'],
      arrayPath: [],
    };
    const text = buildExport(listSource, {}, [item('a', 'Arrival'), item('b', 'Alien')], 'list');

    expect(text).toBe('Arrival\nAlien\n');
  });

  it('uses the label field when writing object entries as a plain list', () => {
    expect(buildExport(nestedSource, { labelField: 'title' }, ranked, 'list')).toBe(
      'Arrival\nAlien\n',
    );
  });

  it('excludes items removed during comparison', () => {
    const withRemoved = [...ranked, item('c', { title: 'Solaris' }, false)];

    expect(buildExport(nestedSource, {}, withRemoved, 'json')).not.toContain('Solaris');
  });

  it('is stable: the same inputs give the same text', () => {
    expect(buildExport(nestedSource, {}, ranked, 'yaml')).toBe(
      buildExport(nestedSource, {}, ranked, 'yaml'),
    );
  });

  it('never mutates the stored source document', () => {
    const before = JSON.stringify(nestedSource.document);
    buildExport(nestedSource, { positionField: 'order' }, ranked, 'json');

    expect(JSON.stringify(nestedSource.document)).toBe(before);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/export/buildExport.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/export/buildExport"`.

- [ ] **Step 3: Implement the exporter**

Create `lib/export/buildExport.ts`:

```ts
import { stringify as stringifyYaml } from 'yaml';

import type { ListItem } from '@/types/list';
import type { DataSource, FieldRoles, SourceFormat } from '@/types/source';

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** A structural copy, so the stored source document is never mutated. */
function clone<T>(value: T): T {
  if (Array.isArray(value)) return value.map(clone) as unknown as T;
  if (isPlainObject(value)) {
    const copy: Record<string, unknown> = {};
    for (const key of Object.keys(value)) copy[key] = clone(value[key]);
    return copy as T;
  }
  return value;
}

export function setAtPath(document: unknown, path: string[], value: unknown): unknown {
  if (path.length === 0) return value;

  const copy = clone(document);
  let current: unknown = copy;

  for (const key of path.slice(0, -1)) {
    if (!isPlainObject(current)) return copy;
    current = current[key];
  }

  const last = path[path.length - 1];
  if (isPlainObject(current) && last !== undefined) current[last] = value;

  return copy;
}

/**
 * The user's document back, with the ranked array spliced in at its own path.
 * Every other key, at every depth, survives exactly as it arrived.
 */
export function buildExportDocument(
  source: DataSource,
  roles: FieldRoles,
  entries: unknown[],
): unknown {
  const positioned = entries.map((entry, index) => {
    if (roles.positionField === undefined || !isPlainObject(entry)) return clone(entry);
    // Spread rewrites an existing key in place, so an existing `order` keeps
    // its position among the object's keys; a new one is appended.
    return { ...clone(entry), [roles.positionField]: index + 1 };
  });

  return setAtPath(source.document, source.arrayPath, positioned);
}

export function buildExport(
  source: DataSource,
  roles: FieldRoles,
  rankedItems: ListItem[],
  format: SourceFormat,
): string {
  const entries = rankedItems.filter((item) => item.active).map((item) => item.value);
  const document = buildExportDocument(source, roles, entries);

  switch (format) {
    case 'json':
      return `${JSON.stringify(document, null, 2)}\n`;
    case 'yaml':
      return stringifyYaml(document, { lineWidth: 0 });
    case 'list':
      return `${entries.map((entry) => labelOf(entry, roles.labelField)).join('\n')}\n`;
  }
}

function labelOf(entry: unknown, labelField: string | undefined): string {
  if (!isPlainObject(entry)) return String(entry);

  const preferred = labelField === undefined ? undefined : entry[labelField];
  if (typeof preferred === 'string' || typeof preferred === 'number') return String(preferred);

  const firstText = Object.values(entry).find((value) => typeof value === 'string');
  return typeof firstText === 'string' ? firstText : 'Untitled item';
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/export/buildExport.test.ts`
Expected: PASS, 17 tests.

- [ ] **Step 5: Write the failing test for filenames**

Create `tests/unit/export/filenames.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { exportFilename, extensionFor, mimeTypeFor, slugify } from '@/lib/export/filenames';

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('Favorite Sci-Fi Films')).toBe('favorite-sci-fi-films');
  });

  it('strips punctuation and collapses runs', () => {
    expect(slugify('  Best!! films???  ')).toBe('best-films');
  });

  it('falls back for a name with nothing usable', () => {
    expect(slugify('!!!')).toBe('list');
  });
});

describe('exportFilename', () => {
  it('joins slug, date, and extension', () => {
    expect(exportFilename('Sci-fi films', 'yaml', new Date('2026-08-16T12:00:00.000Z'))).toBe(
      'sci-fi-films-2026-08-16.yaml',
    );
  });

  it('uses txt for a plain list', () => {
    expect(exportFilename('Sci-fi films', 'list', new Date('2026-08-16T12:00:00.000Z'))).toBe(
      'sci-fi-films-2026-08-16.txt',
    );
  });
});

describe('extensionFor and mimeTypeFor', () => {
  it('maps every format', () => {
    expect(extensionFor('json')).toBe('json');
    expect(extensionFor('yaml')).toBe('yaml');
    expect(extensionFor('list')).toBe('txt');
    expect(mimeTypeFor('json')).toBe('application/json');
    expect(mimeTypeFor('yaml')).toBe('application/yaml');
    expect(mimeTypeFor('list')).toBe('text/plain');
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/export/filenames.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/export/filenames"`.

- [ ] **Step 7: Implement the filename helpers**

Create `lib/export/filenames.ts`:

```ts
import type { SourceFormat } from '@/types/source';

const EXTENSIONS: Record<SourceFormat, string> = {
  yaml: 'yaml',
  json: 'json',
  list: 'txt',
};

const MIME_TYPES: Record<SourceFormat, string> = {
  yaml: 'application/yaml',
  json: 'application/json',
  list: 'text/plain',
};

export function extensionFor(format: SourceFormat): string {
  return EXTENSIONS[format];
}

export function mimeTypeFor(format: SourceFormat): string {
  return MIME_TYPES[format];
}

export function slugify(name: string): string {
  const slug = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug === '' ? 'list' : slug;
}

/** e.g. `favorite-sci-fi-films-2026-08-16.yaml` */
export function exportFilename(name: string, format: SourceFormat, at: Date = new Date()): string {
  return `${slugify(name)}-${at.toISOString().slice(0, 10)}.${extensionFor(format)}`;
}
```

- [ ] **Step 8: Run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add lib/export tests/unit/export
git commit -m "feat: export the user's own document with the ranked array spliced in"
```

---

### Task 6: Diffing a re-import against the live ranking

**Files:**
- Create: `lib/import/deepEqual.ts`, `lib/import/diff.ts`
- Test: `tests/unit/import/diff.test.ts`

**Interfaces:**
- Consumes: `ListItem` from `@/types/list`, `ComparisonEvent` from `@/types/ranking`.
- Produces:
  - `deepEqual(a: unknown, b: unknown): boolean`
  - `interface ImportDiff { kept: { item: ListItem; entry: unknown }[]; added: unknown[]; removed: ListItem[]; keptComparisons: number }`
  - `diffImport(existingItems: ListItem[], nextEntries: unknown[], events?: ComparisonEvent[]): ImportDiff`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/import/diff.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { deepEqual } from '@/lib/import/deepEqual';
import { diffImport } from '@/lib/import/diff';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

function item(id: string, value: unknown, active = true): ListItem {
  return {
    id,
    listId: 'list-1',
    value: value as ListItem['value'],
    active,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

function event(leftItemId: string, rightItemId: string): ComparisonEvent {
  return {
    id: `${leftItemId}-${rightItemId}`,
    listId: 'list-1',
    leftItemId,
    rightItemId,
    outcome: 'left',
    createdAt: '2026-08-16T00:00:00.000Z',
  };
}

describe('deepEqual', () => {
  it('compares scalars', () => {
    expect(deepEqual('Alien', 'Alien')).toBe(true);
    expect(deepEqual('Alien', 'Arrival')).toBe(false);
  });

  it('compares objects regardless of key order', () => {
    expect(deepEqual({ a: 1, b: 2 }, { b: 2, a: 1 })).toBe(true);
  });

  it('compares nested arrays and objects', () => {
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 1 }] })).toBe(true);
    expect(deepEqual({ a: [{ b: 1 }] }, { a: [{ b: 2 }] })).toBe(false);
  });

  it('treats a missing key as different from an undefined one', () => {
    expect(deepEqual({ a: 1 }, { a: 1, b: undefined })).toBe(false);
  });
});

describe('diffImport', () => {
  it('keeps every item when nothing changed', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Alien' }, { title: 'Arrival' }]);

    expect(diff.kept.map((entry) => entry.item.id)).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
    expect(diff.removed).toEqual([]);
  });

  it('keeps items whose position moved', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Arrival' }, { title: 'Alien' }]);

    expect(diff.kept.map((entry) => entry.item.id).sort()).toEqual(['a', 'b']);
    expect(diff.added).toEqual([]);
  });

  it('reports new entries', () => {
    const diff = diffImport([item('a', { title: 'Alien' })], [
      { title: 'Alien' },
      { title: 'Solaris' },
    ]);

    expect(diff.added).toEqual([{ title: 'Solaris' }]);
  });

  it('reports entries that disappeared', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];
    const diff = diffImport(items, [{ title: 'Alien' }]);

    expect(diff.removed.map((entry) => entry.id)).toEqual(['b']);
  });

  it('treats an edited field as a removal plus an addition', () => {
    const diff = diffImport([item('a', { title: 'Alien', year: 1979 })], [
      { title: 'Alien', year: 1980 },
    ]);

    expect(diff.kept).toEqual([]);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['a']);
    expect(diff.added).toEqual([{ title: 'Alien', year: 1980 }]);
  });

  it('matches duplicates by position among equals', () => {
    const items = [item('a', 'Alien'), item('b', 'Alien'), item('c', 'Arrival')];
    const diff = diffImport(items, ['Alien', 'Arrival']);

    expect(diff.kept.map((entry) => entry.item.id)).toEqual(['a', 'c']);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['b']);
  });

  it('ignores items already removed during comparison', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival', false)];
    const diff = diffImport(items, ['Alien']);

    expect(diff.removed).toEqual([]);
  });

  it('reports a wholesale replacement without special-casing it', () => {
    const diff = diffImport([item('a', 'Alien')], ['Solaris', 'Stalker']);

    expect(diff.kept).toEqual([]);
    expect(diff.added).toHaveLength(2);
    expect(diff.removed.map((entry) => entry.id)).toEqual(['a']);
  });

  it('counts the comparisons that survive', () => {
    const items = [item('a', 'Alien'), item('b', 'Arrival'), item('c', 'Solaris')];
    const events = [event('a', 'b'), event('a', 'c'), event('b', 'c')];
    const diff = diffImport(items, ['Alien', 'Arrival'], events);

    expect(diff.keptComparisons).toBe(1);
  });

  it('counts no comparisons when none were passed', () => {
    expect(diffImport([item('a', 'Alien')], ['Alien']).keptComparisons).toBe(0);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/diff.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/deepEqual"`.

- [ ] **Step 3: Implement structural equality**

Create `lib/import/deepEqual.ts`:

```ts
/** Structural equality, used to recognise an entry the user did not edit. */
export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;

  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
    return a.every((entry, index) => deepEqual(entry, b[index]));
  }

  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;

  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;

  return leftKeys.every(
    (key) => Object.prototype.hasOwnProperty.call(right, key) && deepEqual(left[key], right[key]),
  );
}
```

- [ ] **Step 4: Implement the diff**

Create `lib/import/diff.ts`:

```ts
import { deepEqual } from '@/lib/import/deepEqual';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

export interface ImportDiff {
  /** Entries matched to a live item, which therefore keeps its ranking. */
  kept: { item: ListItem; entry: unknown }[];
  added: unknown[];
  removed: ListItem[];
  /** Rated comparisons with both endpoints still in the list. */
  keptComparisons: number;
}

/**
 * Matches re-imported entries to live items by value, greedily and in order,
 * consuming each item at most once so duplicates match by position among
 * equals. Matched entries keep their item id, and that is what preserves the
 * comparison events pointing at them.
 */
export function diffImport(
  existingItems: ListItem[],
  nextEntries: unknown[],
  events: ComparisonEvent[] = [],
): ImportDiff {
  const pool = existingItems.filter((item) => item.active);
  const claimed = new Set<string>();

  const kept: ImportDiff['kept'] = [];
  const added: unknown[] = [];

  for (const entry of nextEntries) {
    const match = pool.find((item) => !claimed.has(item.id) && deepEqual(item.value, entry));
    if (match === undefined) {
      added.push(entry);
      continue;
    }
    claimed.add(match.id);
    kept.push({ item: match, entry });
  }

  const removed = pool.filter((item) => !claimed.has(item.id));
  const keptComparisons = events.filter(
    (event) =>
      event.outcome !== 'skip' && claimed.has(event.leftItemId) && claimed.has(event.rightItemId),
  ).length;

  return { kept, added, removed, keptComparisons };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/diff.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Run the suite**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add lib/import/deepEqual.ts lib/import/diff.ts tests/unit/import/diff.test.ts
git commit -m "feat: preserve rankings for entries unchanged by a re-import"
```

---

### Task 7: Version 2 persistence

**Files:**
- Create: `lib/persistence/workspaceSnapshot.ts`, `lib/persistence/workspaceStorage.ts`
- Test: `tests/unit/persistence/workspaceSnapshot.test.ts`, `tests/unit/persistence/workspaceStorage.test.ts`

**These are new files sitting beside the old ones.** `types/workspace.ts`, `lib/persistence/browserStorage.ts`, and `lib/validation/workspaceSchema.ts` are left untouched so the existing app keeps compiling; Task 11 deletes all three once nothing imports them.

**Interfaces:**
- Consumes: `Workspace`, `DataSource`, `FieldRoles`, `PreviewTab` (Task 1).
- Produces, from `lib/persistence/workspaceSnapshot.ts`:
  - `WORKSPACE_VERSION = 2`
  - `interface WorkspaceUiState { previewTab: PreviewTab }`
- Produces, from `lib/persistence/workspaceStorage.ts`:
  - `WORKSPACE_STORAGE_KEY = 'pairwise-list-ranker:workspace:v2'`
  - `LEGACY_STORAGE_KEYS = ['pairwise-list-ranker:workspace:v1']`
  - `interface WorkspaceSnapshot { version: number; workspace: Workspace; items: ListItem[]; comparisonEvents: ComparisonEvent[]; ui: { previewTab: PreviewTab } }`
  - `parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null`
  - `type SaveOutcome = 'saved' | 'too-large' | 'unavailable'`
  - `WorkspaceStorage.save(snapshot): SaveOutcome`
  - `WorkspaceStorage.load(): WorkspaceSnapshot | null`
  - `WorkspaceStorage.clear(): void`
  - `MAX_SNAPSHOT_BYTES = 4_000_000`

**Note:** v1 snapshots hold no source document, so there is nothing to reconstruct an export from. They are dropped, and the legacy key is deleted on first load so it does not sit in storage forever.

- [ ] **Step 1: Write the failing test for the snapshot schema**

Create `tests/unit/persistence/workspaceSnapshot.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';

const valid = {
  version: 2,
  workspace: {
    id: 'ws-1',
    name: 'Sci-fi films',
    source: {
      format: 'yaml',
      rawText: 'movies:\n  - title: Alien\n',
      document: { movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
      arrayPath: ['movies'],
    },
    roles: { labelField: 'title' },
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  },
  items: [
    {
      id: 'item-1',
      listId: 'ws-1',
      value: { title: 'Alien' },
      active: true,
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    },
  ],
  comparisonEvents: [],
  ui: { previewTab: 'ranked' },
};

describe('parseWorkspaceSnapshot', () => {
  it('accepts a well-formed v2 snapshot', () => {
    expect(parseWorkspaceSnapshot(valid)?.workspace.name).toBe('Sci-fi films');
  });

  it('keeps an arbitrary source document untouched', () => {
    const wild = {
      ...valid,
      workspace: {
        ...valid.workspace,
        source: { ...valid.workspace.source, document: { a: [1, { b: null }], c: true } },
      },
    };

    expect(parseWorkspaceSnapshot(wild)?.workspace.source.document).toEqual({
      a: [1, { b: null }],
      c: true,
    });
  });

  it('rejects a v1 snapshot, which has no source document', () => {
    const v1 = {
      version: 1,
      list: { id: 'l', title: 't', kind: 'primitive', createdAt: '', updatedAt: '' },
      items: [],
      comparisonEvents: [],
      ui: { previewMode: 'gui', editorDrafts: {} },
    };

    expect(parseWorkspaceSnapshot(v1)).toBeNull();
  });

  it('rejects a snapshot from a newer version', () => {
    expect(parseWorkspaceSnapshot({ ...valid, version: 99 })).toBeNull();
  });

  it('rejects a snapshot missing the array path', () => {
    const broken = {
      ...valid,
      workspace: { ...valid.workspace, source: { ...valid.workspace.source, arrayPath: undefined } },
    };

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('rejects an unknown source format', () => {
    const broken = {
      ...valid,
      workspace: { ...valid.workspace, source: { ...valid.workspace.source, format: 'toml' } },
    };

    expect(parseWorkspaceSnapshot(broken)).toBeNull();
  });

  it('rejects junk', () => {
    expect(parseWorkspaceSnapshot('nope')).toBeNull();
    expect(parseWorkspaceSnapshot(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/persistence/workspaceSnapshot.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/persistence/workspaceSnapshot"`.

- [ ] **Step 3: Implement the snapshot type and schema**

Create `lib/persistence/workspaceSnapshot.ts`. The v2 snapshot type lives here rather than in `types/workspace.ts`, so the old type keeps serving the old store until Task 11 deletes both:

```ts
import { z } from 'zod';

import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';
import type { PreviewTab, Workspace } from '@/types/source';

/** Bump when the persisted shape changes so stale snapshots are dropped. */
export const WORKSPACE_VERSION = 2;

export interface WorkspaceUiState {
  previewTab: PreviewTab;
}

export interface WorkspaceSnapshot {
  version: number;
  workspace: Workspace;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  ui: WorkspaceUiState;
}

const itemValueSchema = z.union([
  z.string(),
  z.custom<Record<string, unknown>>(
    (value) => typeof value === 'object' && value !== null && !Array.isArray(value),
  ),
]);

/**
 * The source document is the user's, so it is stored and restored as-is. Only
 * the app's own annotations around it are validated.
 */
const dataSourceSchema = z.object({
  format: z.enum(['list', 'yaml', 'json']),
  rawText: z.string(),
  document: z.unknown(),
  arrayPath: z.array(z.string()),
});

const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string(),
  source: dataSourceSchema,
  roles: z.object({
    labelField: z.string().optional(),
    positionField: z.string().optional(),
  }),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const listItemSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  value: itemValueSchema,
  active: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

const comparisonEventSchema = z.object({
  id: z.string().min(1),
  listId: z.string().min(1),
  leftItemId: z.string().min(1),
  rightItemId: z.string().min(1),
  outcome: z.enum(['left', 'right', 'left_strong', 'right_strong', 'skip']),
  createdAt: z.string(),
});

export const workspaceSnapshotSchema = z.object({
  version: z.number().int().positive(),
  workspace: workspaceSchema,
  items: z.array(listItemSchema),
  comparisonEvents: z.array(comparisonEventSchema),
  ui: z.object({ previewTab: z.enum(['ranked', 'list', 'yaml', 'json']) }),
});

/**
 * Returns null for anything we cannot safely restore. Persisted state is a
 * convenience, so failing to read it must never break the app. Version 1
 * snapshots hold no source document and are therefore unrecoverable.
 */
export function parseWorkspaceSnapshot(input: unknown): WorkspaceSnapshot | null {
  const result = workspaceSnapshotSchema.safeParse(input);
  if (!result.success) return null;
  if (result.data.version !== WORKSPACE_VERSION) return null;
  return result.data as WorkspaceSnapshot;
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/persistence/workspaceSnapshot.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Write the failing test for storage**

Create `tests/unit/persistence/workspaceStorage.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  LEGACY_STORAGE_KEYS,
  MAX_SNAPSHOT_BYTES,
  WORKSPACE_STORAGE_KEY,
  createWorkspaceStorage,
} from '@/lib/persistence/workspaceStorage';
import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';

function memoryBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

function snapshot(rawText = 'Alien\nArrival\n'): WorkspaceSnapshot {
  return {
    version: 2,
    workspace: {
      id: 'ws-1',
      name: 'Films',
      source: { format: 'list', rawText, document: ['Alien', 'Arrival'], arrayPath: [] },
      roles: {},
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    },
    items: [],
    comparisonEvents: [],
    ui: { previewTab: 'ranked' },
  };
}

describe('createWorkspaceStorage', () => {
  let backend: ReturnType<typeof memoryBackend>;

  beforeEach(() => {
    backend = memoryBackend();
  });

  it('round-trips a snapshot', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());

    expect(storage.load()?.workspace.name).toBe('Films');
  });

  it('reports that it saved', () => {
    expect(createWorkspaceStorage(backend).save(snapshot())).toBe('saved');
  });

  it('is unavailable with no backend', () => {
    const storage = createWorkspaceStorage(null);

    expect(storage.available).toBe(false);
    expect(storage.save(snapshot())).toBe('unavailable');
    expect(storage.load()).toBeNull();
  });

  it('skips snapshots too large for storage, without throwing', () => {
    const storage = createWorkspaceStorage(backend);
    const huge = snapshot('x'.repeat(MAX_SNAPSHOT_BYTES));

    expect(storage.save(huge)).toBe('too-large');
    expect(backend.data.has(WORKSPACE_STORAGE_KEY)).toBe(false);
  });

  it('keeps an earlier good save when a later one is too large', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());
    storage.save(snapshot('x'.repeat(MAX_SNAPSHOT_BYTES)));

    expect(storage.load()?.workspace.name).toBe('Films');
  });

  it('reports too-large when the backend rejects the write', () => {
    const failing: StorageLike = {
      getItem: () => null,
      setItem: vi.fn(() => {
        throw new Error('QuotaExceededError');
      }),
      removeItem: () => {},
    };

    // The probe write fails too, so the storage reports itself unavailable
    // rather than pretending it can save.
    expect(createWorkspaceStorage(failing).available).toBe(false);
  });

  it('returns null for malformed stored text', () => {
    backend.data.set(WORKSPACE_STORAGE_KEY, '{not json');

    expect(createWorkspaceStorage(backend).load()).toBeNull();
  });

  it('drops a v1 snapshot and deletes its key', () => {
    backend.data.set(LEGACY_STORAGE_KEYS[0] ?? '', JSON.stringify({ version: 1 }));
    const storage = createWorkspaceStorage(backend);

    expect(storage.load()).toBeNull();
    expect(backend.data.has(LEGACY_STORAGE_KEYS[0] ?? '')).toBe(false);
  });

  it('clears the saved snapshot', () => {
    const storage = createWorkspaceStorage(backend);
    storage.save(snapshot());
    storage.clear();

    expect(storage.load()).toBeNull();
  });
});
```

- [ ] **Step 6: Run the test to verify it fails**

Run: `npx vitest run tests/unit/persistence/workspaceStorage.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/persistence/workspaceStorage"`.

- [ ] **Step 7: Implement the storage adapter**

Create `lib/persistence/workspaceStorage.ts`:

```ts
import { parseWorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';

export const WORKSPACE_STORAGE_KEY = 'pairwise-list-ranker:workspace:v2';

/** Keys from shapes we can no longer read. Deleted on first load. */
export const LEGACY_STORAGE_KEYS = ['pairwise-list-ranker:workspace:v1'] as const;

/**
 * Below the usual 5MB localStorage budget, with room for the browser's own
 * overhead. We now store the raw text and the parsed document, so a very large
 * import can realistically reach this.
 */
export const MAX_SNAPSHOT_BYTES = 4_000_000;

const PROBE_KEY = 'pairwise-list-ranker:probe';

/** The slice of the Web Storage API we depend on. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export type SaveOutcome = 'saved' | 'too-large' | 'unavailable';

export interface WorkspaceStorage {
  /** False in private modes, SSR/static rendering, or when storage is blocked. */
  readonly available: boolean;
  load(): WorkspaceSnapshot | null;
  save(snapshot: WorkspaceSnapshot): SaveOutcome;
  clear(): void;
}

/** localStorage when the browser allows it, otherwise null (memory-only mode). */
export function defaultBackend(): StorageLike | null {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    // Some browsers throw on property access when storage is disabled.
    return null;
  }
}

export function createWorkspaceStorage(
  backend: StorageLike | null = defaultBackend(),
): WorkspaceStorage {
  const available = backend !== null && probe(backend);

  return {
    available,

    load() {
      if (!available || backend === null) return null;

      for (const key of LEGACY_STORAGE_KEYS) {
        try {
          backend.removeItem(key);
        } catch {
          // Nothing to do; the legacy key is unreadable anyway.
        }
      }

      try {
        const raw = backend.getItem(WORKSPACE_STORAGE_KEY);
        if (raw === null) return null;
        return parseWorkspaceSnapshot(JSON.parse(raw));
      } catch {
        return null;
      }
    },

    save(snapshot: WorkspaceSnapshot) {
      if (!available || backend === null) return 'unavailable';

      const serialized = JSON.stringify(snapshot);
      // Checking first keeps a previous good save intact rather than letting a
      // partial write or a quota error replace it.
      if (serialized.length > MAX_SNAPSHOT_BYTES) return 'too-large';

      try {
        backend.setItem(WORKSPACE_STORAGE_KEY, serialized);
        return 'saved';
      } catch {
        // Out of quota or storage revoked mid-session: keep working in memory.
        return 'too-large';
      }
    },

    clear() {
      if (!available || backend === null) return;
      try {
        backend.removeItem(WORKSPACE_STORAGE_KEY);
      } catch {
        // The in-memory workspace is still authoritative.
      }
    },
  };
}

function probe(backend: StorageLike): boolean {
  try {
    backend.setItem(PROBE_KEY, '1');
    backend.removeItem(PROBE_KEY);
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 8: Run the persistence tests**

Run: `npx vitest run tests/unit/persistence/`
Expected: PASS. The three files coexist: the old `browserStorage.test.ts` still passes against the old adapter, which Task 11 deletes.

- [ ] **Step 9: Run the whole suite**

Run: `npm test && npm run typecheck`
Expected: PASS. Nothing imports the new modules yet, and the old ones are untouched.

- [ ] **Step 10: Commit**

```bash
git add lib/persistence tests/unit/persistence
git commit -m "feat: store the source document in a version 2 snapshot"
```

---

### Task 8: The three field pickers

**Files:**
- Create: `lib/import/readiness.ts`, `components/data/ArrayPicker.tsx`, `components/data/PositionPicker.tsx`
- Move: `components/lists/SortFieldPicker.tsx` → `components/data/LabelPicker.tsx`
- Modify: `app/index.tsx` (import path only), `tests/component/SortFieldPicker.test.tsx` → `tests/component/LabelPicker.test.tsx`
- Test: `tests/unit/import/readiness.test.ts`, `tests/component/ArrayPicker.test.tsx`, `tests/component/PositionPicker.test.tsx`

**Interfaces:**
- Consumes: `ArrayCandidate`, `MIN_RANKABLE`, `formatPath` (Task 3); `LabelFieldCandidate`, `ObjectSchemaHint`, `PositionFieldCandidate` (Task 4); `FieldRoles` (Task 1).
- Produces:
  - `interface ReadinessInput { candidates: ArrayCandidate[]; selectedPath: string[] | null; entries: unknown[]; roles: FieldRoles; hasIssues: boolean }`
  - `interface Readiness { ready: boolean; reason?: string }`
  - `describeReadiness(input: ReadinessInput): Readiness`
  - `<ArrayPicker candidates value onChange />` — `value: string[] | null`, `onChange: (path: string[]) => void`
  - `<LabelPicker candidates schema value onChange />` — `onChange: (field: string) => void`
  - `<PositionPicker candidates value onChange />` — `onChange: (field: string | undefined) => void`

These components are presentational: they take props and report choices. No store access, so Task 11 can wire them without touching them.

- [ ] **Step 1: Write the failing test for readiness**

Create `tests/unit/import/readiness.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { describeReadiness } from '@/lib/import/readiness';

const candidate: ArrayCandidate = {
  path: ['movies'],
  count: 2,
  entryKind: 'object',
  samples: ['Alien', 'Arrival'],
};

const base = {
  candidates: [candidate],
  selectedPath: ['movies'],
  entries: [{ title: 'Alien' }, { title: 'Arrival' }],
  roles: { labelField: 'title' },
  hasIssues: false,
};

describe('describeReadiness', () => {
  it('is ready when a list, a label, and two items are all present', () => {
    expect(describeReadiness(base)).toEqual({ ready: true });
  });

  it('blocks while the text has parse errors', () => {
    const result = describeReadiness({ ...base, hasIssues: true });

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/fix the/i);
  });

  it('blocks when nothing rankable was found', () => {
    const result = describeReadiness({ ...base, candidates: [], selectedPath: null, entries: [] });

    expect(result.reason).toMatch(/no list to rank/i);
  });

  it('blocks until one of several lists is chosen', () => {
    const result = describeReadiness({
      ...base,
      candidates: [candidate, { ...candidate, path: ['actors'] }],
      selectedPath: null,
      entries: [],
    });

    expect(result.reason).toMatch(/choose which list/i);
  });

  it('blocks a one-item list', () => {
    const result = describeReadiness({ ...base, entries: [{ title: 'Alien' }] });

    expect(result.reason).toMatch(/at least two items/i);
  });

  it('blocks object entries with no label field chosen', () => {
    const result = describeReadiness({ ...base, roles: {} });

    expect(result.reason).toMatch(/which field should title/i);
  });

  it('needs no label field for scalar entries', () => {
    expect(
      describeReadiness({ ...base, entries: ['Alien', 'Arrival'], roles: {} }),
    ).toEqual({ ready: true });
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/import/readiness.test.ts`
Expected: FAIL — `Failed to resolve import "@/lib/import/readiness"`.

- [ ] **Step 3: Implement readiness**

Create `lib/import/readiness.ts`:

```ts
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { MIN_RANKABLE } from '@/lib/import/arrayCandidates';
import type { FieldRoles } from '@/types/source';

export interface ReadinessInput {
  candidates: ArrayCandidate[];
  selectedPath: string[] | null;
  entries: unknown[];
  roles: FieldRoles;
  hasIssues: boolean;
}

export interface Readiness {
  ready: boolean;
  /** Why the primary action is disabled, phrased as the next thing to do. */
  reason?: string;
}

/**
 * The one place that decides whether ranking can start, so the CTA and its
 * explanation never disagree.
 */
export function describeReadiness(input: ReadinessInput): Readiness {
  const { candidates, selectedPath, entries, roles, hasIssues } = input;

  if (hasIssues) {
    return { ready: false, reason: 'Fix the errors above to continue.' };
  }

  if (candidates.length === 0) {
    return {
      ready: false,
      reason: 'No list to rank was found. Try another format, or paste one item per line.',
    };
  }

  if (selectedPath === null) {
    return { ready: false, reason: 'Choose which list to rank.' };
  }

  if (entries.length < MIN_RANKABLE) {
    return { ready: false, reason: 'A ranking needs at least two items.' };
  }

  const hasObjectEntries = entries.some(
    (entry) => typeof entry === 'object' && entry !== null && !Array.isArray(entry),
  );
  if (hasObjectEntries && roles.labelField === undefined) {
    return { ready: false, reason: 'Choose which field should title each card.' };
  }

  return { ready: true };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/unit/import/readiness.test.ts`
Expected: PASS, 7 tests.

- [ ] **Step 5: Move the label picker**

```bash
git mv components/lists/SortFieldPicker.tsx components/data/LabelPicker.tsx
git mv tests/component/SortFieldPicker.test.tsx tests/component/LabelPicker.test.tsx
```

In `components/data/LabelPicker.tsx`, rename `SortFieldPicker` to `LabelPicker`, `SortFieldPickerProps` to `LabelPickerProps`, and the `SortFieldCandidate` type import to `LabelFieldCandidate` from `@/lib/import/labelField`. Everything else — the markup, the `Label items by X` accessible labels, the styles — stays exactly as it is.

Apply the same renames in `tests/component/LabelPicker.test.tsx`.

In `app/index.tsx`, change the import to `import { LabelPicker } from '@/components/data/LabelPicker';` and the JSX tag from `<SortFieldPicker` to `<LabelPicker`. The props are unchanged.

- [ ] **Step 6: Verify the move changed nothing**

Run: `npm test && npm run typecheck`
Expected: PASS, same test count as before.

- [ ] **Step 7: Write the failing tests for the two new pickers**

Create `tests/component/ArrayPicker.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ArrayPicker } from '@/components/data/ArrayPicker';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';

const movies: ArrayCandidate = {
  path: ['movies'],
  count: 12,
  entryKind: 'object',
  samples: ['Alien', 'Arrival'],
};
const actors: ArrayCandidate = {
  path: ['actors'],
  count: 4,
  entryKind: 'scalar',
  samples: ['Sigourney Weaver'],
};

describe('ArrayPicker', () => {
  it('offers each candidate with its size and shape', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    expect(screen.getByText(/12 objects/i)).toBeDefined();
    expect(screen.getByText(/4 texts/i)).toBeDefined();
  });

  it('previews what the entries look like', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByText(/Alien · Arrival/)).toBeDefined();
  });

  it('reports the chosen path', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<ArrayPicker candidates={[movies, actors]} value={null} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(onChange).toHaveBeenCalledWith(['actors']);
  });

  it('marks the current choice', () => {
    render(<ArrayPicker candidates={[movies, actors]} value={['movies']} onChange={vi.fn()} />);

    expect(
      screen.getByRole('radio', { name: /rank the list at movies/i }).getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('asks nothing when there is only one candidate', () => {
    const { container } = render(
      <ArrayPicker candidates={[movies]} value={['movies']} onChange={vi.fn()} />,
    );

    expect(container.textContent).toBe('');
  });

  it('names a bare-array document readably', () => {
    const bare: ArrayCandidate = { path: [], count: 3, entryKind: 'scalar', samples: ['a'] };
    render(<ArrayPicker candidates={[bare, actors]} value={null} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /rank the list at the list/i })).toBeDefined();
  });
});
```

Create `tests/component/PositionPicker.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PositionPicker } from '@/components/data/PositionPicker';

const candidates = [
  { field: 'order', suggested: true },
  { field: 'year', suggested: false },
];

describe('PositionPicker', () => {
  it('offers each numeric field plus a none option', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(screen.getByRole('radio', { name: /write the new order into order/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /write the new order into year/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /do not write the order into any field/i })).toBeDefined();
  });

  it('reports the chosen field', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PositionPicker candidates={candidates} onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /write the new order into year/i }));

    expect(onChange).toHaveBeenCalledWith('year');
  });

  it('reports clearing the choice', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PositionPicker candidates={candidates} value="order" onChange={onChange} />);

    await user.click(screen.getByRole('radio', { name: /do not write the order into any field/i }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it('selects none when no field is chosen', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(
      screen
        .getByRole('radio', { name: /do not write the order into any field/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('says the choice is optional', () => {
    render(<PositionPicker candidates={candidates} onChange={vi.fn()} />);

    expect(screen.getByText(/optional/i)).toBeDefined();
  });

  it('renders nothing when there is nowhere to write', () => {
    const { container } = render(<PositionPicker candidates={[]} onChange={vi.fn()} />);

    expect(container.textContent).toBe('');
  });
});
```

- [ ] **Step 8: Run the tests to verify they fail**

Run: `npx vitest run tests/component/ArrayPicker.test.tsx tests/component/PositionPicker.test.tsx`
Expected: FAIL — neither component module resolves.

- [ ] **Step 9: Implement the array picker**

Create `components/data/ArrayPicker.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatPath } from '@/lib/import/arrayCandidates';
import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ArrayPickerProps {
  candidates: ArrayCandidate[];
  value: string[] | null;
  onChange: (path: string[]) => void;
}

/**
 * Only asked when the document holds more than one rankable list. A single
 * candidate is chosen for the user, so the common case shows no control.
 */
export function ArrayPicker({ candidates, value, onChange }: ArrayPickerProps) {
  if (candidates.length < 2) return null;

  const selectedKey = value === null ? null : value.join('.');

  return (
    <View style={styles.group} role="radiogroup" aria-label="Which list to rank">
      <Text style={styles.heading}>Rank which list?</Text>

      {candidates.map((candidate) => {
        const key = candidate.path.join('.');
        const selected = key === selectedKey;

        return (
          <Pressable
            key={key}
            role="radio"
            accessibilityLabel={`Rank the list at ${formatPath(candidate.path)}`}
            aria-checked={selected}
            onPress={() => onChange(candidate.path)}
            style={[styles.option, selected && styles.optionSelected]}
          >
            <View style={styles.header}>
              <Text style={[styles.path, selected && styles.pathSelected]}>
                {formatPath(candidate.path)}
              </Text>
              <Text style={styles.count}>
                {`${candidate.count} ${candidate.entryKind === 'object' ? 'objects' : 'texts'}`}
              </Text>
            </View>
            <Text style={styles.samples} numberOfLines={1}>
              {candidate.samples.join(' · ')}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  option: {
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  path: { fontFamily: fonts.mono, fontSize: 13, fontWeight: '600', color: colors.textPrimary },
  pathSelected: { color: colors.accentStrong },
  count: { fontFamily: fonts.body, fontSize: 11, color: colors.textSecondary },
  samples: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
});
```

- [ ] **Step 10: Implement the position picker**

Create `components/data/PositionPicker.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { PositionFieldCandidate } from '@/lib/import/positionField';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface PositionPickerProps {
  candidates: PositionFieldCandidate[];
  value?: string;
  onChange: (field: string | undefined) => void;
}

/**
 * The optional second role: a field to rewrite with 1..N on export. Opt-in,
 * because writing into the user's data is a bigger promise than reordering it.
 */
export function PositionPicker({ candidates, value, onChange }: PositionPickerProps) {
  if (candidates.length === 0) return null;

  return (
    <View style={styles.group} role="radiogroup" aria-label="Where to write the new order">
      <Text style={styles.heading}>Write the new order into</Text>
      <Text style={styles.hint}>Optional. The order of the list carries the ranking either way.</Text>

      <View style={styles.options}>
        <Pressable
          role="radio"
          accessibilityLabel="Do not write the order into any field"
          aria-checked={value === undefined}
          onPress={() => onChange(undefined)}
          style={[styles.option, value === undefined && styles.optionSelected]}
        >
          <Text style={[styles.field, value === undefined && styles.fieldSelected]}>None</Text>
        </Pressable>

        {candidates.map((candidate) => {
          const selected = candidate.field === value;

          return (
            <Pressable
              key={candidate.field}
              role="radio"
              accessibilityLabel={`Write the new order into ${candidate.field}`}
              aria-checked={selected}
              onPress={() => onChange(candidate.field)}
              style={[styles.option, selected && styles.optionSelected]}
            >
              <Text style={[styles.field, selected && styles.fieldSelected]}>
                {candidate.field}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: space.xs },
  heading: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  option: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  optionSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  field: { fontFamily: fonts.mono, fontSize: 13, color: colors.textPrimary },
  fieldSelected: { color: colors.accentStrong, fontWeight: '600' },
});
```

- [ ] **Step 11: Run the picker tests**

Run: `npx vitest run tests/component/ArrayPicker.test.tsx tests/component/PositionPicker.test.tsx`
Expected: PASS, 12 tests.

- [ ] **Step 12: Commit**

```bash
git add lib/import/readiness.ts components/data components/lists tests
git commit -m "feat: add the array, label, and position pickers"
```

---

### Task 9: The source input and the found panel

**Files:**
- Create: `components/data/FileDrop.tsx`, `components/data/SourceInput.tsx`, `components/data/FoundPanel.tsx`
- Test: `tests/component/SourceInput.test.tsx`, `tests/component/FoundPanel.test.tsx`

**Interfaces:**
- Consumes: `SourceAnalysis` (Task 3); `describeReadiness` (Task 8); `ArrayPicker`, `LabelPicker`, `PositionPicker` (Task 8); `collectLabelFieldCandidates`, `describeObjectSchema`, `detectPositionFields` (Task 4); `entriesAtPath` (Task 3); `ParseIssue`, `SourceFormat`, `FieldRoles` (Task 1); `Button` from `@/components/ui/Button`.
- Produces:
  - `<FileDrop onFile />` — `onFile: (text: string) => void`
  - `<SourceInput value onChange override onOverrideChange format issues />`
  - `<FoundPanel analysis selectedPath roles entries ctaLabel onSelectPath onRolesChange onSubmit />`

`FoundPanel` derives its own picker inputs from `analysis` and `entries`, so its consumer passes state and callbacks only.

- [ ] **Step 1: Write the failing test for the source input**

Create `tests/component/SourceInput.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { SourceInput } from '@/components/data/SourceInput';

function setup(overrides: Partial<React.ComponentProps<typeof SourceInput>> = {}) {
  const props = {
    value: '',
    onChange: vi.fn(),
    override: 'auto' as const,
    onOverrideChange: vi.fn(),
    format: 'list' as const,
    issues: [],
    ...overrides,
  };
  render(<SourceInput {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('SourceInput', () => {
  it('reports typed text', () => {
    const { onChange } = setup();

    fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: 'Alien' } });

    expect(onChange).toHaveBeenCalledWith('Alien');
  });

  it('shows the text it was given', () => {
    setup({ value: 'Alien\nArrival' });

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(
      'Alien\nArrival',
    );
  });

  it('names the format it detected', () => {
    setup({ value: 'movies:\n  - a\n  - b\n', format: 'yaml' });

    expect(screen.getByText(/read as yaml/i)).toBeDefined();
  });

  it('offers each format override', () => {
    setup();

    expect(screen.getByRole('radio', { name: /detect the format automatically/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as a plain list/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as yaml/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /read the text as json/i })).toBeDefined();
  });

  it('reports an override', async () => {
    const { onOverrideChange, user } = setup();

    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));

    expect(onOverrideChange).toHaveBeenCalledWith('list');
  });

  it('shows a parse error with its line number', () => {
    setup({ issues: [{ path: '', message: 'Invalid JSON: unexpected token', line: 2 }] });

    expect(screen.getByText(/line 2/i)).toBeDefined();
    expect(screen.getByText(/unexpected token/i)).toBeDefined();
  });

  it('shows a parse error with no line number', () => {
    setup({ issues: [{ path: '', message: 'There is nothing to read yet.' }] });

    expect(screen.getByText(/nothing to read yet/i)).toBeDefined();
  });

  it('keeps the text when a parse fails', () => {
    setup({ value: '{ broken', issues: [{ path: '', message: 'Invalid JSON: oops' }] });

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe('{ broken');
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/component/SourceInput.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/data/SourceInput"`.

- [ ] **Step 3: Implement the file drop**

Create `components/data/FileDrop.tsx`. This is the one component that touches the DOM directly, because React Native has no file input; the app ships to the web only:

```tsx
import { createElement, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

export interface FileDropProps {
  onFile: (text: string) => void;
}

/**
 * Web-only: React Native has no file input, and this app ships as a static web
 * bundle. The hidden input is the picker; the surrounding View is the drop
 * target.
 */
export function FileDrop({ onFile }: FileDropProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function readFirst(files: FileList | null): Promise<void> {
    const file = files?.[0];
    if (file === undefined) return;
    onFile(await file.text());
  }

  return (
    <View
      style={styles.zone}
      // @ts-expect-error react-native-web forwards unknown props to the DOM node.
      onDragOver={(event: DragEvent) => event.preventDefault()}
      onDrop={(event: DragEvent) => {
        event.preventDefault();
        void readFirst(event.dataTransfer?.files ?? null);
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Choose a file to import"
        onPress={() => inputRef.current?.click()}
        style={styles.button}
      >
        <Text style={styles.buttonLabel}>Choose a file</Text>
      </Pressable>

      <Text style={styles.hint}>or drop one here</Text>

      {createElement('input', {
        ref: inputRef,
        type: 'file',
        'aria-label': 'Choose a file to import',
        style: { display: 'none' },
        onChange: (event: { target: HTMLInputElement }) => void readFirst(event.target.files),
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  zone: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  button: {
    paddingVertical: space.xs,
    paddingHorizontal: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  buttonLabel: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  hint: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
});
```

- [ ] **Step 4: Implement the source input**

Create `components/data/SourceInput.tsx`:

```tsx
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { FileDrop } from '@/components/data/FileDrop';
import type { ParseIssue } from '@/lib/import/types';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export type FormatOverride = SourceFormat | 'auto';

export interface SourceInputProps {
  value: string;
  onChange: (text: string) => void;
  override: FormatOverride;
  onOverrideChange: (next: FormatOverride) => void;
  /** The format actually in use, whether detected or forced. */
  format: SourceFormat;
  issues: ParseIssue[];
}

const OVERRIDES: { key: FormatOverride; label: string; accessibilityLabel: string }[] = [
  { key: 'auto', label: 'Auto', accessibilityLabel: 'Detect the format automatically' },
  { key: 'list', label: 'Plain list', accessibilityLabel: 'Read the text as a plain list' },
  { key: 'yaml', label: 'YAML', accessibilityLabel: 'Read the text as YAML' },
  { key: 'json', label: 'JSON', accessibilityLabel: 'Read the text as JSON' },
];

const FORMAT_NAMES: Record<SourceFormat, string> = {
  list: 'a plain list',
  yaml: 'YAML',
  json: 'JSON',
};

export function SourceInput({
  value,
  onChange,
  override,
  onOverrideChange,
  format,
  issues,
}: SourceInputProps) {
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Add your list</Text>
        <Text style={styles.subtitle}>Paste it, type it, or drop a file. One item per line, or any YAML or JSON.</Text>
      </View>

      <TextInput
        accessibilityLabel="Your list"
        multiline
        value={value}
        onChangeText={onChange}
        placeholder={'Alien\nArrival\nSolaris'}
        placeholderTextColor={colors.textFaint}
        style={styles.editor}
      />

      <View style={styles.controls}>
        <FileDrop onFile={onChange} />

        <View style={styles.overrides} role="radiogroup" aria-label="How to read the text">
          {OVERRIDES.map((option) => {
            const selected = option.key === override;

            return (
              <Pressable
                key={option.key}
                role="radio"
                accessibilityLabel={option.accessibilityLabel}
                aria-checked={selected}
                onPress={() => onOverrideChange(option.key)}
                style={[styles.override, selected && styles.overrideSelected]}
              >
                <Text style={[styles.overrideLabel, selected && styles.overrideLabelSelected]}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {value.trim() !== '' && issues.length === 0 && (
        <Text style={styles.detected}>{`Read as ${FORMAT_NAMES[format]}.`}</Text>
      )}

      {issues.map((issue, index) => (
        <Text key={`${issue.path}-${index}`} style={styles.issue}>
          {issue.line === undefined ? issue.message : `Line ${issue.line}: ${issue.message}`}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { gap: 2 },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  editor: {
    minHeight: 280,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
    fontFamily: fonts.mono,
    fontSize: 13,
    lineHeight: 20,
    color: colors.textPrimary,
  },
  controls: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  overrides: { flexDirection: 'row', gap: space.xs },
  override: {
    paddingVertical: space.xs,
    paddingHorizontal: space.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  overrideSelected: { borderColor: colors.accentSoftBorder, backgroundColor: colors.accentSoft },
  overrideLabel: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  overrideLabelSelected: { color: colors.accentStrong, fontWeight: '600' },
  detected: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  issue: { fontFamily: fonts.body, fontSize: 13, color: colors.dangerText },
});
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/component/SourceInput.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing test for the found panel**

Create `tests/component/FoundPanel.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { FoundPanel } from '@/components/data/FoundPanel';
import { analyzeSource } from '@/lib/import/analyze';

const NESTED = 'version: 3\nmovies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

function setup(overrides: Partial<React.ComponentProps<typeof FoundPanel>> = {}) {
  const analysis = analyzeSource(NESTED, 'auto');
  const props = {
    analysis,
    selectedPath: ['movies'],
    roles: { labelField: 'title' },
    entries: [
      { title: 'Alien', order: 2 },
      { title: 'Arrival', order: 1 },
    ] as unknown[],
    ctaLabel: 'Start ranking',
    onSelectPath: vi.fn(),
    onRolesChange: vi.fn(),
    onSubmit: vi.fn(),
    ...overrides,
  };
  render(<FoundPanel {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('FoundPanel', () => {
  it('summarises what was found', () => {
    setup();

    expect(screen.getByText(/2 items/i)).toBeDefined();
  });

  it('offers the arrays it found', () => {
    setup();

    expect(screen.getByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    expect(screen.getByRole('radio', { name: /rank the list at actors/i })).toBeDefined();
  });

  it('reports a different array choice', async () => {
    const { onSelectPath, user } = setup();

    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(onSelectPath).toHaveBeenCalledWith(['actors']);
  });

  it('offers the label fields of the selected array', () => {
    setup();

    expect(screen.getByRole('button', { name: /label items by title/i })).toBeDefined();
  });

  it('reports a label choice', async () => {
    const { onRolesChange, user } = setup();

    await user.click(screen.getByRole('button', { name: /label items by title/i }));

    expect(onRolesChange).toHaveBeenCalledWith({ labelField: 'title' });
  });

  it('offers the position fields and keeps the label when one is chosen', async () => {
    const { onRolesChange, user } = setup();

    await user.click(screen.getByRole('radio', { name: /write the new order into order/i }));

    expect(onRolesChange).toHaveBeenCalledWith({ labelField: 'title', positionField: 'order' });
  });

  it('enables the call to action when everything is resolved', () => {
    setup();

    const cta = screen.getByRole('button', { name: /start ranking/i });

    expect(cta.getAttribute('aria-disabled')).not.toBe('true');
  });

  it('submits', async () => {
    const { onSubmit, user } = setup();

    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(onSubmit).toHaveBeenCalled();
  });

  it('blocks and explains when no label is chosen', () => {
    setup({ roles: {} });

    expect(screen.getByText(/which field should title/i)).toBeDefined();
    expect(
      screen.getByRole('button', { name: /start ranking/i }).getAttribute('aria-disabled'),
    ).toBe('true');
  });

  it('blocks a one-item list', () => {
    setup({ entries: [{ title: 'Alien' }] });

    expect(screen.getByText(/at least two items/i)).toBeDefined();
  });

  it('shows warnings about arrays it skipped', () => {
    const analysis = analyzeSource('mixed:\n  - Alien\n  - title: Arrival\n', 'auto');
    setup({ analysis, selectedPath: null, entries: [] });

    expect(screen.getByText(/mixes text and objects/i)).toBeDefined();
  });

  it('carries a different call-to-action label', () => {
    setup({ ctaLabel: 'Apply edits' });

    expect(screen.getByRole('button', { name: /apply edits/i })).toBeDefined();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run tests/component/FoundPanel.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/data/FoundPanel"`.

- [ ] **Step 8: Implement the found panel**

Create `components/data/FoundPanel.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { ArrayPicker } from '@/components/data/ArrayPicker';
import { LabelPicker } from '@/components/data/LabelPicker';
import { PositionPicker } from '@/components/data/PositionPicker';
import { Button } from '@/components/ui/Button';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { collectLabelFieldCandidates, describeObjectSchema } from '@/lib/import/labelField';
import { detectPositionFields } from '@/lib/import/positionField';
import { describeReadiness } from '@/lib/import/readiness';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ComplexItemValue } from '@/types/list';
import type { FieldRoles } from '@/types/source';

export interface FoundPanelProps {
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  /** The entries of the selected array, resolved by the screen. */
  entries: unknown[];
  ctaLabel: string;
  onSelectPath: (path: string[]) => void;
  onRolesChange: (roles: FieldRoles) => void;
  onSubmit: () => void;
}

function isPlainObject(value: unknown): value is ComplexItemValue {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * What the app understood, and the few decisions it cannot make alone. A plain
 * list resolves every decision on its own, so this panel shows only a count.
 */
export function FoundPanel({
  analysis,
  selectedPath,
  roles,
  entries,
  ctaLabel,
  onSelectPath,
  onRolesChange,
  onSubmit,
}: FoundPanelProps) {
  const objects = entries.filter(isPlainObject);
  const labelCandidates = collectLabelFieldCandidates(objects);
  const positionCandidates = detectPositionFields(entries);

  const readiness = describeReadiness({
    candidates: analysis.candidates,
    selectedPath,
    entries,
    roles,
    hasIssues: analysis.issues.length > 0,
  });

  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>What we found</Text>
        <Text style={styles.subtitle}>
          {entries.length > 0
            ? `${entries.length} items`
            : `${analysis.candidates.length} lists`}
        </Text>
      </View>

      <ArrayPicker
        candidates={analysis.candidates}
        value={selectedPath}
        onChange={onSelectPath}
      />

      {objects.length > 0 && (
        <LabelPicker
          candidates={labelCandidates}
          schema={describeObjectSchema(objects)}
          value={roles.labelField}
          onChange={(labelField) => onRolesChange({ ...roles, labelField })}
        />
      )}

      <PositionPicker
        candidates={positionCandidates}
        value={roles.positionField}
        onChange={(positionField) =>
          onRolesChange(
            positionField === undefined
              ? { labelField: roles.labelField }
              : { ...roles, positionField },
          )
        }
      />

      {analysis.warnings.map((warning) => (
        <Text key={warning} style={styles.warning}>
          {warning}
        </Text>
      ))}

      {readiness.reason !== undefined && <Text style={styles.reason}>{readiness.reason}</Text>}

      <Button
        label={ctaLabel}
        variant="primary"
        disabled={!readiness.ready}
        onPress={onSubmit}
        style={styles.cta}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { gap: 2 },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  reason: { fontFamily: fonts.body, fontSize: 13, color: colors.accentStrong },
  cta: { alignSelf: 'stretch' },
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/component/FoundPanel.test.tsx`
Expected: PASS, 12 tests.

If the CTA assertion fails because `Button` renders no `aria-disabled`, check `components/ui/Button.tsx`: it sets `accessibilityState={{ disabled }}`, which react-native-web maps to `aria-disabled`. Do not change `Button`.

- [ ] **Step 10: Run the suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add components/data tests/component
git commit -m "feat: add the data screen's input and found panel"
```

---

### Task 10: Rank screen components

**Files:**
- Create: `components/preview/PreviewTabs.tsx`, `components/preview/ExportToolbar.tsx`, `components/preview/ReadOnlyCode.tsx`, `components/rank/RankRail.tsx`
- Test: `tests/component/PreviewTabs.test.tsx`, `tests/component/ExportToolbar.test.tsx`, `tests/component/RankRail.test.tsx`

**Interfaces:**
- Consumes: `PreviewTab`, `SourceFormat` (Task 1); `mimeTypeFor` (Task 5); `copyText`, `downloadText` from `@/lib/browser/exportActions`; `Button` from `@/components/ui/Button`.
- Produces:
  - `<PreviewTabs tab tabs onChange />` — `tabs: PreviewTab[]`, `onChange: (tab: PreviewTab) => void`
  - `<ExportToolbar format text filename />` — copy and download only
  - `<ReadOnlyCode text label />`
  - `<RankRail name context progress removedCount onRename onEditData onStartOver />`

These are new files rather than edits to `FormatTabs.tsx` and `ImportToolbar.tsx`: their prop shapes change (tabs are now `PreviewTab`, and the toolbar loses its Import button), and the originals must keep working until the switchover. Task 11 deletes the originals.

- [ ] **Step 1: Write the failing tests for the preview tabs and toolbar**

Create `tests/component/PreviewTabs.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreviewTabs } from '@/components/preview/PreviewTabs';

describe('PreviewTabs', () => {
  it('shows only the tabs it was given', () => {
    render(<PreviewTabs tab="ranked" tabs={['ranked', 'yaml']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /ranked/i })).toBeDefined();
    expect(screen.getByRole('tab', { name: /yaml/i })).toBeDefined();
    expect(screen.queryByRole('tab', { name: /json/i })).toBeNull();
  });

  it('labels a plain list tab readably', () => {
    render(<PreviewTabs tab="list" tabs={['ranked', 'list']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /plain list/i })).toBeDefined();
  });

  it('marks the active tab', () => {
    render(<PreviewTabs tab="yaml" tabs={['ranked', 'yaml']} onChange={vi.fn()} />);

    expect(screen.getByRole('tab', { name: /yaml/i }).getAttribute('aria-selected')).toBe('true');
  });

  it('reports a tab change', async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<PreviewTabs tab="ranked" tabs={['ranked', 'json']} onChange={onChange} />);

    await user.click(screen.getByRole('tab', { name: /json/i }));

    expect(onChange).toHaveBeenCalledWith('json');
  });
});
```

Create `tests/component/ExportToolbar.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ExportToolbar } from '@/components/preview/ExportToolbar';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ExportToolbar', () => {
  it('offers copy and download', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films-2026-08-16.yaml" />);

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('offers no import action', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films.yaml" />);

    expect(screen.queryByRole('button', { name: /import|apply/i })).toBeNull();
  });

  it('shows the filename', () => {
    render(<ExportToolbar format="yaml" text="a: 1" filename="films-2026-08-16.yaml" />);

    expect(screen.getByText('films-2026-08-16.yaml')).toBeDefined();
  });

  it('copies the text and confirms', async () => {
    const writeText = vi.fn(() => Promise.resolve());
    vi.stubGlobal('navigator', { clipboard: { writeText } });
    const user = userEvent.setup();
    render(<ExportToolbar format="yaml" text="a: 1" filename="films.yaml" />);

    await user.click(screen.getByRole('button', { name: /copy/i }));

    expect(writeText).toHaveBeenCalledWith('a: 1');
    expect(await screen.findByText(/copied/i)).toBeDefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/component/PreviewTabs.test.tsx tests/component/ExportToolbar.test.tsx`
Expected: FAIL — neither module resolves.

- [ ] **Step 3: Implement the preview tabs**

Create `components/preview/PreviewTabs.tsx`:

```tsx
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';
import type { PreviewTab } from '@/types/source';

export interface PreviewTabsProps {
  tab: PreviewTab;
  /** Only the tabs this source can produce. */
  tabs: PreviewTab[];
  onChange: (tab: PreviewTab) => void;
}

const LABELS: Record<PreviewTab, string> = {
  ranked: 'Ranked',
  list: 'Plain list',
  yaml: 'YAML',
  json: 'JSON',
};

export function PreviewTabs({ tab, tabs, onChange }: PreviewTabsProps) {
  return (
    <View style={styles.group} role="tablist">
      {tabs.map((option) => {
        const selected = option === tab;

        return (
          <Pressable
            key={option}
            role="tab"
            accessibilityLabel={LABELS[option]}
            aria-selected={selected}
            onPress={() => onChange(option)}
            style={[styles.tab, selected && styles.tabSelected]}
          >
            <Text style={[styles.label, selected && styles.labelSelected]}>{LABELS[option]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: {
    flexDirection: 'row',
    gap: space.xs,
    padding: space.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSunken,
  },
  tab: { paddingVertical: space.xs, paddingHorizontal: space.md, borderRadius: radius.sm },
  tabSelected: { backgroundColor: colors.surface },
  label: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  labelSelected: { color: colors.textPrimary, fontWeight: '600' },
});
```

- [ ] **Step 4: Implement the export toolbar and the read-only block**

Create `components/preview/ExportToolbar.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { copyText, downloadText } from '@/lib/browser/exportActions';
import { mimeTypeFor } from '@/lib/export/filenames';
import { colors, fonts, space } from '@/lib/theme';
import type { SourceFormat } from '@/types/source';

export interface ExportToolbarProps {
  format: SourceFormat;
  text: string;
  filename: string;
}

const FEEDBACK_MS = 1800;

/** Copy and download only. Editing happens on the data screen, not here. */
export function ExportToolbar({ format, text, filename }: ExportToolbarProps) {
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (feedback === null) return;
    const timer = setTimeout(() => setFeedback(null), FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [feedback]);

  return (
    <View style={styles.container}>
      <View style={styles.actions}>
        <Button
          label="Copy"
          accessibilityLabel={`Copy the ${format} to the clipboard`}
          variant="secondary"
          size="sm"
          onPress={() => {
            void copyText(text).then((ok) => setFeedback(ok ? 'Copied' : 'Copy unavailable'));
          }}
        />
        <Button
          label="Download"
          accessibilityLabel={`Download ${filename}`}
          variant="secondary"
          size="sm"
          onPress={() => {
            const ok = downloadText(filename, text, mimeTypeFor(format));
            setFeedback(ok ? 'Downloaded' : 'Download unavailable');
          }}
        />
      </View>

      <Text style={styles.filename} numberOfLines={1}>
        {feedback ?? filename}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm },
  filename: { fontFamily: fonts.mono, fontSize: 11, color: colors.textSecondary },
});
```

Create `components/preview/ReadOnlyCode.tsx`:

```tsx
import { ScrollView, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '@/lib/theme';

export interface ReadOnlyCodeProps {
  text: string;
  label: string;
}

export function ReadOnlyCode({ text, label }: ReadOnlyCodeProps) {
  return (
    <ScrollView style={styles.scroll} accessibilityLabel={label} role="region">
      <Text style={styles.code} selectable>
        {text}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: {
    flex: 1,
    minHeight: 240,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceSunken,
  },
  code: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 20, color: colors.textPrimary },
});
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run tests/component/PreviewTabs.test.tsx tests/component/ExportToolbar.test.tsx`
Expected: PASS, 8 tests.

- [ ] **Step 6: Write the failing test for the rank rail**

Create `tests/component/RankRail.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { RankRail } from '@/components/rank/RankRail';

function setup(overrides: Partial<React.ComponentProps<typeof RankRail>> = {}) {
  const props = {
    name: 'Sci-fi films',
    context: 'movies · shown by title · order written back',
    progress: { activeItems: 12, comparisons: 47, skips: 2, coverage: 0.6 },
    removedCount: 0,
    onRename: vi.fn(),
    onEditData: vi.fn(),
    onStartOver: vi.fn(),
    ...overrides,
  };
  render(<RankRail {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('RankRail', () => {
  it('shows the list name as an editable field', () => {
    setup();

    expect((screen.getByLabelText(/list name/i) as HTMLInputElement).value).toBe('Sci-fi films');
  });

  it('reports a rename', () => {
    const { onRename } = setup();

    fireEvent.change(screen.getByLabelText(/list name/i), { target: { value: 'Best films' } });

    expect(onRename).toHaveBeenCalledWith('Best films');
  });

  it('says what is being ranked and how', () => {
    setup();

    expect(screen.getByText(/movies · shown by title · order written back/)).toBeDefined();
  });

  it('shows progress', () => {
    setup();

    expect(screen.getByText(/47 comparisons/i)).toBeDefined();
    expect(screen.getByText(/12 items/i)).toBeDefined();
  });

  it('mentions removed items only when there are some', () => {
    setup({ removedCount: 2 });

    expect(screen.getByText(/2 removed items are excluded from the export/i)).toBeDefined();
  });

  it('stays quiet when nothing was removed', () => {
    setup();

    expect(screen.queryByText(/excluded from the export/i)).toBeNull();
  });

  it('offers editing the data', async () => {
    const { onEditData, user } = setup();

    await user.click(screen.getByRole('button', { name: /edit data/i }));

    expect(onEditData).toHaveBeenCalled();
  });

  it('confirms before starting over', async () => {
    const { onStartOver, user } = setup();

    await user.click(screen.getByRole('button', { name: /start over/i }));

    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.getByText(/clears this list from the browser/i)).toBeDefined();

    await user.click(screen.getByRole('button', { name: /confirm start over/i }));

    expect(onStartOver).toHaveBeenCalled();
  });

  it('can cancel starting over', async () => {
    const { onStartOver, user } = setup();

    await user.click(screen.getByRole('button', { name: /start over/i }));
    await user.click(screen.getByRole('button', { name: /keep this list/i }));

    expect(onStartOver).not.toHaveBeenCalled();
    expect(screen.queryByText(/clears this list from the browser/i)).toBeNull();
  });
});
```

- [ ] **Step 7: Run the test to verify it fails**

Run: `npx vitest run tests/component/RankRail.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/rank/RankRail"`.

- [ ] **Step 8: Implement the rank rail**

Create `components/rank/RankRail.tsx`:

```tsx
import { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';

export interface RankRailProgress {
  activeItems: number;
  comparisons: number;
  skips: number;
  coverage: number;
}

export interface RankRailProps {
  name: string;
  /** e.g. `movies · shown by title · order written back` */
  context: string;
  progress: RankRailProgress;
  removedCount: number;
  onRename: (name: string) => void;
  onEditData: () => void;
  onStartOver: () => void;
}

export function RankRail({
  name,
  context,
  progress,
  removedCount,
  onRename,
  onEditData,
  onStartOver,
}: RankRailProps) {
  const [confirming, setConfirming] = useState(false);

  return (
    <View style={styles.rail} dataSet={{ surface: 'panel' }}>
      <TextInput
        accessibilityLabel="List name"
        value={name}
        onChangeText={onRename}
        style={styles.name}
      />

      <Text style={styles.context}>{context}</Text>

      <View style={styles.stats}>
        <Text style={styles.stat}>{`${progress.comparisons} comparisons`}</Text>
        <Text style={styles.stat}>{`${progress.activeItems} items`}</Text>
      </View>

      {removedCount > 0 && (
        <Text style={styles.note}>
          {`${removedCount} removed ${removedCount === 1 ? 'item is' : 'items are'} excluded from the export.`}
        </Text>
      )}

      <View style={styles.actions}>
        <Button label="Edit data" accessibilityLabel="Edit data" onPress={onEditData} size="sm" />

        {confirming ? (
          <>
            <Text style={styles.warning}>
              This clears this list from the browser. Your exported files are untouched.
            </Text>
            <Button
              label="Keep it"
              accessibilityLabel="Keep this list"
              variant="ghost"
              size="sm"
              onPress={() => setConfirming(false)}
            />
            <Button
              label="Start over"
              accessibilityLabel="Confirm start over"
              variant="danger"
              size="sm"
              onPress={() => {
                setConfirming(false);
                onStartOver();
              }}
            />
          </>
        ) : (
          <Button
            label="Start over"
            accessibilityLabel="Start over"
            variant="ghost"
            size="sm"
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  rail: {
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  name: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
    borderRadius: radius.sm,
  },
  context: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  stats: { flexDirection: 'row', gap: space.md },
  stat: { fontFamily: fonts.body, fontSize: 12, color: colors.textFaint },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.warningText },
  warning: { fontFamily: fonts.body, fontSize: 12, color: colors.dangerText },
  actions: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space.xs },
});
```

- [ ] **Step 9: Run the test to verify it passes**

Run: `npx vitest run tests/component/RankRail.test.tsx`
Expected: PASS, 9 tests.

- [ ] **Step 10: Run the suite**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 11: Commit**

```bash
git add components/preview components/rank tests/component
git commit -m "feat: add the rank screen's rail and read-only preview parts"
```

---

### Task 11: The switchover — store, selectors, and the draft hook

**This is the one task that is not additive.** It replaces the model the app runs on. The repo does not typecheck between Step 3 and Step 11, which is expected; Task 12 wires the screens and restores green. Work through the steps in order and do not stop halfway.

**Files:**
- Rewrite: `lib/state/useListStore.ts`, `lib/state/selectors.ts`
- Create: `lib/hooks/useSourceDraft.ts`
- Test: `tests/unit/state/useListStore.test.ts` (rewritten), `tests/unit/state/selectors.test.ts` (rewritten), `tests/component/useSourceDraft.test.tsx`

**Interfaces:**
- Consumes: `analyzeSource`, `entriesAtPath` (Task 3); `resolveRoles` (Task 4); `buildExport`, `exportFilename` (Task 5); `diffImport`, `ImportDiff` (Task 6); `createWorkspaceStorage`, `WorkspaceSnapshot`, `WORKSPACE_VERSION` (Task 7).
- Produces:
  - `interface StartInput { source: DataSource; roles: FieldRoles; name?: string }`
  - store state `{ workspace, items, comparisonEvents, previewTab, persistenceAvailable, saveOutcome, lastSavedAt, hydrated, resumed }`
  - store actions `hydrate`, `startRanking(input)`, `applyEdits(input)`, `setName(name)`, `setPreviewTab(tab)`, `recordComparison(l, r, outcome)`, `removeItem(id)`, `markResumed()`, `reset()`
  - `selectExportText(workspace, items, events, format): string`
  - `selectRemovedCount(items): number`
  - `selectContextLine(workspace): string`
  - `selectAvailableTabs(workspace): PreviewTab[]`
  - `selectItemLabel(item, labelField): string`
  - `useSourceDraft(seed?): SourceDraft`

- [ ] **Step 1: Write the failing test for the store**

Replace `tests/unit/state/useListStore.test.ts` entirely:

```ts
import { beforeEach, describe, expect, it } from 'vitest';

import type { StorageLike } from '@/lib/persistence/workspaceStorage';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { createListStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';

function memoryBackend(): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
    removeItem: (key) => void data.delete(key),
  };
}

const nested: DataSource = {
  format: 'yaml',
  rawText: 'movies:\n  - title: Alien\n  - title: Arrival\n',
  document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
  arrayPath: ['movies'],
};

let ids = 0;

function makeStore(backend = memoryBackend()) {
  ids = 0;
  return createListStore({
    storage: createWorkspaceStorage(backend),
    now: () => '2026-08-16T00:00:00.000Z',
    createId: () => `id-${(ids += 1)}`,
  });
}

describe('startRanking', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
  });

  it('creates one item per entry of the chosen array', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });

    expect(store.getState().items.map((item) => item.value)).toEqual([
      { title: 'Alien' },
      { title: 'Arrival' },
    ]);
  });

  it('keeps the source document and the roles', () => {
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const workspace = store.getState().workspace;

    expect(workspace?.source.document).toEqual(nested.document);
    expect(workspace?.roles).toEqual({ labelField: 'title' });
  });

  it('names the workspace, without touching the document', () => {
    store.getState().startRanking({ source: nested, roles: {}, name: 'Films' });

    expect(store.getState().workspace?.name).toBe('Films');
    expect(store.getState().workspace?.source.document).toEqual(nested.document);
  });

  it('defaults the name', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().workspace?.name).toBe('Untitled list');
  });

  it('starts the preview on the ranked tab', () => {
    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().previewTab).toBe('ranked');
  });

  it('clears history from a previous list', () => {
    store.getState().startRanking({ source: nested, roles: {} });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');

    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().comparisonEvents).toEqual([]);
  });
});

describe('applyEdits', () => {
  let store: ReturnType<typeof makeStore>;

  beforeEach(() => {
    store = makeStore();
    store.getState().startRanking({ source: nested, roles: { labelField: 'title' } });
    const [left, right] = store.getState().items;
    store.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
  });

  it('keeps ids, and therefore history, for unchanged entries', () => {
    const before = store.getState().items.map((item) => item.id);
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Solaris' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items.slice(0, 2).map((item) => item.id)).toEqual(before);
    expect(store.getState().comparisonEvents).toHaveLength(1);
  });

  it('adds new entries as unranked items', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }, { title: 'Solaris' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items).toHaveLength(3);
    expect(store.getState().items[2]?.value).toEqual({ title: 'Solaris' });
  });

  it('deactivates entries that disappeared, rather than deleting them', () => {
    const edited: DataSource = {
      ...nested,
      document: { owner: 'david', movies: [{ title: 'Alien' }] },
    };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title' } });

    expect(store.getState().items).toHaveLength(2);
    expect(store.getState().items[1]?.active).toBe(false);
    expect(store.getState().comparisonEvents).toHaveLength(1);
  });

  it('replaces the stored source and roles', () => {
    const edited: DataSource = { ...nested, arrayPath: ['movies'], rawText: 'edited' };

    store.getState().applyEdits({ source: edited, roles: { labelField: 'title', positionField: 'order' } });

    expect(store.getState().workspace?.source.rawText).toBe('edited');
    expect(store.getState().workspace?.roles.positionField).toBe('order');
  });

  it('keeps the workspace id, so items still belong to it', () => {
    const id = store.getState().workspace?.id;

    store.getState().applyEdits({ source: nested, roles: {} });

    expect(store.getState().workspace?.id).toBe(id);
  });
});

describe('persistence', () => {
  it('round-trips through storage', () => {
    const backend = memoryBackend();
    const first = makeStore(backend);
    first.getState().startRanking({ source: nested, roles: { labelField: 'title' }, name: 'Films' });

    const second = makeStore(backend);
    second.getState().hydrate();

    expect(second.getState().workspace?.name).toBe('Films');
    expect(second.getState().items).toHaveLength(2);
    expect(second.getState().hydrated).toBe(true);
  });

  it('marks itself hydrated even with nothing stored', () => {
    const store = makeStore();
    store.getState().hydrate();

    expect(store.getState().hydrated).toBe(true);
    expect(store.getState().workspace).toBeNull();
  });

  it('records why a save did not happen', () => {
    const store = createListStore({
      storage: createWorkspaceStorage(null),
      now: () => '2026-08-16T00:00:00.000Z',
      createId: () => 'id-1',
    });

    store.getState().startRanking({ source: nested, roles: {} });

    expect(store.getState().saveOutcome).toBe('unavailable');
    expect(store.getState().items).toHaveLength(2);
  });

  it('clears storage on reset', () => {
    const backend = memoryBackend();
    const store = makeStore(backend);
    store.getState().startRanking({ source: nested, roles: {} });

    store.getState().reset();

    expect(store.getState().workspace).toBeNull();
    expect(backend.data.size).toBe(0);
  });
});

describe('resume', () => {
  it('starts unresumed and can be marked', () => {
    const store = makeStore();

    expect(store.getState().resumed).toBe(false);
    store.getState().markResumed();
    expect(store.getState().resumed).toBe(true);
  });
});

describe('renaming', () => {
  it('renames without touching the document', () => {
    const store = makeStore();
    store.getState().startRanking({ source: nested, roles: {} });

    store.getState().setName('Best films');

    expect(store.getState().workspace?.name).toBe('Best films');
    expect(store.getState().workspace?.source.document).toEqual(nested.document);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/unit/state/useListStore.test.ts`
Expected: FAIL — `startRanking` does not exist on the store.

- [ ] **Step 3: Rewrite the store**

Replace `lib/state/useListStore.ts` entirely:

```ts
import { useStore } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { StoreApi } from 'zustand/vanilla';

import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { diffImport } from '@/lib/import/diff';
import { createWorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import type { SaveOutcome, WorkspaceStorage } from '@/lib/persistence/workspaceStorage';
import { WORKSPACE_VERSION } from '@/lib/persistence/workspaceSnapshot';
import type { WorkspaceSnapshot } from '@/lib/persistence/workspaceSnapshot';
import type { ActivePair } from '@/lib/state/selectors';
import { selectCurrentPair, selectRanking } from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, ComparisonOutcome, RankedItem } from '@/types/ranking';
import type { DataSource, FieldRoles, PreviewTab, Workspace } from '@/types/source';
import { DEFAULT_WORKSPACE_NAME } from '@/types/source';

export interface ListStoreOptions {
  storage?: WorkspaceStorage;
  now?: () => string;
  createId?: () => string;
}

/** What the data screen hands over when the user commits their choices. */
export interface StartInput {
  source: DataSource;
  roles: FieldRoles;
  name?: string;
}

export interface ListState {
  workspace: Workspace | null;
  items: ListItem[];
  comparisonEvents: ComparisonEvent[];
  previewTab: PreviewTab;
  persistenceAvailable: boolean;
  /** Why the last save did or did not happen, for the status line. */
  saveOutcome: SaveOutcome | null;
  lastSavedAt?: string;
  hydrated: boolean;
  /** True once the app has bounced a restored workspace to /rank. */
  resumed: boolean;

  ranking(): RankedItem<ListItem>[];
  currentPair(): ActivePair | null;

  hydrate(): void;
  startRanking(input: StartInput): void;
  applyEdits(input: StartInput): void;
  setName(name: string): void;
  setPreviewTab(tab: PreviewTab): void;
  recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome): void;
  removeItem(itemId: string): void;
  markResumed(): void;
  reset(): void;
}

export type ListStore = StoreApi<ListState>;

function defaultCreateId(): string {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  return `id-${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
}

export function createListStore(options: ListStoreOptions = {}): ListStore {
  const storage = options.storage ?? createWorkspaceStorage();
  const now = options.now ?? (() => new Date().toISOString());
  const createId = options.createId ?? defaultCreateId;

  return createStore<ListState>()((set, get) => {
    /** Browser persistence is a convenience, never the system of record. */
    function persist(): void {
      const { workspace, items, comparisonEvents, previewTab } = get();
      if (workspace === null) {
        storage.clear();
        return;
      }

      const snapshot: WorkspaceSnapshot = {
        version: WORKSPACE_VERSION,
        workspace,
        items,
        comparisonEvents,
        ui: { previewTab },
      };

      const outcome = storage.save(snapshot);
      set({ saveOutcome: outcome, ...(outcome === 'saved' ? { lastSavedAt: now() } : {}) });
    }

    function makeItem(listId: string, value: unknown): ListItem {
      const timestamp = now();
      return {
        id: createId(),
        listId,
        value: value as ListItem['value'],
        active: true,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
    }

    return {
      workspace: null,
      items: [],
      comparisonEvents: [],
      previewTab: 'ranked',
      persistenceAvailable: storage.available,
      saveOutcome: null,
      hydrated: false,
      resumed: false,

      ranking() {
        const { items, comparisonEvents } = get();
        return selectRanking(items, comparisonEvents);
      },

      currentPair() {
        const { items, comparisonEvents } = get();
        return selectCurrentPair(items, comparisonEvents);
      },

      hydrate() {
        const snapshot = storage.load();
        if (snapshot === null) {
          set({ hydrated: true });
          return;
        }
        set({
          workspace: snapshot.workspace,
          items: snapshot.items,
          comparisonEvents: snapshot.comparisonEvents,
          previewTab: snapshot.ui.previewTab,
          hydrated: true,
        });
      },

      /** A fresh list: new workspace, new items, no history to carry over. */
      startRanking({ source, roles, name }: StartInput) {
        const timestamp = now();
        const workspace: Workspace = {
          id: createId(),
          name: name ?? DEFAULT_WORKSPACE_NAME,
          source,
          roles,
          createdAt: timestamp,
          updatedAt: timestamp,
        };

        const entries = entriesAtPath(source.document, source.arrayPath);

        set({
          workspace,
          items: entries.map((entry) => makeItem(workspace.id, entry)),
          comparisonEvents: [],
          previewTab: 'ranked',
        });
        persist();
      },

      /**
       * Edited data on the same workspace. Entries the user did not touch keep
       * their item id, and therefore their rating and their history.
       */
      applyEdits({ source, roles, name }: StartInput) {
        const workspace = get().workspace;
        if (workspace === null) return;

        const entries = entriesAtPath(source.document, source.arrayPath);
        const diff = diffImport(get().items, entries, get().comparisonEvents);
        const removedIds = new Set(diff.removed.map((item) => item.id));
        const timestamp = now();

        const items: ListItem[] = [
          ...get().items.map((item) =>
            removedIds.has(item.id) ? { ...item, active: false, updatedAt: timestamp } : item,
          ),
          ...diff.added.map((entry) => makeItem(workspace.id, entry)),
        ];

        set({
          workspace: {
            ...workspace,
            ...(name === undefined ? {} : { name }),
            source,
            roles,
            updatedAt: timestamp,
          },
          items,
        });
        persist();
      },

      setName(name: string) {
        const workspace = get().workspace;
        if (workspace === null) return;
        set({ workspace: { ...workspace, name, updatedAt: now() } });
        persist();
      },

      setPreviewTab(tab: PreviewTab) {
        set({ previewTab: tab });
        persist();
      },

      recordComparison(leftItemId: string, rightItemId: string, outcome: ComparisonOutcome) {
        const { workspace, items, comparisonEvents } = get();
        if (workspace === null || leftItemId === rightItemId) return;

        const isRankable = (id: string) => items.some((item) => item.id === id && item.active);
        if (!isRankable(leftItemId) || !isRankable(rightItemId)) return;

        const event: ComparisonEvent = {
          id: createId(),
          listId: workspace.id,
          leftItemId,
          rightItemId,
          outcome,
          createdAt: now(),
        };
        set({ comparisonEvents: [...comparisonEvents, event] });
        persist();
      },

      /** Deleting never records a comparison: the pair simply goes away. */
      removeItem(itemId: string) {
        const timestamp = now();
        set({
          items: get().items.map((item) =>
            item.id === itemId ? { ...item, active: false, updatedAt: timestamp } : item,
          ),
        });
        persist();
      },

      markResumed() {
        set({ resumed: true });
      },

      reset() {
        set({
          workspace: null,
          items: [],
          comparisonEvents: [],
          previewTab: 'ranked',
          saveOutcome: null,
          lastSavedAt: undefined,
          resumed: true,
        });
        storage.clear();
      },
    };
  });
}

/** The app-wide workspace. Tests build their own with `createListStore`. */
export const listStore = createListStore();

export function useListStore<T>(selector: (state: ListState) => T): T {
  return useStore(listStore, selector);
}
```

- [ ] **Step 4: Write the failing test for the new selectors**

Replace the parts of `tests/unit/state/selectors.test.ts` that referenced `selectDocument`, `selectPreviewText`, `selectNeedsSortField`, and `selectSortFieldOptions` with these, keeping every existing test for `selectWorkspaceView`, `selectRanking`, `selectCurrentPair`, `selectItemLabel`, and `selectProgress`:

```ts
import { describe, expect, it } from 'vitest';

import {
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectRemovedCount,
} from '@/lib/state/selectors';
import type { ListItem } from '@/types/list';
import type { Workspace } from '@/types/source';

function item(id: string, value: unknown, active = true): ListItem {
  return {
    id,
    listId: 'ws-1',
    value: value as ListItem['value'],
    active,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

const workspace: Workspace = {
  id: 'ws-1',
  name: 'Films',
  source: {
    format: 'yaml',
    rawText: '',
    document: { owner: 'david', movies: [{ title: 'Alien' }, { title: 'Arrival' }] },
    arrayPath: ['movies'],
  },
  roles: { labelField: 'title' },
  createdAt: '2026-08-16T00:00:00.000Z',
  updatedAt: '2026-08-16T00:00:00.000Z',
};

describe('selectExportText', () => {
  it('serializes the user document with the ranking applied', () => {
    const items = [item('a', { title: 'Alien' }), item('b', { title: 'Arrival' })];

    expect(selectExportText(workspace, items, [], 'yaml')).toContain('owner: david');
  });

  it('is empty with no workspace', () => {
    expect(selectExportText(null, [], [], 'yaml')).toBe('');
  });
});

describe('selectRemovedCount', () => {
  it('counts only the deactivated items', () => {
    expect(selectRemovedCount([item('a', 'x'), item('b', 'y', false)])).toBe(1);
  });
});

describe('selectContextLine', () => {
  it('names the array and the label field', () => {
    expect(selectContextLine(workspace)).toBe('movies · shown by title');
  });

  it('mentions the position field when there is one', () => {
    const withOrder = { ...workspace, roles: { labelField: 'title', positionField: 'order' } };

    expect(selectContextLine(withOrder)).toBe('movies · shown by title · order written back');
  });

  it('names a bare list plainly', () => {
    const bare = {
      ...workspace,
      source: { ...workspace.source, format: 'list' as const, document: ['a'], arrayPath: [] },
      roles: {},
    };

    expect(selectContextLine(bare)).toBe('the list');
  });

  it('is empty with no workspace', () => {
    expect(selectContextLine(null)).toBe('');
  });
});

describe('selectAvailableTabs', () => {
  it('offers ranked plus the text formats for a structured source', () => {
    expect(selectAvailableTabs(workspace)).toEqual(['ranked', 'yaml', 'json']);
  });

  it('offers the plain list tab for a plain list source', () => {
    const bare = {
      ...workspace,
      source: { ...workspace.source, format: 'list' as const, document: ['a'], arrayPath: [] },
    };

    expect(selectAvailableTabs(bare)).toEqual(['ranked', 'list', 'yaml', 'json']);
  });

  it('offers only the ranked tab with no workspace', () => {
    expect(selectAvailableTabs(null)).toEqual(['ranked']);
  });
});
```

- [ ] **Step 5: Rewrite the selectors**

In `lib/state/selectors.ts`, keep `selectWorkspaceView`, `selectRanking`, `selectCurrentPair`, `selectProgress`, and the memoization cache exactly as they are. Delete `selectDocument`, `selectPreviewText`, `selectObjectValues`, `selectSortFieldOptions`, `selectObjectSchema`, `selectSortFieldCandidates`, and `selectNeedsSortField` — the found panel derives those itself now. Rename the `sortField` parameter of `selectItemLabel` to `labelField`, leaving its body unchanged.

Replace the imports at the top with:

```ts
import { buildExport } from '@/lib/export/buildExport';
import { formatPath } from '@/lib/import/arrayCandidates';
import { selectNextPair } from '@/lib/ranking/pairSelection';
import { rankItems, replayComparisons } from '@/lib/ranking/rebuildRanking';
import type { RankingStates } from '@/lib/ranking/rebuildRanking';
import { isComplexItemValue } from '@/types/list';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent, RankedItem } from '@/types/ranking';
import type { PreviewTab, SourceFormat, Workspace } from '@/types/source';
```

and append:

```ts
/** The exportable text for one tab, built from the user's own document. */
export function selectExportText(
  workspace: Workspace | null,
  items: ListItem[],
  events: ComparisonEvent[],
  format: SourceFormat,
): string {
  if (workspace === null) return '';
  const ranked = selectRanking(items, events).map((entry) => entry.item);
  return buildExport(workspace.source, workspace.roles, ranked, format);
}

/** Items deleted during comparison, which the export leaves out. */
export function selectRemovedCount(items: ListItem[]): number {
  return items.filter((item) => !item.active).length;
}

/** e.g. `movies · shown by title · order written back` */
export function selectContextLine(workspace: Workspace | null): string {
  if (workspace === null) return '';

  const parts = [formatPath(workspace.source.arrayPath)];
  if (workspace.roles.labelField !== undefined) {
    parts.push(`shown by ${workspace.roles.labelField}`);
  }
  if (workspace.roles.positionField !== undefined) {
    parts.push(`${workspace.roles.positionField} written back`);
  }

  return parts.join(' · ');
}

/** Only the tabs this source can honestly produce. */
export function selectAvailableTabs(workspace: Workspace | null): PreviewTab[] {
  if (workspace === null) return ['ranked'];
  return workspace.source.format === 'list'
    ? ['ranked', 'list', 'yaml', 'json']
    : ['ranked', 'yaml', 'json'];
}
```

- [ ] **Step 6: Run the store and selector tests**

Run: `npx vitest run tests/unit/state/`
Expected: PASS. `npm run typecheck` still fails in the screens and the old components; that is Task 12's job.

- [ ] **Step 7: Write the failing test for the draft hook**

Create `tests/component/useSourceDraft.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSourceDraft } from '@/lib/hooks/useSourceDraft';

const NESTED = 'movies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

describe('useSourceDraft', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSourceDraft());

    expect(result.current.rawText).toBe('');
    expect(result.current.selectedPath).toBeNull();
    expect(result.current.entries).toEqual([]);
  });

  it('auto-selects the only candidate', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.selectedPath).toEqual([]);
    expect(result.current.entries).toEqual(['Alien', 'Arrival']);
  });

  it('asks nothing of a plain list', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.roles).toEqual({});
  });

  it('waits for a choice when several arrays qualify', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText(NESTED));

    expect(result.current.selectedPath).toBeNull();
  });

  it('resolves entries and roles once an array is chosen', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));

    act(() => result.current.selectPath(['movies']));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.roles).toEqual({ labelField: 'title', positionField: 'order' });
  });

  it('keeps a cleared position field cleared', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));
    act(() => result.current.selectPath(['movies']));

    act(() => result.current.setRoles({ labelField: 'title' }));

    expect(result.current.roles).toEqual({ labelField: 'title' });
  });

  it('honours a format override', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText('Alien: 1979\nArrival: 2016\n'));

    act(() => result.current.setOverride('list'));

    expect(result.current.analysis.format).toBe('list');
    expect(result.current.entries).toHaveLength(2);
  });

  it('builds a data source from the current choices', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));
    act(() => result.current.selectPath(['movies']));

    expect(result.current.toSource()).toMatchObject({ format: 'yaml', arrayPath: ['movies'] });
  });

  it('builds nothing while no array is chosen', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));

    expect(result.current.toSource()).toBeNull();
  });

  it('seeds from an existing workspace', () => {
    const { result } = renderHook(() =>
      useSourceDraft({ rawText: NESTED, arrayPath: ['movies'], roles: { labelField: 'title' } }),
    );

    expect(result.current.selectedPath).toEqual(['movies']);
    expect(result.current.roles.labelField).toBe('title');
  });
});
```

- [ ] **Step 8: Run the test to verify it fails**

Run: `npx vitest run tests/component/useSourceDraft.test.tsx`
Expected: FAIL — `Failed to resolve import "@/lib/hooks/useSourceDraft"`.

- [ ] **Step 9: Implement the draft hook**

Create `lib/hooks/useSourceDraft.ts`. Everything derives during render, so there are no effects to fight:

```ts
import { useCallback, useMemo, useState } from 'react';

import { analyzeSource } from '@/lib/import/analyze';
import type { SourceAnalysis } from '@/lib/import/analyze';
import { entriesAtPath } from '@/lib/import/arrayCandidates';
import { resolveRoles } from '@/lib/import/roles';
import type { FormatOverride } from '@/components/data/SourceInput';
import type { DataSource, FieldRoles } from '@/types/source';

export interface SourceDraftSeed {
  rawText: string;
  arrayPath: string[];
  roles: FieldRoles;
}

export interface SourceDraft {
  rawText: string;
  override: FormatOverride;
  analysis: SourceAnalysis;
  selectedPath: string[] | null;
  roles: FieldRoles;
  entries: unknown[];
  setRawText: (text: string) => void;
  setOverride: (override: FormatOverride) => void;
  selectPath: (path: string[]) => void;
  setRoles: (roles: FieldRoles) => void;
  /** The committed source, or null while a choice is still outstanding. */
  toSource: () => DataSource | null;
}

interface RolesOverride {
  labelField?: string;
  positionField?: string;
  /** Distinguishes "not chosen yet" from "deliberately set to none". */
  positionCleared: boolean;
}

/**
 * The data screen's whole form state. Parsing, candidate discovery, and role
 * resolution are recomputed from the text on every change, so the panel can
 * never show a choice that the current text no longer supports.
 */
export function useSourceDraft(seed?: SourceDraftSeed): SourceDraft {
  const [rawText, setRawText] = useState(seed?.rawText ?? '');
  const [override, setOverride] = useState<FormatOverride>('auto');
  const [chosenPath, setChosenPath] = useState<string[] | null>(seed?.arrayPath ?? null);
  const [rolesOverride, setRolesOverride] = useState<RolesOverride>({
    labelField: seed?.roles.labelField,
    positionField: seed?.roles.positionField,
    positionCleared: false,
  });

  const analysis = useMemo(() => analyzeSource(rawText, override), [rawText, override]);

  const selectedPath = useMemo(() => {
    const stillOffered =
      chosenPath !== null &&
      analysis.candidates.some(
        (candidate) => candidate.path.join('.') === chosenPath.join('.'),
      );
    if (stillOffered) return chosenPath;
    return analysis.candidates.length === 1 ? (analysis.candidates[0]?.path ?? null) : null;
  }, [analysis, chosenPath]);

  const entries = useMemo(
    () => (selectedPath === null ? [] : entriesAtPath(analysis.document, selectedPath)),
    [analysis, selectedPath],
  );

  const roles = useMemo(() => {
    const resolved = resolveRoles(entries, {
      labelField: rolesOverride.labelField,
      positionField: rolesOverride.positionField,
    });
    return rolesOverride.positionCleared
      ? { ...resolved, positionField: undefined }
      : resolved;
  }, [entries, rolesOverride]);

  const setRoles = useCallback((next: FieldRoles) => {
    setRolesOverride({
      labelField: next.labelField,
      positionField: next.positionField,
      positionCleared: next.positionField === undefined,
    });
  }, []);

  const toSource = useCallback((): DataSource | null => {
    if (selectedPath === null || analysis.issues.length > 0) return null;
    return {
      format: analysis.format,
      rawText,
      document: analysis.document,
      arrayPath: selectedPath,
    };
  }, [analysis, rawText, selectedPath]);

  return {
    rawText,
    override,
    analysis,
    selectedPath,
    roles,
    entries,
    setRawText,
    setOverride,
    selectPath: setChosenPath,
    setRoles,
    toSource,
  };
}
```

Note the `roles` memo spreads `positionField: undefined` rather than omitting the key. `FieldRoles` marks it optional, so both read the same at every call site, and `buildExportDocument` checks `=== undefined`.

- [ ] **Step 10: Run the hook test**

Run: `npx vitest run tests/component/useSourceDraft.test.tsx`
Expected: PASS, 10 tests.

- [ ] **Step 11: Commit the half-switched state**

The screens are still broken; that is Task 12. Commit anyway so the store rewrite is reviewable on its own.

```bash
git add lib/state lib/hooks/useSourceDraft.ts tests/unit/state tests/component/useSourceDraft.test.tsx
git commit -m "feat: rebuild the store around the user's source document"
```

---

### Task 12: The two screens, and deleting the old model

**Files:**
- Rewrite: `app/index.tsx`, `components/preview/PreviewPane.tsx`, `components/layout/AppShell.tsx`, `types/list.ts`
- Create: `app/rank.tsx`
- Delete: `lib/formats/`, `lib/validation/`, `types/workspace.ts`, `lib/persistence/browserStorage.ts`, `components/lists/`, `components/editor/`, and the tests listed in Step 8
- Test: `tests/component/PreviewPane.test.tsx` (rewritten), `tests/integration/dataScreenFlow.test.tsx`

**Interfaces:**
- Consumes: everything from Tasks 1–11.
- Produces:
  - `<AppShell listName statusText onReset? headerAction? rail? stage preview />`
  - `<PreviewPane tab tabs onTabChange ranking labelField exportText filename format />`
  - route `/` — the data screen; route `/rank` — the comparison screen

- [ ] **Step 1: Trim `types/list.ts`**

Delete `ListKind`, `ExportFormat`, `TextFormat`, and `WorkspaceList`. Keep `PrimitiveItemValue`, `ComplexItemValue`, `ItemValue`, `ListItem`, `isComplexItemValue`, and `isPrimitiveItemValue` exactly as they are, and drop the `sortField` comment from `ListItem`'s neighbours. The file's header comment becomes:

```ts
/** Item shapes. The list itself now lives in types/source.ts. */
```

- [ ] **Step 2: Make the shell's header adaptable**

In `components/layout/AppShell.tsx`, change the props interface to:

```ts
export interface AppShellProps {
  listName: string;
  statusText: string;
  /** Omitted on the data screen, where there is nothing to reset. */
  onReset?: () => void;
  /** e.g. a "Back to ranking" link. */
  headerAction?: ReactNode;
  rail?: ReactNode;
  stage: ReactNode;
  preview: ReactNode;
}
```

Destructure `onReset` and `headerAction` with no default, render `{headerAction}` immediately before `<ThemeToggle />`, and wrap the existing reset block so it renders only when `onReset !== undefined`. Where the rail is laid out, render the rail column only when `rail` is truthy — it already handles `null`, so guard on `rail != null`. Leave the flexbox layout, the styles, and everything else untouched.

- [ ] **Step 3: Rewrite the preview pane**

Replace `components/preview/PreviewPane.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { ExportToolbar } from '@/components/preview/ExportToolbar';
import { PreviewTabs } from '@/components/preview/PreviewTabs';
import { RankedListPreview } from '@/components/preview/RankedListPreview';
import { ReadOnlyCode } from '@/components/preview/ReadOnlyCode';
import { colors, fonts, radius, space, typeScale } from '@/lib/theme';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';
import type { PreviewTab, SourceFormat } from '@/types/source';

export interface PreviewPaneProps {
  tab: PreviewTab;
  tabs: PreviewTab[];
  onTabChange: (tab: PreviewTab) => void;
  ranking: RankedItem<ListItem>[];
  labelField?: string;
  /** The user's document, ranked and serialized for the active tab. */
  exportText: string;
  filename: string;
  format: SourceFormat;
}

/**
 * Read-only by design. Editing happens on the data screen, where re-importing
 * is an explicit act with a summary, rather than a buffer that may or may not
 * have been applied.
 */
export function PreviewPane({
  tab,
  tabs,
  onTabChange,
  ranking,
  labelField,
  exportText,
  filename,
  format,
}: PreviewPaneProps) {
  return (
    <View style={styles.pane} dataSet={{ surface: 'panel' }}>
      <View style={styles.header}>
        <Text style={styles.title}>Your data</Text>
        <Text style={styles.subtitle}>
          {tab === 'ranked' ? 'Live ranking' : 'Your document, in the new order'}
        </Text>
      </View>

      <PreviewTabs tab={tab} tabs={tabs} onChange={onTabChange} />

      {tab === 'ranked' ? (
        <View style={styles.body} accessibilityLabel="Current ranking" role="region">
          <RankedListPreview ranking={ranking} sortField={labelField} />
        </View>
      ) : (
        <View style={styles.body}>
          <ExportToolbar format={format} text={exportText} filename={filename} />
          <ReadOnlyCode text={exportText} label={`${format} export`} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pane: {
    flex: 1,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  header: { gap: 2 },
  title: {
    ...typeScale.sectionTitle,
    fontFamily: fonts.heading,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  subtitle: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  body: { flex: 1, gap: space.md, minHeight: 260 },
});
```

`RankedListPreview` keeps its `sortField` prop name; only the value's origin changed. Renaming it is out of scope.

- [ ] **Step 4: Write the data screen**

Replace `app/index.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { FoundPanel } from '@/components/data/FoundPanel';
import { SourceInput } from '@/components/data/SourceInput';
import { AppShell } from '@/components/layout/AppShell';
import { useSourceDraft } from '@/lib/hooks/useSourceDraft';
import { listStore, useListStore } from '@/lib/state/useListStore';

export default function DataScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const hydrated = useListStore((state) => state.hydrated);
  const resumed = useListStore((state) => state.resumed);

  const draft = useSourceDraft();

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // A saved workspace resumes straight into ranking, but only once, so that
  // navigating back here from the rank screen does not bounce.
  useEffect(() => {
    if (!hydrated || resumed) return;
    listStore.getState().markResumed();
    if (workspace !== null) router.replace('/rank');
  }, [hydrated, resumed, workspace, router]);

  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;
    listStore.getState().startRanking({ source, roles: draft.roles });
    router.push('/rank');
  }

  return (
    <AppShell
      listName="New list"
      statusText="Nothing saved yet"
      stage={
        <SourceInput
          value={draft.rawText}
          onChange={draft.setRawText}
          override={draft.override}
          onOverrideChange={draft.setOverride}
          format={draft.analysis.format}
          issues={draft.rawText.trim() === '' ? [] : draft.analysis.issues}
        />
      }
      preview={
        <FoundPanel
          analysis={draft.analysis}
          selectedPath={draft.selectedPath}
          roles={draft.roles}
          entries={draft.entries}
          ctaLabel="Start ranking"
          onSelectPath={draft.selectPath}
          onRolesChange={draft.setRoles}
          onSubmit={handleSubmit}
        />
      }
    />
  );
}
```

- [ ] **Step 5: Write the rank screen**

Create `app/rank.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { ComparisonDeck } from '@/components/comparison/ComparisonDeck';
import { AppShell } from '@/components/layout/AppShell';
import { PreviewPane } from '@/components/preview/PreviewPane';
import { RankRail } from '@/components/rank/RankRail';
import { exportFilename } from '@/lib/export/filenames';
import {
  selectAvailableTabs,
  selectContextLine,
  selectExportText,
  selectProgress,
  selectRemovedCount,
  selectWorkspaceView,
} from '@/lib/state/selectors';
import { listStore, useListStore } from '@/lib/state/useListStore';
import type { SourceFormat } from '@/types/source';

export default function RankScreen() {
  const router = useRouter();
  const workspace = useListStore((state) => state.workspace);
  const items = useListStore((state) => state.items);
  const comparisonEvents = useListStore((state) => state.comparisonEvents);
  const previewTab = useListStore((state) => state.previewTab);
  const hydrated = useListStore((state) => state.hydrated);
  const persistenceAvailable = useListStore((state) => state.persistenceAvailable);
  const saveOutcome = useListStore((state) => state.saveOutcome);

  useEffect(() => {
    listStore.getState().hydrate();
  }, []);

  // Landing here with nothing to rank means a stale link or a cleared browser.
  useEffect(() => {
    if (hydrated && workspace === null) router.replace('/');
  }, [hydrated, workspace, router]);

  const view = selectWorkspaceView(items, comparisonEvents);
  const progress = selectProgress(items, comparisonEvents);
  const format: SourceFormat = previewTab === 'ranked' ? workspace?.source.format ?? 'list' : previewTab;
  const exportText =
    previewTab === 'ranked' ? '' : selectExportText(workspace, items, comparisonEvents, format);

  // The static build renders without localStorage, so the persistence answer
  // only exists after hydration. Showing it sooner mismatches the served HTML.
  const statusText = !hydrated
    ? 'Working locally'
    : saveOutcome === 'too-large'
      ? 'Too large to save in this browser'
      : persistenceAvailable
        ? 'Saved in this browser'
        : 'Memory only';

  if (workspace === null) return null;

  return (
    <AppShell
      listName={workspace.name}
      statusText={statusText}
      onReset={() => {
        listStore.getState().reset();
        router.replace('/');
      }}
      rail={
        <RankRail
          name={workspace.name}
          context={selectContextLine(workspace)}
          progress={progress}
          removedCount={selectRemovedCount(items)}
          onRename={(name) => listStore.getState().setName(name)}
          onEditData={() => router.push('/')}
          onStartOver={() => {
            listStore.getState().reset();
            router.replace('/');
          }}
        />
      }
      stage={
        <ComparisonDeck
          pair={view.pair}
          progress={progress}
          sortField={workspace.roles.labelField}
          onOutcome={(outcome) => {
            if (view.pair === null) return;
            listStore
              .getState()
              .recordComparison(view.pair.left.id, view.pair.right.id, outcome);
          }}
          onDelete={(itemId) => listStore.getState().removeItem(itemId)}
        />
      }
      preview={
        <PreviewPane
          tab={previewTab}
          tabs={selectAvailableTabs(workspace)}
          onTabChange={(tab) => listStore.getState().setPreviewTab(tab)}
          ranking={view.ranking}
          labelField={workspace.roles.labelField}
          exportText={exportText}
          filename={exportFilename(workspace.name, format)}
          format={format}
        />
      }
    />
  );
}
```

In `components/comparison/ComparisonDeck.tsx`, delete the `needsSortField` prop, its default, and the branch that renders the "pick a label field first" message. That state cannot happen any more: ranking does not start until a label field is chosen.

- [ ] **Step 6: Rewrite the preview pane test**

Replace `tests/component/PreviewPane.test.tsx` entirely:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { PreviewPane } from '@/components/preview/PreviewPane';
import type { ListItem } from '@/types/list';
import type { RankedItem } from '@/types/ranking';

function ranked(): RankedItem<ListItem>[] {
  return [
    { title: 'Arrival' },
    { title: 'Alien' },
  ].map((value, index) => ({
    position: index + 1,
    rating: 1500,
    comparisons: 0,
    item: {
      id: `item-${index}`,
      listId: 'ws-1',
      value,
      active: true,
      createdAt: '2026-08-16T00:00:00.000Z',
      updatedAt: '2026-08-16T00:00:00.000Z',
    },
  })) as RankedItem<ListItem>[];
}

function setup(overrides: Partial<React.ComponentProps<typeof PreviewPane>> = {}) {
  const props = {
    tab: 'ranked' as const,
    tabs: ['ranked', 'yaml', 'json'] as const,
    onTabChange: vi.fn(),
    ranking: ranked(),
    labelField: 'title',
    exportText: 'movies:\n  - title: Arrival\n',
    filename: 'films-2026-08-16.yaml',
    format: 'yaml' as const,
    ...overrides,
  };
  render(<PreviewPane {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('PreviewPane', () => {
  it('shows the ranking on the ranked tab', () => {
    setup();

    expect(screen.getByText('Arrival')).toBeDefined();
  });

  it('offers no editor on the ranked tab', () => {
    setup();

    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows the exported text on a format tab', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByText(/movies:/)).toBeDefined();
  });

  it('never offers an editable buffer', () => {
    setup({ tab: 'yaml' });

    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button', { name: /import|apply/i })).toBeNull();
  });

  it('offers copy and download on a format tab', () => {
    setup({ tab: 'yaml' });

    expect(screen.getByRole('button', { name: /copy/i })).toBeDefined();
    expect(screen.getByRole('button', { name: /download/i })).toBeDefined();
  });

  it('reports a tab change', async () => {
    const { onTabChange, user } = setup();

    await user.click(screen.getByRole('tab', { name: /json/i }));

    expect(onTabChange).toHaveBeenCalledWith('json');
  });
});
```

- [ ] **Step 7: Write the integration test for the data screen**

Create `tests/integration/dataScreenFlow.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const NESTED = 'version: 3\nmovies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

function typeSource(text: string) {
  fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: text } });
}

describe('the data screen', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('starts ranking a plain list with no further questions', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien\nArrival\nSolaris\n');
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().items).toHaveLength(3);
    expect(listStore.getState().workspace?.source.format).toBe('list');
    expect(push).toHaveBeenCalledWith('/rank');
  });

  it('asks which array to rank, then which field labels it', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);

    expect(await screen.findByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    await user.click(screen.getByRole('radio', { name: /rank the list at movies/i }));

    expect(screen.getByRole('button', { name: /label items by title/i })).toBeDefined();
  });

  it('keeps the whole document, not only the ranked array', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().workspace?.source.document).toMatchObject({ version: 3 });
  });

  it('preselects the ordering field it recognises', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().workspace?.roles).toEqual({
      labelField: 'title',
      positionField: 'order',
    });
  });

  it('blocks and explains a one-item list', async () => {
    render(<DataScreen />);

    typeSource('Alien\n');

    expect(await screen.findByText(/at least two items/i)).toBeDefined();
  });

  it('keeps the text and reports the line when parsing fails', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as json/i }));
    typeSource('{\n  "a": ,\n}');

    expect(await screen.findByText(/line 2/i)).toBeDefined();
    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toContain('"a"');
  });

  it('reads ambiguous text as a plain list when told to', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien: 1979\nArrival: 2016\n');
    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().items).toHaveLength(2);
  });

  it('resumes a saved workspace exactly once', async () => {
    listStore.getState().startRanking({
      source: { format: 'list', rawText: 'a\nb\n', document: ['a', 'b'], arrayPath: [] },
      roles: {},
    });
    render(<DataScreen />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rank'));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});
```

- [ ] **Step 8: Delete the old model**

```bash
git rm -r lib/formats lib/validation components/lists components/editor
git rm types/workspace.ts lib/persistence/browserStorage.ts
git rm -r tests/unit/formats
git rm tests/unit/listSchemas.test.ts tests/unit/persistence/browserStorage.test.ts
git rm tests/component/WorkspaceControls.test.tsx
git rm tests/integration/editorRoundTrip.test.tsx tests/integration/sortFieldFlow.test.tsx
```

`components/data/LabelPicker.tsx` already moved out of `components/lists/` in Task 8, so that directory holds only `EmptyState.tsx` and `ListControls.tsx`, both superseded by the data screen.

`tests/integration/sortFieldFlow.test.tsx` is replaced by the label-picking cases in `dataScreenFlow.test.tsx` above.

- [ ] **Step 9: Repoint the surviving tests**

`tests/integration/localPersistence.test.tsx`, `tests/component/accessibility.test.tsx`, and `tests/component/harness.test.tsx` still import the old screen or the old store shape. For each: change `WorkspaceScreen` imports to `DataScreen` from `@/app/index` or `RankScreen` from `@/app/rank`, seed state with `listStore.getState().startRanking({ source, roles })` instead of `importText`, and replace `pairwise-list-ranker:workspace:v1` with `WORKSPACE_STORAGE_KEY` imported from `@/lib/persistence/workspaceStorage`. Both screens call `useRouter`, so add the same `vi.mock('expo-router', ...)` block used in `dataScreenFlow.test.tsx`.

- [ ] **Step 10: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS. If typecheck reports an unused import in `lib/state/selectors.ts` (`isComplexItemValue` is still used by `selectItemLabel`; `RankingStates` by `WorkspaceView`), fix the import list rather than the code.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: split the app into a data screen and a rank screen"
```

---

### Task 13: Editing data mid-run

**Files:**
- Create: `components/data/ApplySummary.tsx`
- Modify: `app/index.tsx`, `lib/hooks/useSourceDraft.ts` (seed from the workspace)
- Test: `tests/component/ApplySummary.test.tsx`, `tests/integration/editDataFlow.test.tsx`

**Interfaces:**
- Consumes: `diffImport`, `ImportDiff` (Task 6); `useSourceDraft` seed (Task 11); `applyEdits` (Task 11).
- Produces: `<ApplySummary diff onCancel onConfirm />`

- [ ] **Step 1: Write the failing test for the summary**

Create `tests/component/ApplySummary.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { ApplySummary } from '@/components/data/ApplySummary';
import type { ListItem } from '@/types/list';

function item(id: string): ListItem {
  return {
    id,
    listId: 'ws-1',
    value: 'x',
    active: true,
    createdAt: '2026-08-16T00:00:00.000Z',
    updatedAt: '2026-08-16T00:00:00.000Z',
  };
}

function setup(overrides: Partial<React.ComponentProps<typeof ApplySummary>> = {}) {
  const props = {
    diff: {
      kept: [item('a'), item('b')].map((entry) => ({ item: entry, entry: 'x' })),
      added: ['y'],
      removed: [item('c')],
      keptComparisons: 47,
    },
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
    ...overrides,
  };
  render(<ApplySummary {...props} />);
  return { ...props, user: userEvent.setup() };
}

describe('ApplySummary', () => {
  it('counts what stays, what is new, and what goes', () => {
    setup();

    expect(screen.getByText(/2 items unchanged/i)).toBeDefined();
    expect(screen.getByText(/1 item added/i)).toBeDefined();
    expect(screen.getByText(/1 item removed/i)).toBeDefined();
  });

  it('says the rankings are kept', () => {
    setup();

    expect(screen.getByText(/47 comparisons kept/i)).toBeDefined();
  });

  it('confirms', async () => {
    const { onConfirm, user } = setup();

    await user.click(screen.getByRole('button', { name: /apply edits/i }));

    expect(onConfirm).toHaveBeenCalled();
  });

  it('cancels', async () => {
    const { onCancel, user } = setup();

    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onCancel).toHaveBeenCalled();
  });

  it('reads sensibly when nothing changed', () => {
    setup({ diff: { kept: [{ item: item('a'), entry: 'x' }], added: [], removed: [], keptComparisons: 0 } });

    expect(screen.getByText(/1 item unchanged/i)).toBeDefined();
    expect(screen.queryByText(/added/i)).toBeNull();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/component/ApplySummary.test.tsx`
Expected: FAIL — `Failed to resolve import "@/components/data/ApplySummary"`.

- [ ] **Step 3: Implement the summary**

Create `components/data/ApplySummary.tsx`:

```tsx
import { StyleSheet, Text, View } from 'react-native';

import { Button } from '@/components/ui/Button';
import type { ImportDiff } from '@/lib/import/diff';
import { colors, fonts, radius, space } from '@/lib/theme';

export interface ApplySummaryProps {
  diff: ImportDiff;
  onCancel: () => void;
  onConfirm: () => void;
}

function plural(count: number): string {
  return count === 1 ? 'item' : 'items';
}

/** Applying edits mid-run is safe, so it says exactly what it will do first. */
export function ApplySummary({ diff, onCancel, onConfirm }: ApplySummaryProps) {
  return (
    <View style={styles.panel} dataSet={{ surface: 'panel' }}>
      <Text style={styles.title}>Applying your edits</Text>

      <Text style={styles.line}>
        {`${diff.kept.length} ${plural(diff.kept.length)} unchanged — rankings kept`}
      </Text>

      {diff.added.length > 0 && (
        <Text style={styles.line}>
          {`${diff.added.length} ${plural(diff.added.length)} added — not yet ranked`}
        </Text>
      )}

      {diff.removed.length > 0 && (
        <Text style={styles.line}>
          {`${diff.removed.length} ${plural(diff.removed.length)} removed`}
        </Text>
      )}

      <Text style={styles.note}>{`${diff.keptComparisons} comparisons kept`}</Text>

      <View style={styles.actions}>
        <Button label="Cancel" accessibilityLabel="Cancel" variant="ghost" onPress={onCancel} />
        <Button
          label="Apply edits"
          accessibilityLabel="Apply edits"
          variant="primary"
          onPress={onConfirm}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: space.xs,
    padding: space.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.accentSoftBorder,
    backgroundColor: colors.accentSoft,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 15,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  line: { fontFamily: fonts.body, fontSize: 13, color: colors.textPrimary },
  note: { fontFamily: fonts.body, fontSize: 12, color: colors.textSecondary },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.xs },
});
```

- [ ] **Step 4: Seed the draft from the workspace**

In `app/index.tsx`, replace `const draft = useSourceDraft();` with a seeded call and add the pending-diff state:

```tsx
  const seed = useMemo(
    () =>
      workspace === null
        ? undefined
        : {
            rawText: workspace.source.rawText,
            arrayPath: workspace.source.arrayPath,
            roles: workspace.roles,
          },
    [workspace],
  );
  const draft = useSourceDraft(seed);
  const [pending, setPending] = useState<ImportDiff | null>(null);
```

`useSourceDraft` reads its seed only on first render, which is what we want: re-seeding on every keystroke would fight the user's typing. Because the screen mounts after hydration when arriving from `/rank`, the seed is present by then.

Replace `handleSubmit` with:

```tsx
  function handleSubmit() {
    const source = draft.toSource();
    if (source === null) return;

    if (workspace === null) {
      listStore.getState().startRanking({ source, roles: draft.roles });
      router.push('/rank');
      return;
    }

    const { items, comparisonEvents } = listStore.getState();
    setPending(diffImport(items, draft.entries, comparisonEvents));
  }

  function handleConfirm() {
    const source = draft.toSource();
    if (source === null) return;
    listStore.getState().applyEdits({ source, roles: draft.roles });
    setPending(null);
    router.push('/rank');
  }
```

Pass `ctaLabel={workspace === null ? 'Start ranking' : 'Apply edits'}` to `FoundPanel`, give `AppShell` a `headerAction` of a `Back to ranking` button when `workspace !== null`, and render the summary above the found panel:

```tsx
      preview={
        pending === null ? (
          <FoundPanel {...foundPanelProps} />
        ) : (
          <ApplySummary
            diff={pending}
            onCancel={() => setPending(null)}
            onConfirm={handleConfirm}
          />
        )
      }
```

Add the imports: `useMemo`, `useState` from react, `ApplySummary`, `diffImport`, `ImportDiff`, and `Button` for the header action.

- [ ] **Step 5: Write the integration test**

Create `tests/integration/editDataFlow.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const RAW = 'Alien\nArrival\nSolaris\n';

function seedWorkspace() {
  listStore.getState().startRanking({
    source: { format: 'list', rawText: RAW, document: ['Alien', 'Arrival', 'Solaris'], arrayPath: [] },
    roles: {},
  });
  listStore.getState().markResumed();
  const [left, right] = listStore.getState().items;
  listStore.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
}

describe('editing data mid-run', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('opens with the current text', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe(RAW);
  });

  it('summarises the change before applying it', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\nStalker\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));

    expect(screen.getByText(/2 items unchanged/i)).toBeDefined();
    expect(screen.getByText(/1 item added/i)).toBeDefined();
    expect(screen.getByText(/1 item removed/i)).toBeDefined();
  });

  it('changes nothing until it is confirmed', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: 'Alien\nArrival\n' } });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getByRole('button', { name: /cancel/i }));

    expect(listStore.getState().items.filter((entry) => entry.active)).toHaveLength(3);
  });

  it('keeps the ranking for entries that did not change', async () => {
    seedWorkspace();
    const keptIds = listStore.getState().items.slice(0, 2).map((entry) => entry.id);
    const user = userEvent.setup();
    render(<DataScreen />);

    fireEvent.change(screen.getByLabelText(/your list/i), {
      target: { value: 'Alien\nArrival\nStalker\n' },
    });
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getByRole('button', { name: /^apply edits$/i }));

    expect(listStore.getState().items.slice(0, 2).map((entry) => entry.id)).toEqual(keptIds);
    expect(listStore.getState().comparisonEvents).toHaveLength(1);
    expect(push).toHaveBeenCalledWith('/rank');
  });

  it('does not bounce back to the rank screen', () => {
    seedWorkspace();
    render(<DataScreen />);

    expect(replace).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run the tests**

Run: `npx vitest run tests/component/ApplySummary.test.tsx tests/integration/editDataFlow.test.tsx`
Expected: PASS, 10 tests.

If the confirm click in the fourth case matches two buttons, the `^apply edits$` anchor disambiguates the summary's confirm button from the found panel's CTA; the panel is unmounted while the summary shows, so only one should match.

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck && npm run lint`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add components/data app/index.tsx lib/hooks tests
git commit -m "feat: edit data mid-run without losing the ranking"
```

---

### Task 14: End-to-end coverage and documentation

**Files:**
- Rewrite: `tests/e2e/core-flow.spec.ts`, `ARCHITECTURE.md` (sections 5 and 7), `UX.md` (core layout, empty states, export rules)
- Test: the Playwright suite

- [ ] **Step 1: Rewrite the end-to-end spec**

Replace `tests/e2e/core-flow.spec.ts` with two journeys. Read the existing file first for the project's Playwright conventions (base URL, how it serves `dist`), and keep them:

```ts
import { expect, test } from '@playwright/test';

const NESTED = `version: 3
owner: david
movies:
  - title: Alien
    year: 1979
    order: 2
  - title: Arrival
    year: 2016
    order: 1
notes: personal picks`;

test('ranks a plain list and exports it', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Your list').fill('Alien\nArrival\nSolaris');
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await expect(page.getByRole('button', { name: /^Choose / }).first()).toBeVisible();
  await page.getByRole('button', { name: /^Choose / }).first().click();

  await page.getByRole('tab', { name: 'Plain list' }).click();
  await expect(page.getByRole('region', { name: 'list export' })).toContainText('Alien');
});

test('keeps the whole document when ranking one array inside it', async ({ page }) => {
  await page.goto('/');

  await page.getByLabel('Your list').fill(NESTED);
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.getByRole('tab', { name: 'YAML' }).click();
  const exported = page.getByRole('region', { name: 'yaml export' });

  await expect(exported).toContainText('version: 3');
  await expect(exported).toContainText('notes: personal picks');
  await expect(exported).toContainText('order: 1');
});

test('resumes after a reload and can start over', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Your list').fill('Alien\nArrival\nSolaris');
  await page.getByRole('button', { name: 'Start ranking' }).click();

  await page.reload();
  await expect(page.getByLabel('List name')).toBeVisible();

  await page.getByRole('button', { name: 'Start over' }).click();
  await page.getByRole('button', { name: 'Confirm start over' }).click();

  await expect(page.getByLabel('Your list')).toBeVisible();
});
```

The second test relies on the nested document having exactly one rankable array, so no array choice is needed — `movies` is auto-selected and `title` is the obvious label.

- [ ] **Step 2: Run the end-to-end suite**

Run: `npm run e2e`
Expected: PASS, 3 tests. This builds the web bundle first, so it takes a couple of minutes.

- [ ] **Step 3: Update ARCHITECTURE.md**

Rewrite section 5 (Data model) to describe `DataSource`, `FieldRoles`, `Workspace`, and `ListItem` as they are in `types/source.ts` and `types/list.ts`, and state the rule that the user's parsed document is stored verbatim and never normalised.

Rewrite section 7 (Import/export design) as: format sniffing with a manual override; plain-list marker rules; array discovery walking object properties only; the two field roles; and export as clone-splice-serialize. Delete the canonical-interchange-shape subsection, the simple/complex handling split, and the entire Markdown dialect subsection.

In section 8.1, replace `lib/validation/` and `lib/formats/` with `lib/import/` and `lib/export/`. In section 11, replace the Markdown round-trip and sort-field-detection bullets with array discovery, plain-list parsing, source-preserving export, and re-import diffing.

- [ ] **Step 4: Update UX.md**

Rewrite Core layout to describe two screens: the data screen (`Add your list` beside `What we found`) and the rank screen (rail, comparison stage, read-only preview). In "Main screen regions", replace the control rail's contents with the rank rail's, and replace the preview pane's editable-text bullets with read-only preview, copy, download, and `Edit data`.

Replace the "Empty, error, and edge states" entries for empty list and object-list-without-sort-field with the data screen's blocked states from `describeReadiness`. Update "Export presentation rules" to say the offered formats follow the source format, and delete the Markdown references throughout.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e ARCHITECTURE.md UX.md
git commit -m "test: cover the guided flow end to end, and update the docs"
```

---

## Done

The app now opens on a data screen, ranks any array the user points at, and hands back their own document with that array reordered.
