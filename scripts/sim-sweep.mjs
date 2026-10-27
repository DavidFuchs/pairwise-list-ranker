// Runs one engine constant over several values, one calibration run per value
// (the calibrations). Each run is its own `npx vitest run --config vitest.sim.config.mts
// tests/sim/baseline.sim.ts` process, so each loads the constants afresh, and
// writes docs/engine-calibration-runs/<label>.json.
//
// Run: node scripts/sim-sweep.mjs --constant NAME --values a,b,c [--filter REGEX]
//        [--seeds N] [--size full|ci] [--parallel K] [--picker current|adjacent] [--dry-run]
//   (or npm run sim:sweep -- ...)
//
// - --values: numbers separated by commas.
// - Labels: <NAME>-<value>, the value written as a number (2.0 gives
//   STRONG_WEIGHT-2). Under --picker adjacent the label gains -adjacent.
//   With a picker and no constant there is one run, labelled picker-<picker>
//   (picker-adjacent, or picker-current as its reference).
// - --filter, --seeds and --size become SIM_FILTER, SIM_SEEDS and SIM_SIZE;
//   left out, the run's own defaults apply (every scenario, 3 seeds, full).
//   Any SIM_ variable already in the shell is cleared first, so it cannot
//   change a run unseen.
// - At most --parallel runs at a time (default 2). Each run's output goes to a
//   log under the OS temp directory; one line is printed as each run ends.
// - --dry-run prints each run's variables and command and starts nothing.
//
// A constant the runs cannot override, or a value it cannot take, stops the
// sweep before any run, naming the constant. The list below must equal
// OVERRIDABLE in tests/sim/overrides.ts (tests/unit/sim/sweep.test.ts checks it).
import { spawn } from 'node:child_process';
import { createWriteStream, existsSync, mkdtempSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/** Every constant a run may override, with the values it can take. */
const CONSTANTS = {
  PAIR_WEIGHT: { above: 0 },
  STRONG_WEIGHT: { above: 0 },
  DRAW_WEIGHT_EACH_WAY: { atLeast: 0 },
  PLACEMENT_SD_FRACTION: { above: 0 },
  REPEAT_FACTOR: { above: 0, atMost: 1 },
  RECENCY_FACTOR: { atLeast: 0, atMost: 1 },
};

const PICKERS = ['current', 'adjacent'];
const SIZES = ['full', 'ci'];
const COMMAND = 'npx vitest run --config vitest.sim.config.mts tests/sim/baseline.sim.ts';
const root = fileURLToPath(new URL('..', import.meta.url));

class UsageError extends Error {}

function fail(message) {
  throw new UsageError(message);
}

function parseArgs(argv) {
  const options = { dryRun: false };
  const valued = ['constant', 'values', 'filter', 'seeds', 'size', 'parallel', 'picker'];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--dry-run') {
      options.dryRun = true;
      continue;
    }
    const name = arg.startsWith('--') ? arg.slice(2) : '';
    if (!valued.includes(name)) fail(`unknown option ${arg}`);
    if (i + 1 >= argv.length) fail(`${arg} needs a value`);
    if (name in options) fail(`${arg} is given twice`);
    options[name] = argv[++i];
  }
  return options;
}

function positiveInteger(text, option) {
  if (!/^\d+$/.test(text) || Number(text) < 1) fail(`--${option} must be a positive integer, got "${text}"`);
  return Number(text);
}

/** The text as a number, or a failure naming the constant. */
function finiteNumber(name, text) {
  const trimmed = text.trim();
  const value = Number(trimmed);
  if (trimmed === '' || !/^[-+]?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$/i.test(trimmed) || !Number.isFinite(value)) {
    fail(`${name}: "${text}" is not a finite number`);
  }
  return value;
}

function checkRange(name, value, rule) {
  if (rule.above !== undefined && !(value > rule.above))
    fail(`${name} must be above ${rule.above}, got ${value}`);
  if (rule.atLeast !== undefined && !(value >= rule.atLeast)) {
    fail(`${name} must be at least ${rule.atLeast}, got ${value}`);
  }
  if (rule.atMost !== undefined && !(value <= rule.atMost)) {
    fail(`${name} must be at most ${rule.atMost}, got ${value}`);
  }
}

