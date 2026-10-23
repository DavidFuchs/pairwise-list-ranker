import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import { runScenario, type Trace } from '@/tests/sim/driver';
import { parseOverrides, parsePicker } from '@/tests/sim/overrides';
import { checkLabel, parseFilter, resultFileName, selectScenarios } from '@/tests/sim/runFile';
import { scenarios } from '@/tests/sim/scenarios';

/**
 * Plays every scenario against the real engine for several seeds and writes the
 * traces to docs/engine-calibration-runs/<label>.json. Settings come from the
 * environment: SIM_LABEL (default "baseline"), SIM_SEEDS (default 3),
 * SIM_SIZE ("ci" or "full", default "full"), SIM_OVERRIDES and SIM_PICKER
 * (see tests/sim/overrides.ts, applied by tests/sim/setup.ts) and SIM_FILTER (a
 * regular expression matched against each scenario's name and tags; the run is
 * complete when every selected scenario ran, and the file records the filter). A
 * run with overrides, another picker or a filter must not use the label "baseline", and a run of
 * fewer than all the scenarios writes <label>.partial.json (see
 * tests/sim/runFile.ts). The result file records the overrides and the picker.
 */
const label = process.env.SIM_LABEL ?? 'baseline';
const seedCount = Number(process.env.SIM_SEEDS ?? '3');
const size = process.env.SIM_SIZE ?? 'full';
if (!Number.isInteger(seedCount) || seedCount < 1) throw new Error(`SIM_SEEDS must be a positive integer`);
if (size !== 'ci' && size !== 'full') throw new Error(`SIM_SIZE must be "ci" or "full"`);

const seeds = Array.from({ length: seedCount }, (_, k) => k + 1);
const overrides = parseOverrides(process.env.SIM_OVERRIDES);
const picker = parsePicker(process.env.SIM_PICKER);
const filterText = process.env.SIM_FILTER ?? '';
const filter = parseFilter(filterText);
checkLabel(label, overrides, picker, filterText);
const all = selectScenarios(scenarios(size), filter);
if (filter && all.length === 0) throw new Error(`SIM_FILTER selects no scenario: ${filterText}`);
const runs: { scenario: string; traces: Trace[] }[] = [];

describe(`calibration run ${label}`, () => {
  for (const scenario of all) {
    it(scenario.name, () => {
      const traces = seeds.map((seed) => runScenario(scenario, seed));
      runs.push({ scenario: scenario.name, traces });
      expect(traces).toHaveLength(seeds.length);
    });
  }

  afterAll(() => {
    const dir = join(process.cwd(), 'docs', 'engine-calibration-runs');
    mkdirSync(dir, { recursive: true });
    writeFileSync(
      join(dir, resultFileName(label, runs.length, all.length)),
      `${JSON.stringify({ label, overrides, picker, seeds, ...(filter ? { filter: filterText } : {}), runs })}\n`,
    );
  });
});
