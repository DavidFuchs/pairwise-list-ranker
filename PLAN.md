# Pairwise List Ranker Implementation Plan

> For Hermes: use subagent-driven-development if implementing this later task-by-task.

Goal: Build a polished Expo web app that imports simple lists and complex-object lists, ranks them through repeated pairwise comparisons, supports editable personal share copies, and exports/imports YAML, JSON, and Markdown.

Architecture: Use Expo + React Native Web for the UI, a typed client-side ranking engine for pairwise updates, and a self-hosted TypeScript API backed by MongoDB. Package the web app, API, and MongoDB as a Docker Compose stack so the full system can be deployed without depending on a paid hosted backend.

Tech stack: Expo, TypeScript, Expo Router, React Native Web, Zustand, TanStack Query, Fastify or Hono, MongoDB, Zod, yaml, Vitest, React Testing Library.

---

## Product requirements summary

Must support:
- simple lists of strings
- lists of complex JSON/YAML objects
- selecting which field is sorted on for complex objects
- drill-in access to the rest of the object during comparisons
- pairwise compare with actions: left wins, right wins, skip, much better left, much better right
- delete from the comparison view without applying a rerank for that pair
- add/remove items from the list
- owner-created shared copies with a toggle controlling whether recipients may add/remove items in their own copy
- persistent on-screen preview of the current list in GUI mode, YAML, JSON, or Markdown mode
- copy and download actions for YAML/JSON/Markdown exports
- editable YAML/JSON/Markdown views that can be pasted into and re-imported
- non-exportable rich GUI preview as the default view

## Proposed repository layout

- `app/`
  - `app/(marketing)/`
  - `app/(app)/lists/[listId]/`
  - `app/(app)/shares/[shareToken]/`
- `components/`
  - `comparison/`
  - `preview/`
  - `editor/`
  - `lists/`
  - `layout/`
- `server/`
  - `src/`
  - `tests/`
- `lib/`
  - `ranking/`
  - `formats/`
  - `validation/`
  - `api-client/`
  - `state/`
- `types/`
- `tests/`
  - `unit/`
  - `integration/`
  - `e2e/`
- `docker/`
  - `web/`
  - `api/`
- `infra/`
  - `mongo/`
- `docker-compose.yml`
- `docs/`

## Phase 1: Repository and app scaffold

Objective: Create the Expo web project skeleton, backend API scaffold, and deployment-ready Docker Compose layout.

Files:
- Create: `package.json`
- Create: `app/_layout.tsx`
- Create: `app/index.tsx`
- Create: `tsconfig.json`
- Create: `eslint.config.js`
- Create: `vitest.config.ts`
- Create: `app.json`
- Create: `server/package.json`
- Create: `server/src/index.ts`
- Create: `docker-compose.yml`
- Create: `docker/web/Dockerfile`
- Create: `docker/api/Dockerfile`

Steps:
1. Initialize the Expo TypeScript app configured for web.
2. Add Expo Router and create route groups for marketing, authenticated app pages, and share entry pages.
3. Scaffold a TypeScript API service for auth, list persistence, and sharing endpoints.
4. Add Dockerfiles for the web and API containers plus a MongoDB service in `docker-compose.yml`.
5. Add linting, formatting, and test scripts.
6. Add a polished base theme and font-loading setup.
7. Verify the app runs in browser mode, the API boots, and the Compose stack validates.

Verification:
- `npm install`
- `docker compose config`
- `npm run lint`
- `npm run test`
- `npm run web`

## Phase 2: Core domain types and validation

Objective: Define canonical list, item, share-copy, and comparison-event models.

Files:
- Create: `types/list.ts`
- Create: `types/share.ts`
- Create: `types/ranking.ts`
- Create: `lib/validation/listSchemas.ts`
- Create: `tests/unit/listSchemas.test.ts`

Steps:
1. Define canonical item identity rules for both simple and complex items.
2. Add Zod schemas for import/export payloads.
3. Define a canonical JSON shape that YAML and Markdown round-trip through.
4. Add tests for valid and invalid payloads.

Verification:
- `npm run test -- listSchemas`

## Phase 3: Ranking engine

Objective: Implement deterministic reranking from pairwise events.

Files:
- Create: `lib/ranking/elo.ts`
- Create: `lib/ranking/pairSelection.ts`
- Create: `lib/ranking/rebuildRanking.ts`
- Create: `tests/unit/ranking/elo.test.ts`
- Create: `tests/unit/ranking/pairSelection.test.ts`

Steps:
1. Implement weighted Elo updates with a default base rating.
2. Model outcome weights for normal win and much-better win.
3. Ensure skip produces no rating change.
4. Ensure delete-from-pair removes the item before any rating update is applied.
5. Implement pair selection that favors close ratings, low comparison counts, and underexposed items.
6. Rebuild the ordered list from comparison history plus live item state.

Verification:
- `npm run test -- ranking`

## Phase 4: Import/export format layer

Objective: Support editable JSON, YAML, and Markdown round-trips.

Files:
- Create: `lib/formats/jsonFormat.ts`
- Create: `lib/formats/yamlFormat.ts`
- Create: `lib/formats/markdownFormat.ts`
- Create: `lib/formats/index.ts`
- Create: `tests/unit/formats/markdownFormat.test.ts`

Steps:
1. Define canonical serialization from domain models.
2. Implement JSON import/export.
3. Implement YAML import/export using the same canonical structure.
4. Implement a strict app-defined Markdown dialect.
5. Add copy/paste-safe normalization and rich parse errors.
6. Verify that app-generated exports can be pasted back in and imported losslessly.

Verification:
- `npm run test -- formats`

## Phase 5: Local state and persistence plumbing

Objective: Build client state management and draft persistence.

