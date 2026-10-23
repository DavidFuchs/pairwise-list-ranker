// Measures the engine inside the real exported app (docs/ARCHITECTURE.md 6.11, revised budgets).
// Builds `dist/` (skip with --no-build), serves it, seeds a workspace holding
// the `placements-realistic` corpus history into localStorage (written by the
// app's own storage code, so it is in whatever layout the app reads), and
// drives the page in Chromium with the CPU throttled 4x:
//   - load to the first question, with no engine cache entry and with one;
//   - 50 answers: pointer release on a card to the next question rendered;
//     (the first of them also timed from the click on a clock outside the page);
//   - 20 answers each left alone for the 400 ms save delay: how long the
//     workspace save runs on the main thread (the save's timer callback);
//   - 20 undos in a row, and 20 answer-then-undo pairs (the undo of the last action);
//   - on a fresh load with the entry: one answer, its undo, then the undo of the
//     last event the list opened with (which must not go to a cold build).
// Prints one JSON line per run and a table of the worst of the runs.
// Run: node scripts/bench-app.mjs [--runs 3] [--no-build] [--slices]
//
// The CPU throttle reaches the page's main thread but not a dedicated worker,
// so by default the cold open runs at full speed in the cold-build worker. With --slices the cold open's
// page hides `Worker`, so the app builds the snapshot with its main-thread
// slice builder, which the throttle does reach. That is the slice path the app
// falls back to, not the worker path, and the output says so. Nothing in the
// app changes: the page is only given no `Worker`.
import { execSync } from 'node:child_process';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer as createHttpServer } from 'node:http';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

import { chromium } from '@playwright/test';
import { createServer as createViteServer } from 'vite';

const THROTTLE = 4;
const PORT = 4175;
const root = fileURLToPath(new URL('..', import.meta.url));
const dist = join(root, 'dist');
const argv = process.argv.slice(2);
const RUNS = Number(argv[argv.indexOf('--runs') + 1] || 3) || 3;
const SLICES = argv.includes('--slices');
const ANSWERS = 50;
const UNDOS = 20;
const LIST_ID = 'sim-list';
const SAVE_DELAY_MS = 400; // the app's workspace save delay (listStore in lib/state/useListStore.ts)
const SAVES = 20;
const ENGINE_KEY = `pairwise-list-ranker:engine:${LIST_ID}`;

// Load the corpus helper and the app's storage code through Vite so the TypeScript and `@/` imports resolve.
// Returns the history and the localStorage entries the app's own storage writes for it.
async function loadSeed() {
  const vite = await createViteServer({
    root,
    appType: 'custom',
    logLevel: 'error',
    server: { middlewareMode: true },
    resolve: { alias: { '@': root } },
  });
  try {
    const { benchmarkCorpus } = await vite.ssrLoadModule('/tests/helpers/engineCorpus.ts');
    const found = benchmarkCorpus().find((history) => history.name === 'placements-realistic');
    if (!found) throw new Error('placements-realistic is not in the corpus');
    const { createWorkspaceStorage, WORKSPACE_STORAGE_KEY } = await vite.ssrLoadModule(
      '/lib/persistence/workspaceStorage.ts',
    );
    const entries = new Map();
    const backend = {
      getItem: (key) => entries.get(key) ?? null,
      setItem: (key, value) => void entries.set(key, value),
      removeItem: (key) => void entries.delete(key),
    };
    const { WORKSPACE_VERSION } = await vite.ssrLoadModule('/lib/persistence/workspaceSnapshot.ts');
    const outcome = createWorkspaceStorage(backend).save(workspaceSnapshot(found.list, WORKSPACE_VERSION));
    if (outcome !== 'saved') throw new Error(`seeding the workspace gave ${outcome}`);
    return { history: found.list, entries: [...entries], manifestKey: WORKSPACE_STORAGE_KEY };
  } finally {
    await vite.close();
  }
}

