# Pairwise List Ranker

A polished Expo web app for importing, editing, comparing, and exporting ranked
lists entirely in the browser.

Core idea:
- import a simple list or a list of complex objects
- compare two items at a time
- pick the better item, mark one as much better, skip, or delete
- converge on a ranked list over repeated pairwise comparisons
- preview and export the current list as YAML, JSON, or Markdown
- optionally keep the working state locally in the browser

The product is static and browser-only:
- no accounts
- no backend API
- no database
- no sharing

## Getting started

```bash
npm install
npm run web      # dev server
npm run build:web  # static bundle in dist/
```

## Scripts

| Script | What it does |
| --- | --- |
| `npm run web` | Expo dev server for the web app |
| `npm run build:web` | Static export to `dist/` |
| `npm run test` | Unit, component, and integration suites (Vitest) |
| `npm run e2e` | Builds, then runs Playwright against the static build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

Docker, for self-hosting the static build:

```bash
docker compose up --build   # http://localhost:8080
```

## How it works

- **Ranking** is weighted Elo (`lib/ranking/`). Comparison history is
  append-only, and the displayed order is rebuilt from that history, so the
  ranking is reproducible rather than incrementally patched.
- **Interchange** is a single canonical JSON document (`lib/formats/`). YAML and
  a strict app-defined Markdown dialect map to and from that same shape.
- **State** lives in a Zustand store (`lib/state/`) with an optional
  `localStorage` snapshot. Exported files are the durable artifact; browser
  storage is a convenience.

Two behaviours worth knowing:

- Deleting an item during a comparison records no result for that pair, but
  ratings already earned against a deleted item are kept.
- Markdown carries list metadata and item values, not item ids; importing
  Markdown assigns fresh ids. JSON and YAML preserve ids.

## Documentation

- [PLAN.md](PLAN.md) — implementation plan by phase
- [ARCHITECTURE.md](ARCHITECTURE.md) — data model, ranking design, formats
- [UX.md](UX.md) — layout, visual system, interaction model
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) — building, hosting, and where user data lives
- [docs/QA.md](docs/QA.md) — manual QA pass before a release