Files:
- Create: `lib/state/useListStore.ts`
- Create: `lib/state/selectors.ts`
- Create: `lib/state/draftPersistence.ts`
- Create: `tests/unit/state/useListStore.test.ts`

Steps:
1. Create the main list workspace store.
2. Persist in-progress editor text and UI mode locally.
3. Keep comparison history append-only.
4. Add selectors for current ranking, preview text, active pair, and drill-in panel state.

Verification:
- `npm run test -- state`

## Phase 6: Main comparison workspace UI

Objective: Build the two-card ranking experience and persistent preview panel.

Files:
- Create: `app/(app)/lists/[listId]/index.tsx`
- Create: `components/comparison/ComparisonDeck.tsx`
- Create: `components/comparison/ItemCard.tsx`
- Create: `components/comparison/ComparisonActions.tsx`
- Create: `components/preview/PreviewPane.tsx`
- Create: `components/layout/AppShell.tsx`

Steps:
1. Build the split layout with comparison area and persistent preview.
2. Add actions for left, right, skip, much-better variants, and delete-from-pair.
3. Show object drill-in details in an expandable side sheet or card modal.
4. Keep the GUI preview in sync with the live ranking after every action.
5. Add empty, loading, and first-run onboarding states.

Verification:
- Manual browser QA of all comparison actions
- Component tests for button state and transitions

## Phase 7: Import/editor preview modes

Objective: Build GUI, YAML, JSON, and Markdown preview/editor modes.

Files:
- Create: `components/editor/FormatTabs.tsx`
- Create: `components/editor/TextFormatEditor.tsx`
- Create: `components/editor/ImportToolbar.tsx`
- Create: `tests/integration/editorRoundTrip.test.tsx`

Steps:
1. Add tabs for GUI, YAML, JSON, and Markdown.
2. Keep GUI view read-only and non-exportable.
3. Add copy and download actions only for YAML, JSON, and Markdown modes.
4. Permit direct editing and paste-import in text modes.
5. Show parse diagnostics inline without discarding the current working list until import is confirmed.

Verification:
- Integration tests for edit -> import -> rerender preview
- Manual QA of copy/download flows in all supported text modes

## Phase 8: Complex-object sort field selection and drill-in

Objective: Let users choose which field drives rank labels while preserving the full object.

Files:
- Create: `components/lists/SortFieldPicker.tsx`
- Create: `components/comparison/ObjectDrilldown.tsx`
- Create: `lib/validation/sortFieldRules.ts`
- Create: `tests/unit/sortFieldRules.test.ts`

Steps:
1. Detect candidate scalar fields from imported objects.
2. Require explicit sort-field selection when no safe default exists.
3. Store both the chosen sort field and object schema hints with the list.
4. Surface remaining fields in drill-in details during comparisons.
5. Preserve hidden fields through all export formats.

Verification:
- Tests for field detection and persistence
- Manual QA with nested objects and mixed-value fields

## Phase 9: Auth, sharing, and personal reranking copies

Objective: Support owner-controlled shared copies that never modify the master list.

Files:
- Create: `app/(app)/lists/[listId]/share.tsx`
- Create: `app/(app)/shares/[shareToken].tsx`
- Create: `server/src/routes/auth.ts`
- Create: `server/src/routes/shares.ts`
- Create: `server/src/routes/lists.ts`
- Create: `server/src/db/collections.ts`
- Create: `server/src/db/indexes.ts`
- Create: `tests/integration/sharing.test.ts`

Steps:
1. Model master lists, share links, and recipient-owned copies separately.
2. Add a share toggle for whether the recipient copy may add/remove items.
3. On share open, fork the current list state into a personal copy for that recipient.
4. Block any mutation of the master list through API authorization and ownership checks.
5. Allow recipient deletion during ranking only when their copy is editable.
6. Add password hashing and session or JWT handling for self-hosted accounts.

Verification:
- Integration tests for owner vs recipient permissions
- Manual QA with two accounts

## Phase 10: Polish, accessibility, and launch readiness

Objective: Make the product feel finished.

Files:
- Create: `tests/e2e/core-flow.spec.ts`
- Create: `docs/QA.md`
- Modify: all major UI components for accessibility fixes

Steps:
1. Add keyboard support for comparison actions.
2. Tune mobile and tablet layouts.
3. Add focus management, ARIA labels, and high-contrast checks.
4. Add motion polish without reducing clarity.
5. Run end-to-end browser QA across import, ranking, sharing, editing, and export.

Verification:
- `npm run test`
- `npm run e2e`
- `npm run web` manual QA pass

## Recommended delivery order

1. Phases 1-4 for a local-only MVP
2. Phases 5-8 for polished single-user experience
3. Phase 9 for multi-user sharing
4. Phase 10 for release hardening

## Risks and mitigations

- Markdown round-trip for complex objects can become mushy if the format is too loose.
  - Mitigation: support a strict app-defined Markdown dialect and document it clearly.
- Pair selection can feel repetitive or random if based only on ratings.
  - Mitigation: include exposure balancing and recent-pair cooldown logic.
- Shared-copy permissions can leak into master-list operations if ownership boundaries are fuzzy.
  - Mitigation: separate collections, separate IDs, and server-side ownership checks on every mutation.
- Large imports can make preview rendering and text serialization sluggish.
  - Mitigation: memoized selectors and virtualization for large GUI previews.
- Mongo can become sloppy if arbitrary object shapes are stored without validation discipline.
  - Mitigation: validate all inbound payloads with Zod and normalize imported data before persistence.

## Open items

- Should anonymous share recipients be supported, or should reranking require login?
- Should owners be able to compare their master list against a recipient copy or merge recipient-added items later?
- Should the app expose algorithm settings, or keep weighting rules fixed for simplicity?
- What is the maximum expected list size for performance targets?