function workspaceSnapshot(history, version) {
  const stamp = '2026-01-01T00:00:00.000Z';
  const labels = history.originalItemIds.map((_, index) => `Item ${index}`);
  const items = history.originalItemIds.map((id, index) => ({
    id,
    listId: LIST_ID,
    value: labels[index],
    createdAt: stamp,
    updatedAt: stamp,
  }));
  return {
    version,
    workspace: {
      source: { format: 'list', document: labels, arrayPath: [] },
      listDefaults: { roles: {}, startingOrder: history.startingOrder },
      lists: {
        '': {
          id: LIST_ID,
          arrayPath: [],
          roles: {},
          initialStartingOrder: history.startingOrder,
          configuredExplicitly: false,
          originalItemIds: [...history.originalItemIds],
          items,
          // Each event as its own action, as a single click records it.
          events: history.events.map((event) => ({ ...event, actionId: event.id })),
          createdAt: stamp,
          updatedAt: stamp,
        },
      },
      // A reload keeps only the last undo step (docs/ARCHITECTURE.md 10.3): the action of the history's last event.
      lastAction: { actionId: history.events.at(-1).id, listIds: [LIST_ID] },
      createdAt: stamp,
      updatedAt: stamp,
    },
    ui: { previewTab: 'ranked' },
  };
}

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.ttf': 'font/ttf',
  '.svg': 'image/svg+xml',
};

function serveDist() {
  const server = createHttpServer((request, response) => {
    const path = normalize(decodeURIComponent((request.url ?? '/').split('?')[0])).replace(/^([/\\])+/, '');
    let file = join(dist, path);
    if (!file.startsWith(dist) || !existsSync(file) || statSync(file).isDirectory()) {
      file = join(dist, 'index.html');
    }
    response.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    createReadStream(file).pipe(response);
  });
  return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

// In-page helpers, installed before any app script runs. `firstQuestion` is the
// time since navigation start at which a choice card exists and a frame has passed.
// `saveBlocks` holds how long each run of the workspace save's timer took: the
// timers set with the save delay whose callback wrote the workspace manifest.
function installHelpers({ saveDelay, manifestKey }) {
  const saveBlocks = [];
  let inSave = null;
  const nativeSetItem = Storage.prototype.setItem;
  Storage.prototype.setItem = function (key, value) {
    if (inSave !== null && key === manifestKey) inSave.wrote = true;
    return nativeSetItem.call(this, key, value);
  };
  const nativeSetTimeout = window.setTimeout.bind(window);
  window.setTimeout = (callback, delay, ...args) => {
    if (typeof callback !== 'function' || delay !== saveDelay)
      return nativeSetTimeout(callback, delay, ...args);
    return nativeSetTimeout(
      (...inner) => {
        const run = { wrote: false };
        inSave = run;
        const start = performance.now();
        try {
          return callback(...inner);
        } finally {
          const took = performance.now() - start;
          inSave = null;
          if (run.wrote) saveBlocks.push(took);
        }
      },
      delay,
      ...args,
    );
  };
  const labels = () =>
    [...document.querySelectorAll('[role="group"][aria-label^="Choose Item"]')]
      .map((el) => el.getAttribute('aria-label'))
      .join('|');
  const answers = () => document.body?.innerText.match(/\d+ answers? so far/)?.[0] ?? '';
  const signature = () => `${labels()}#${answers()}`;
  let lastUp = 0;
  document.addEventListener(
    'pointerup',
    () => {
      lastUp = performance.now();
    },
    true,
  );
  const afterPaint = (fn) => requestAnimationFrame(() => setTimeout(fn, 0));
  const state = { firstQuestion: null, restoringSeen: false, restoringInAction: false };
  const watch = new MutationObserver(() => {
    if (document.body?.innerText.includes('Restoring your ranking')) state.restoringSeen = true;
    if (labels() !== '') {
      watch.disconnect();
      afterPaint(() => {
        state.firstQuestion = performance.now();
      });
    }
  });
  watch.observe(document, { childList: true, subtree: true, attributes: true, characterData: true });
  window.__bench = {
    state,
    saveBlocks,
    signature,
    // Resolves with ms from the pointer release to the signature changing and a frame passing.
    nextChange(before) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          observer.disconnect();
          reject(new Error('no change within 20 s'));
        }, 20000);
        const observer = new MutationObserver(() => {
          if (signature() === before) return;
          // A cold build shows no cards: it is noted, and the time runs on to the cards it restores.
          if (document.body?.innerText.includes('Restoring your ranking')) state.restoringInAction = true;
          if (labels() === '') return;
          observer.disconnect();
          clearTimeout(timer);
          afterPaint(() => resolve(performance.now() - lastUp));
        });
        observer.observe(document.documentElement, {
          childList: true,
          subtree: true,
          characterData: true,
          attributes: true,
        });
      });
    },
  };
}