/** The runs the options ask for: a label, and the SIM_ variables beside it. */
function plan(options) {
  const picker = options.picker ?? 'current';
  if (!PICKERS.includes(picker)) fail(`--picker must be one of ${PICKERS.join(', ')}, got "${picker}"`);
  if (options.size !== undefined && !SIZES.includes(options.size)) {
    fail(`--size must be one of ${SIZES.join(', ')}, got "${options.size}"`);
  }
  if (options.seeds !== undefined) positiveInteger(options.seeds, 'seeds');
  if (options.filter !== undefined) {
    try {
      new RegExp(options.filter);
    } catch {
      fail(`--filter is not a valid regular expression: ${options.filter}`);
    }
  }

  const shared = { SIM_PICKER: picker };
  if (options.filter !== undefined) shared.SIM_FILTER = options.filter;
  if (options.seeds !== undefined) shared.SIM_SEEDS = options.seeds;
  if (options.size !== undefined) shared.SIM_SIZE = options.size;

  if (options.constant === undefined && options.values === undefined) {
    if (options.picker === undefined) fail('give --constant and --values, or --picker');
    return [{ label: `picker-${picker}`, env: { SIM_LABEL: `picker-${picker}`, ...shared } }];
  }
  if (options.constant === undefined) fail('--values needs --constant');
  if (options.values === undefined) fail('--constant needs --values');

  const name = options.constant;
  if (!Object.hasOwn(CONSTANTS, name)) {
    fail(`${name} is not an overridable constant (${Object.keys(CONSTANTS).join(', ')})`);
  }
  const rule = CONSTANTS[name];
  const runs = options.values.split(',').map((text) => {
    const value = finiteNumber(name, text);
    checkRange(name, value, rule);
    const label = `${name}-${value}${picker === 'current' ? '' : `-${picker}`}`;
    return {
      label,
      env: { SIM_LABEL: label, SIM_OVERRIDES: JSON.stringify({ [name]: value }), ...shared },
    };
  });
  const labels = runs.map((run) => run.label);
  const repeated = labels.find((label, k) => labels.indexOf(label) !== k);
  if (repeated) fail(`${name}: the value for ${repeated} is given twice`);
  return runs;
}

const envText = (env) =>
  Object.entries(env)
    .map(([key, value]) => `${key}=${value}`)
    .join(' ');

function elapsed(ms) {
  const seconds = Math.round(ms / 1000);
  return seconds < 60 ? `${seconds}s` : `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

/** Starts one run; resolves with whether it wrote <label>.json. */
function start(run, logDir) {
  const logPath = join(logDir, `${run.label}.log`);
  const log = createWriteStream(logPath);
  const env = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('SIM_')));
  Object.assign(env, run.env);
  const began = Date.now();
  return new Promise((resolve) => {
    // One command string through the shell: npx is npx.cmd on Windows, and the command holds no user text.
    const child = spawn(COMMAND, { cwd: root, env, shell: true, stdio: ['ignore', 'pipe', 'pipe'] });
    child.stdout.pipe(log, { end: false });
    child.stderr.pipe(log, { end: false });
    let finished = false;
    // A process that fails to start can emit both error and close.
    const finish = (code, error) => {
      if (finished) return;
      finished = true;
      if (error) log.write(`\nsim-sweep: could not start the run: ${error.message}\n`);
      log.end();
      // A file left by an earlier run of the same label does not count.
      const result = join(root, 'docs', 'engine-calibration-runs', `${run.label}.json`);
      const written = existsSync(result) && statSync(result).mtimeMs >= began - 2000;
      const ok = code === 0 && written;
      const why = ok ? '' : code !== 0 ? ` (exit ${code})` : ` (no ${run.label}.json written)`;
      console.log(
        `${ok ? 'done' : 'FAILED'} ${run.label} in ${elapsed(Date.now() - began)}${why}, log ${logPath}`,
      );
      resolve(ok);
    };
    child.on('error', (error) => finish(null, error));
    child.on('close', (code) => finish(code));
  });
}

async function sweep(runs, parallel) {
  const logDir = mkdtempSync(join(tmpdir(), 'sim-sweep-'));
  console.log(`${runs.length} run(s), at most ${parallel} at a time; logs in ${logDir}`);
  const queue = [...runs];
  let failed = 0;
  const worker = async () => {
    for (let run = queue.shift(); run; run = queue.shift()) {
      console.log(`start ${run.label}: ${envText(run.env)}`);
      if (!(await start(run, logDir))) failed++;
    }
  };
  await Promise.all(Array.from({ length: Math.min(parallel, runs.length) }, worker));
  console.log(failed === 0 ? `all ${runs.length} run(s) done` : `${failed} of ${runs.length} run(s) failed`);
  return failed === 0;
}

async function main() {
  let runs;
  let options;
  try {
    options = parseArgs(process.argv.slice(2));
    runs = plan(options);
    options.parallelCount =
      options.parallel === undefined ? 2 : positiveInteger(options.parallel, 'parallel');
  } catch (error) {
    if (!(error instanceof UsageError)) throw error;
    console.error(`sim-sweep: ${error.message}`);
    process.exit(2);
  }
  if (options.dryRun) {
    for (const run of runs) console.log(`run ${run.label}: ${envText(run.env)} ${COMMAND}`);
    return;
  }
  if (!(await sweep(runs, options.parallelCount))) process.exit(1);
}

await main();
