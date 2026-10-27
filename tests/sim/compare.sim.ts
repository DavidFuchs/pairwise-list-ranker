import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { comparedScenarios, decide, formatDecision, parseGroups, type ResultFile } from '@/tests/sim/compare';
import { parseFilter } from '@/tests/sim/runFile';
import { scenarios } from '@/tests/sim/scenarios';

/**
 * Compares calibration runs by the deciding rule in tests/sim/compare.ts, by
 * hand: `npm run sim:compare` with SIM_CURRENT (the current value's label),
 * SIM_CANDIDATES (a comma list of labels) and SIM_SCENARIOS (optional: a
 * regular expression matched against each scenario's name and tags, as
 * SIM_FILTER is; unset compares every scenario in the current file) and
 * SIM_GROUPS (optional: `model`, the default, takes the mean over the base
 * models and treats every other scenario as a guard; `scenario` makes each
 * scenario its own group, as the three "Much better" habits need; `recency`
 * makes each drift scenario its own group and every other a guard). It reads
 * docs/engine-calibration-runs/<label>.json for each label, prints the result
 * and writes it to docs/engine-calibration-runs/compare-<first candidate>.md.
 * With SIM_CURRENT and SIM_CANDIDATES unset there is nothing to compare and it
 * is skipped, so `npm run sim` passes over it.
 */
const currentLabel = process.env.SIM_CURRENT ?? '';
const candidateLabels = (process.env.SIM_CANDIDATES ?? '')
  .split(',')
  .map((label) => label.trim())
  .filter((label) => label !== '');
const filterText = process.env.SIM_SCENARIOS ?? '';
const groupsText = process.env.SIM_GROUPS ?? '';
const groupOf = parseGroups(groupsText);
const runsDir = join(process.cwd(), 'docs', 'engine-calibration-runs');

function readResult(label: string): ResultFile {
  const path = join(runsDir, `${label}.json`);
  if (!existsSync(path)) {
    const partial = existsSync(join(runsDir, `${label}.partial.json`))
      ? ` (only ${label}.partial.json exists: that run did not play every scenario it selected)`
      : '';
    throw new Error(`No result file for ${label}: ${path}${partial}`);
  }
  return JSON.parse(readFileSync(path, 'utf8')) as ResultFile;
}

describe.skipIf(currentLabel === '' && candidateLabels.length === 0)('compare calibration runs', () => {
  it(`compares ${candidateLabels.join(', ')} against ${currentLabel}`, () => {
    if (currentLabel === '' || candidateLabels.length === 0) {
      throw new Error('Set both SIM_CURRENT and SIM_CANDIDATES (a comma list of labels).');
    }
    const current = readResult(currentLabel);
    const candidates = candidateLabels.map(readResult);
    const catalogue = [...scenarios('full'), ...scenarios('ci')];
    const names = comparedScenarios(
      current.runs.map((run) => run.scenario),
      parseFilter(filterText),
      catalogue,
    );
    if (names.length === 0) {
      throw new Error(`SIM_SCENARIOS selects no scenario of ${currentLabel}: ${filterText}`);
    }
    const decision = decide(current, candidates, names, { groupOf });
    const text = formatDecision(
      decision,
      current,
      filterText,
      groupsText === 'scenario' || groupsText === 'recency' ? groupsText : 'model',
    );
    // This config does not show console.log from a passing test; stdout itself does.
    process.stdout.write(text);
    writeFileSync(join(runsDir, `compare-${candidateLabels[0]}.md`), text);
    expect(decision.table).toHaveLength(candidates.length);
  });
});
