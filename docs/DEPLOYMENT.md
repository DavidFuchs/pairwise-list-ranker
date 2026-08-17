# Deployment

Pairwise List Ranker is a static site. There is no API, no database, and no
server-side state: the ranking engine, the import/export layer, and the
workspace all run in the visitor's browser.

## Build

```bash
npm install
npm run build:web
```

The bundle is written to `dist/`:

```
dist/
  index.html          # the app
  _sitemap.html
  +not-found.html
  favicon.ico
  _expo/static/js/... # hashed bundle assets
  assets/...
```

Serve `dist/` with any static file server.

## Serving rules

Two rules matter for a correct deployment:

1. **Hashed assets under `_expo/` and `assets/` are immutable.** Cache them
   hard (`Cache-Control: public, max-age=31536000, immutable`).
2. **HTML must not be cached hard.** Serve `index.html` with `no-cache` so a new
   deploy is picked up on the next reload.

A client-side route with no matching file should fall back to `index.html`.
The included nginx config does all of this - see `docker/web/nginx.conf`.

## Docker

The repository ships a two-stage build: Node builds the bundle, nginx serves it.

```bash
docker compose up --build
# http://localhost:8080
```

The published port is configurable:

```bash
WEB_PORT=9000 docker compose up --build
```

The runtime image contains nginx and static files only. It needs no environment
variables, no secrets, and no network access at runtime.

## Hosting without Docker

Any static host works, because the build output is just files:

- Netlify, Vercel, Cloudflare Pages, GitHub Pages, S3 + CloudFront
- an existing nginx/Caddy/Apache virtual host - copy `dist/` into the web root

If your host serves the app from a subpath rather than the domain root, set an
`experiments.baseUrl` in `app.json` and rebuild; otherwise the hashed asset URLs
will not resolve.

## Where user data lives

This is the part worth telling users plainly.

- The working list is held in browser memory while the tab is open.
- A copy is written to `localStorage` under `pairwise-list-ranker:workspace:v1`
  so a reload does not lose work.
- Nothing is transmitted anywhere. There is no server to transmit it to.
- **Exported YAML, JSON, and Markdown files are the durable artifact.** Browser
  storage is a convenience, not a system of record.

Consequences to document for your users:

- Clearing site data, or using a private window, discards the saved workspace.
- The workspace does not follow a user between browsers or devices.
- Private modes that block storage still run the app fine; it just cannot
  restore after a reload, and the UI says so.

## Version and recovery behaviour

The persisted snapshot carries a `version`. On load, a snapshot is discarded and
the app starts empty when it is malformed, fails its shape check, or was written
by a newer version of the app. This is deliberate: a saved copy must never be
able to break the app. Bump `WORKSPACE_VERSION` in `types/workspace.ts` when the
persisted shape changes.

## Verifying a deployment

```bash
npm run test          # unit, component, and integration suites
npm run typecheck
npm run lint
npm run build:web
docker compose config
```

Then, against the running site:

1. Load the page - the browser console should be clean.
2. Paste a list into the YAML tab and press Import.
3. Make a comparison and confirm the preview reorders.
4. Reload and confirm the list and ranking come back.
5. Download an export and confirm the file opens.

`docs/QA.md` has the full manual pass.
