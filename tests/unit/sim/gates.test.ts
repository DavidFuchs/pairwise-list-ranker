import { describe, expect, it } from 'vitest';

import { PROBE_KEPT } from '@/tests/sim/compare';
import { runScenario, type Scenario, type Trace } from '@/tests/sim/driver';
import { scenarios } from '@/tests/sim/scenarios';

/**
 * The release gates of the engine design docs/ARCHITECTURE.md 11, at n = 100 and two seeds so
 * they run in CI, played against the real engine with its calibrated constants
 * (docs/engine-calibration.md). The full 400-item pairs figures are in
 * docs/engine-calibration-runs/pairs-baseline.json; calibrated.json records the
 * grouped engine.
 */
const TIMEOUT = 120000;
const N = 100;
const SEEDS = [1, 2];

function scenarioNamed(name: string): Scenario {
  const found = scenarios('full').find((s) => s.name === name);
  if (!found) throw new Error(`No scenario named ${name}`);
  return found;
}

function play(name: string, seeds: readonly number[] = SEEDS): Trace[] {
  const scenario = scenarioNamed(name);
  return seeds.map((seed) => runScenario(scenario, seed));
}

/** Mean answers to the gate (90% of items within 5%); a run that never reached it fails the test. */
function meanAnswersToGate(traces: Trace[]): number {
  for (const t of traces) expect(t.answersToGate, `seed ${t.seed} never reached the gate`).not.toBeNull();
  return traces.reduce((sum, t) => sum + (t.answersToGate as number), 0) / traces.length;
}

describe('release gates (docs/ARCHITECTURE.md 11), n = 100', () => {
  it(
    'a typical user reaches 90% within 5% in 6n pair answers (docs/ARCHITECTURE.md 11, release gates)',
    () => {
      expect(meanAnswersToGate(play(`typical-unordered-pairs-n${N}`))).toBeLessThanOrEqual(6 * N);
    },
    TIMEOUT,
  );

  // Placement (docs/ARCHITECTURE.md 6.8 step 11) is measured after a further 8n answers. The old 2n yardstick is unfair
  // under pairs only: a probe is made while the list is still settling (the whole list's within5 is about
  // 0.40 at the first probe), so the owner chose 8n on 2026-10-20 and kept the width at 10% of the visible
  // items (PLACEMENT_SD_FRACTION = 0.1). The floors are the 12-seed shares at that width less 0.1
  // (docs/engine-calibration.md, "Placement re-check under pairs only"): near 72 of 72, far 47 of 72.
  const NEAR_FLOOR = 0.9;
  const FAR_FLOOR = 0.55;
  // Six probes a seed, and about two in three come back, so two seeds (12 probes)
  // fell under the floor by chance about one run in five; six seeds make that rare.
  // Seeds 1 to 6 kept 23 of 36 with the old picker and 22 of 36 with the current one
  // (docs/engine-calibration.md, "Flip chances").
  const FAR_SEEDS = [1, 2, 3, 4, 5, 6];

  /** The share of probes kept (at most PROBE_KEPT from their true place) a further 8n answers after the move. */
  function keptShareAfter8n(traces: Trace[]): { measured: number; share: number } {
    const values = traces
      .flatMap((t) => t.probes)
      .map((p) => p.displacementAfter8n)
      .filter((d): d is number => typeof d === 'number');
    const kept = values.filter((d) => d <= PROBE_KEPT).length;
    return { measured: values.length, share: values.length === 0 ? 0 : kept / values.length };
  }

  it(
    'an item moved near its true place stays within 5% after a further 8n answers (docs/ARCHITECTURE.md 6.8 step 11)',
    () => {
      const { measured, share } = keptShareAfter8n(play(`typical-unordered-probe-near-n${N}`));
      expect(measured, 'no near probe was measured at 8n').toBeGreaterThan(0);
      expect(share, `share ${share}`).toBeGreaterThanOrEqual(NEAR_FLOOR);
    },
    TIMEOUT,
  );

  it(
    'an item moved far from its true place is brought back within 5% after a further 8n answers (docs/ARCHITECTURE.md 6.8 step 11)',
    () => {
      const { measured, share } = keptShareAfter8n(play(`typical-unordered-probe-far-n${N}`, FAR_SEEDS));
      expect(measured, 'no far probe was measured at 8n').toBeGreaterThan(0);
      expect(share, `share ${share}`).toBeGreaterThanOrEqual(FAR_FLOOR);
    },
    TIMEOUT,
  );
});