const p95 = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(0.95 * sorted.length) - 1)];
};
const median = (values) => [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)];
const summary = (values) => ({ p95: p95(values), median: median(values), max: Math.max(...values) });

async function openPage(browser, seed, engineEntry, { withoutWorker = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await context.newPage();
  page.setDefaultTimeout(120_000);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => message.type() === 'error' && errors.push(message.text()));
  await page.addInitScript(
    ({ key, entries, engineKey, engineValue }) => {
      // Seed only on the first load, so a reload would keep the app's own writes.
      if (window.localStorage.getItem(key) === null) {
        for (const [entryKey, value] of entries) window.localStorage.setItem(entryKey, value);
        if (engineValue !== null) window.localStorage.setItem(engineKey, engineValue);
      }
    },
    { key: seed.manifestKey, entries: seed.entries, engineKey: ENGINE_KEY, engineValue: engineEntry },
  );
  if (withoutWorker) {
    // The app's cold builder checks for `Worker` and builds in main-thread slices where there is none.
    await page.addInitScript(() => {
      window.Worker = undefined;
    });
  }
  await page.addInitScript(installHelpers, { saveDelay: SAVE_DELAY_MS, manifestKey: seed.manifestKey });
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  return { context, page, errors };
}

async function loadToFirstQuestion(page, url) {
  await page.goto(url);
  await page.waitForFunction(() => window.__bench.state.firstQuestion !== null, null, { polling: 50 });
  return page.evaluate(() => window.__bench.state);
}

async function timedAction(page, selector) {
  const before = await page.evaluate(() => window.__bench.signature());
  const change = page.evaluate((b) => window.__bench.nextChange(b), before);
  const box = await page.locator(selector).first().boundingBox();
  if (box === null) throw new Error(`${selector} has no box`);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  return change;
}

const CARD = '[role="group"][aria-label^="Choose Item"]';
const UNDO = '[aria-label="Undo last change"]';

async function runOnce(browser, url, seed) {
  // (a) No engine cache entry: a cold build. The app then saves its own entry.
  const cold = await openPage(browser, seed, null, { withoutWorker: SLICES });
  const first = await loadToFirstQuestion(cold.page, url);
  if (!first.restoringSeen) throw new Error('the open with no cache entry never showed the Restoring state');
  const loadNoCacheMs = first.firstQuestion;
  await cold.page.waitForFunction((k) => window.localStorage.getItem(k) !== null, ENGINE_KEY, {
    timeout: 30_000,
  });
  const engineEntry = await cold.page.evaluate((k) => window.localStorage.getItem(k), ENGINE_KEY);
  const coldErrors = cold.errors;
  await cold.context.close();

  // (b) With the entry the first run wrote.
  const warm = await openPage(browser, seed, engineEntry);
  const second = await loadToFirstQuestion(warm.page, url);
  if (second.restoringSeen) throw new Error('the open with a cache entry still showed the Restoring state');
  const loadWithCacheMs = second.firstQuestion;
  // The first answer right after the open, timed on the clock outside the page from the click, so
  // anything the page is still doing when the click arrives (work put off past the first question) counts.
  const answerMs = [];
  const clickedAt = Date.now();
  answerMs.push(await timedAction(warm.page, CARD));
  const firstAnswerWallMs = Date.now() - clickedAt;
  for (let i = 1; i < ANSWERS; i++) answerMs.push(await timedAction(warm.page, CARD));
  const undoRunMs = [];
  for (let i = 0; i < UNDOS; i++) undoRunMs.push(await timedAction(warm.page, UNDO));
  const undoLastMs = [];
  for (let i = 0; i < UNDOS; i++) {
    await timedAction(warm.page, CARD);
    undoLastMs.push(await timedAction(warm.page, UNDO));
  }
  // Each answer is left alone past the save delay, so its save runs by itself.
  for (let i = 0; i < SAVES; i++) {
    await timedAction(warm.page, CARD);
    await warm.page.waitForTimeout(SAVE_DELAY_MS + 300);
  }
  const saveBlocks = await warm.page.evaluate(() => window.__bench.saveBlocks);
  const savesAfterAnswers = saveBlocks.slice(-SAVES);
  if (savesAfterAnswers.length < SAVES)
    throw new Error(`only ${savesAfterAnswers.length} of ${SAVES} saves ran`);
  const warmErrors = warm.errors;
  await warm.context.close();

  // (c) Reload, answer, undo, undo: the second undo goes past where the list opened.
  const reload = await openPage(browser, seed, engineEntry);
  await loadToFirstQuestion(reload.page, url);
  await timedAction(reload.page, CARD);
  const reloadUndoAnswerMs = await timedAction(reload.page, UNDO);
  const reloadUndoOpeningMs = await timedAction(reload.page, UNDO);
  const reloadRestoring = await reload.page.evaluate(() => window.__bench.state.restoringInAction);
  if (reloadRestoring) throw new Error('reload, answer, undo, undo went to a cold build');
  const errors = [...coldErrors, ...warmErrors, ...reload.errors];
  await reload.context.close();
  return {
    loadNoCacheMs,
    loadWithCacheMs,
    engineEntryChars: engineEntry.length,
    answer: summary(answerMs),
    answerFirstMs: answerMs[0],
    undoInARow: summary(undoRunMs),
    undoOfLast: summary(undoLastMs),
    saveBlock: summary(savesAfterAnswers),
    firstAnswerWallMs,
    reloadUndoAnswerMs,
    reloadUndoOpeningMs,
    errors,
  };
}

