// Builds bench/engine, serves it, and runs it in Chromium with the CPU
// throttled 4x (docs/ARCHITECTURE.md 6.11, revised budgets). Prints every row and exits 1 if a speed gate is missed.
import { chromium } from '@playwright/test';
import { build, preview } from 'vite';

const THROTTLE = 4;
// Cold and rebuild are gated only on realistic histories (placements at most
// 1% of events); the rest are reported. undo-second and cold-from-snapshot have no gate.
const REALISTIC_PLACEMENT_SHARE = 0.01;
const GATES = [
  { measure: 'warm-pair', stat: 'p95Ms', limit: 100 },
  { measure: 'undo-last', stat: 'p95Ms', limit: 100 },
  { measure: 'cold', stat: 'maxMs', limit: 3000, realisticOnly: true },
  { measure: 'rebuild-before-checkpoint', stat: 'maxMs', limit: 3000, realisticOnly: true },
];

const configFile = 'bench/engine/vite.config.ts';
await build({ configFile, logLevel: 'warn' });
const server = await preview({ configFile, preview: { port: 4179, open: false } });
const url = server.resolvedUrls?.local[0];
if (!url) throw new Error('preview server did not report a URL');

const browser = await chromium.launch();
let rows;
try {
  const page = await browser.newPage();
  page.setDefaultTimeout(0);
  page.on('console', (message) => console.log(`[page] ${message.text()}`));
  const crashed = new Promise((_, reject) =>
    page.on('pageerror', (error) => {
      console.error(`[page error] ${error.message}`);
      reject(new Error(`page error: ${error.message}`));
    }),
  );
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: THROTTLE });
  console.log(`Chromium ${browser.version()}, CPU throttle ${THROTTLE}x, ${url}`);
  await page.goto(url);
  await Promise.race([
    page.waitForFunction(() => window.__benchResults !== undefined, null, { timeout: 0, polling: 1000 }),
    crashed,
  ]);
  rows = await page.evaluate(() => window.__benchResults);
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
  rows = undefined;
} finally {
  await browser.close();
  await new Promise((resolve) => server.httpServer.close(resolve));
}
if (!rows) process.exit(1);

const gateFor = (row) => GATES.find((gate) => gate.measure === row.measure);
const shapes = new Map(rows.filter((row) => row.events).map((row) => [row.history, row]));
const isRealistic = (row) => {
  const shape = shapes.get(row.history);
  return shape !== undefined && shape.placements <= REALISTIC_PLACEMENT_SHARE * shape.events;
};
const pad = (value, width) => String(value).padEnd(width);
const ms = (value) => value.toFixed(1);
let failed = 0;
let missed = 0;
console.log(
  `\n${pad('history', 22)}${pad('measure', 28)}${pad('median', 10)}${pad('p95', 10)}${pad('max', 10)}gate`,
);
for (const row of rows) {
  const gate = gateFor(row);
  let verdict = '-';
  if (gate) {
    const ok = row[gate.stat] < gate.limit;
    const spec = `${gate.stat.replace('Ms', '')} < ${gate.limit} ms`;
    if (gate.realisticOnly && !isRealistic(row)) {
      verdict = `REPORTED (${spec}, over 1% placements)`;
    } else {
      if (!ok) failed++;
      verdict = `${ok ? 'PASS' : 'FAIL'} (${spec})`;
    }
  }
  console.log(
    `${pad(row.history, 22)}${pad(row.measure, 28)}${pad(ms(row.medianMs), 10)}${pad(ms(row.p95Ms), 10)}${pad(ms(row.maxMs), 10)}${verdict}`,
  );
}
console.log(`
${pad('history', 22)}${pad('measure', 28)}missed solves in that row alone`);
for (const row of rows) {
  if (row.nonConverged === undefined) continue;
  missed += row.nonConverged;
  console.log(`${pad(row.history, 22)}${pad(row.measure, 28)}${row.nonConverged}`);
}
console.log(`
${pad('history', 22)}${pad('undo-last/undo-second restored from snapshot', 46)}snapshot JSON (chars)`);
for (const row of rows.filter((r) => r.measure === 'undo-last')) {
  const second = rows.find((r) => r.history === row.history && r.measure === 'undo-second');
  const size = rows.find((r) => r.history === row.history && r.measure === 'cold-from-snapshot');
  console.log(
    `${pad(row.history, 22)}${pad(`${row.fromSnapshot} / ${second?.fromSnapshot}`, 46)}${size?.snapshotChars}`,
  );
}
console.log(`
Solves that missed the solver's test: ${missed}`);
if (missed > 0) failed++;
console.log(failed === 0 ? '\nAll gates passed.' : `\n${failed} gate check(s) FAILED.`);
process.exit(failed === 0 ? 0 : 1);