if (!argv.includes('--no-build')) execSync('npm run build:web', { cwd: root, stdio: 'inherit' });
const { history, entries, manifestKey } = await loadSeed();
const seed = { entries, manifestKey };
console.log(
  `workspace ${entries.reduce((total, [, value]) => total + value.length, 0)} chars in ${entries.length} keys, ${history.events.length} events, ${history.originalItemIds.length} items`,
);
const server = await serveDist();
const browser = await chromium.launch();
const results = [];
try {
  console.log(`Chromium ${browser.version()}, CPU throttle ${THROTTLE}x, ${RUNS} runs`);
  if (SLICES) {
    console.log(
      '--slices: the cold open builds in main-thread slices (throttled), not in the worker (unthrottled)',
    );
  }
  for (let run = 1; run <= RUNS; run++) {
    const result = await runOnce(browser, `http://localhost:${PORT}/`, seed);
    results.push(result);
    console.log(`run ${run}: ${JSON.stringify(result)}`);
  }
} finally {
  await browser.close();
  server.close();
}
const worst = (pick) => Math.max(...results.map(pick));
const rows = [
  [
    SLICES
      ? 'load to first question, no cache entry, SLICE PATH not worker (ms)'
      : 'load to first question, no cache entry, worker, unthrottled (ms)',
    worst((r) => r.loadNoCacheMs),
    // The 3000 ms gate is for the worker path; the slice path has none.
    SLICES ? null : 3000,
  ],
  ['load to first question, with cache entry (ms)', worst((r) => r.loadWithCacheMs), null],
  [
    'first answer after the open, click to next question, wall clock (ms)',
    worst((r) => r.firstAnswerWallMs),
    null,
  ],
  [`answer, p95 of ${ANSWERS} (ms)`, worst((r) => r.answer.p95), 100],
  ['answer, the first of them, from the pointer release (ms)', worst((r) => r.answerFirstMs), null],
  [`answer, largest of ${ANSWERS} (ms)`, worst((r) => r.answer.max), null],
  [`undo, p95 of ${UNDOS} in a row (ms)`, worst((r) => r.undoInARow.p95), null],
  [`undo of the last answer, p95 of ${UNDOS} (ms)`, worst((r) => r.undoOfLast.p95), 100],
  [`workspace save on the main thread, max of ${SAVES} (ms)`, worst((r) => r.saveBlock.max), null],
  ['reload, answer, undo: the undo (ms)', worst((r) => r.reloadUndoAnswerMs), 100],
  ['reload, answer, undo, then undo in a row (ms)', worst((r) => r.reloadUndoOpeningMs), null],
];
console.log('\nWorst of the runs');
for (const [name, value, limit] of rows) {
  const verdict =
    limit === null
      ? name.includes('in a row')
        ? 'no gate (checkpoint path)'
        : 'no gate'
      : `${value < limit ? 'PASS' : 'FAIL'} (< ${limit})`;
  console.log(`${name.padEnd(68)}${value.toFixed(1).padStart(9)}  ${verdict}`);
}
const errors = results.flatMap((r) => r.errors);
if (errors.length > 0) console.log(`\nPage errors: ${[...new Set(errors)].join(' | ')}`);
