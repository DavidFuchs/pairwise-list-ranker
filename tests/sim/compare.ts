import type { MoveProbe, Sample, Trace } from '@/tests/sim/driver';
import { selectScenarios } from '@/tests/sim/runFile';

/**
 * The paired comparison of two calibration runs, and the deciding rule of plan
 * 3b (owner decision, 2026-10-19):
 *
 * - The measure is the answers to the gate (90% of items within 5%). A trace
 *   that never reached it counts as its last sample's answers (the budget, or
 *   fewer on an early stop) and is counted as censored.
 * - Seeds are paired by seed number. A scenario's change is the mean over its
 *   paired seeds of (candidate - current) / current. A seed whose current gate
 *   is 0 gives a 0 change when the candidate's is 0 too, and is otherwise
 *   skipped and noted.
 * - `groupOf` maps each scenario to a group (by default the base model, see
 *   baseModelOf) or to null. The grouped scenarios are the deciding set: a
 *   group's change is the mean of its scenarios' changes, and the candidate's
 *   mean is the mean over the groups. Scenarios mapped to null are guards:
 *   reported, and held to the 10% rule, but left out of the mean.
 * - A candidate more than 10% slower on any group or any guard is rejected.
 *   One with more censored seeds in the deciding set than the current value is
 *   not eligible: its advantage may rest on runs that never finished. A
 *   candidate must beat the current value by at least 2% of its mean;
 *   otherwise the current value stays and the reason is "no gain". Among the
 *   candidates left, the one with the lowest mean is chosen (the first on a tie).
 *
 * Every figure in a Cell is over the paired seeds only.
 */

/** A result file written by tests/sim/baseline.sim.ts: docs/engine-calibration-runs/<label>.json. */
export interface ResultFile {
  label: string;
  overrides: Record<string, unknown>;
  picker?: string;
  filter?: string;
  seeds: number[];
  runs: { scenario: string; traces: Trace[] }[];
}

/** A candidate slower than the current value by more than this share, on a group or a guard, is rejected. */
export const SLOWER_LIMIT = 0.1;
/** A candidate must be faster than the current value by at least this share of its mean to replace it. */
export const GAIN_MARGIN = 0.02;
/** A probe counts as back in place (docs/ARCHITECTURE.md 6.8 step 11) when its displacement after the horizon's answers is at most this. */
export const PROBE_KEPT = 0.05;

export interface Quality {
  /** Mean over the paired seeds of the sample's within5. */
  within5: number;
  /** Mean over the paired seeds of the sample's within1. */
  within1: number;
}

/** The horizons a probe is measured at: a further 2n, 4n or 8n answers after the move. */
export const PROBE_HORIZONS = ['2n', '4n', '8n'] as const;
export type ProbeHorizon = (typeof PROBE_HORIZONS)[number];

const HORIZON_FIELD = {
  '2n': 'displacementAfter2n',
  '4n': 'displacementAfter4n',
  '8n': 'displacementAfter8n',
} as const satisfies Record<ProbeHorizon, keyof MoveProbe>;

export interface HorizonShare {
  /** The probes with a displacement at this horizon (the run lasted long enough, the item was shown, and the file records the horizon). */
  measured: number;
  /** Of those, the probes at most PROBE_KEPT from their true place. */
  kept: number;
  /** kept / measured, or null when nothing was measured. */
  share: number | null;
  /** Mean displacement over the measured probes, or null when nothing was measured. */
  meanDisplacement: number | null;
}

export interface ProbeShare {
  /** Probes of this kind made. */
  made: number;
  /** The shares at each horizon. A file recorded before the 4n and 8n fields has nothing measured there. */
  after: Record<ProbeHorizon, HorizonShare>;
}

export interface ProbeShares {
  near: ProbeShare;
  far: ProbeShare;
  /** Probe moves the driver could not make (Trace.probesSkipped), summed. */
  skipped: number;
}

/** One file's figures for one scenario, beside the gate. */
export interface SideStats {
  /** At each trace's last sample. */
  last: Quality;
  /** At the sample nearest 4n answers (the earlier on a tie); null when the name gives no n. */
  at4n: Quality | null;
  /** At the sample nearest 8n answers (the earlier on a tie); null when the name gives no n. */
  at8n: Quality | null;
  probes: ProbeShares;
}

export interface Cell {
  scenario: string;
  /** The scenario's group (a base model by default), or null for a guard. */
  model: string | null;
  /** The candidate's mean answers to the gate, a censored trace counted as its last sample's answers. */
  meanGate: number;
  /** The candidate's censored traces. */
  censored: number;
  /** The current value's mean answers to the gate, counted the same way. */
  currentMeanGate: number;
  /** The current value's censored traces. */
  currentCensored: number;
  /** Mean over the paired seeds of (candidate - current) / current; null when no seed could be used. */
  relativeChange: number | null;
  /** Seeds in both files. */
  pairedSeeds: number[];
  /** Paired seeds left out of relativeChange: the current gate is 0 and the candidate's is not. */
  skippedSeeds: number[];
  /** Seeds in one file only, left out of everything. */
  unpairedSeeds: number[];
  current: SideStats;
  candidate: SideStats;
}

export interface GroupResult {
  /** Mean of the group's scenarios' relativeChange. */
  relativeChange: number;
  /** The candidate's censored traces in the group. */
  censoredSeeds: number;
  /** The current value's censored traces in the group. */
  currentCensoredSeeds: number;
  scenarios: string[];
}

export interface Comparison {
  current: string;
  candidate: string;
  cells: Cell[];
  /** The deciding set, one entry per group, in the order the groups first appear. */
  byModel: Map<string, GroupResult>;
  /** Mean of the groups' relativeChange; NaN when no scenario has a group. */
  mean: number;
  /** Groups more than SLOWER_LIMIT slower. */
  slowerModels: string[];
  /** Guard scenarios more than SLOWER_LIMIT slower. */
  slowerGuards: string[];
  /** The candidate's censored traces in the deciding set. */
  censoredSeeds: number;
  /** The current value's censored traces in the deciding set. */
  currentCensoredSeeds: number;
  /** Probe shares over every compared scenario. */
  probes: { current: ProbeShares; candidate: ProbeShares };
}

export interface CompareOptions {
  /** A scenario's group, or null for a guard. Default baseModelOf. */
  groupOf?: (scenario: string) => string | null;
}

const BASE_SCENARIO =
  /^(careful|typical|fuzzy|sloppy)-(unordered|rough|ranked)-(n\d+|groups-n\d+|pairs-n\d+)$/;

/** The model of a base scenario (and of its groups-only and pairs-only variants); null for any other. */
export function baseModelOf(scenario: string): string | null {
  return BASE_SCENARIO.exec(scenario)?.[1] ?? null;
}

/** Each scenario its own group: every compared scenario decides, as for the three "Much better" habits. */
export function scenarioGroupOf(scenario: string): string {
  return scenario;
}

/**
 * The groupOf that SIM_GROUPS names: `model` (unset or empty, baseModelOf) or
 * `scenario` (scenarioGroupOf). Throws, naming the value, for anything else.
 */
export function parseGroups(text: string | undefined): (scenario: string) => string | null {
  if (text === undefined || text === '' || text === 'model') return baseModelOf;
  if (text === 'scenario') return scenarioGroupOf;
  throw new Error(`SIM_GROUPS: ${text} is not a grouping (model, scenario)`);
}

/** The list size from a name ending in `-n<size>`, or null. */
function sizeOf(scenario: string): number | null {
  const match = /-n(\d+)$/.exec(scenario);
  return match ? Number(match[1]) : null;
}

const mean = (values: readonly number[]): number =>
  values.length === 0 ? NaN : values.reduce((sum, v) => sum + v, 0) / values.length;

/** A trace's answers to the gate, a censored one counted as its last sample's answers. */
function gateOf(trace: Trace): { answers: number; censored: boolean } {
  if (trace.answersToGate !== null) return { answers: trace.answersToGate, censored: false };
  return { answers: trace.samples[trace.samples.length - 1]?.answers ?? 0, censored: true };
}

function tracesBySeed(file: ResultFile, scenario: string): Map<number, Trace> {
  const run = file.runs.find((r) => r.scenario === scenario);
  if (!run) throw new Error(`compare: scenario ${scenario} is not in the result file ${file.label}`);
  const bySeed = new Map<number, Trace>();
  for (const trace of run.traces) {
    if (bySeed.has(trace.seed)) {
      throw new Error(`compare: ${file.label} has seed ${trace.seed} twice for ${scenario}`);
    }
    bySeed.set(trace.seed, trace);
  }
  return bySeed;
}

/** The sample nearest `target` answers, the earlier on a tie. */
function nearest(samples: readonly Sample[], target: number): Sample | undefined {
  let best: Sample | undefined;
  for (const s of samples) {
    if (!best || Math.abs(s.answers - target) < Math.abs(best.answers - target)) best = s;
  }
  return best;
}

function quality(picked: (Sample | undefined)[]): Quality {
  const found = picked.filter((s): s is Sample => s !== undefined);
  return {
    within5: mean(found.map((s) => s.measures.within5)),
    within1: mean(found.map((s) => s.measures.within1)),
  };
}

function horizonShare(probes: readonly MoveProbe[], horizon: ProbeHorizon): HorizonShare {
  const field = HORIZON_FIELD[horizon];
  // Older files lack the 4n and 8n fields: undefined counts as not measured, as null does.
  const values = probes.map((p) => p[field]).filter((d): d is number => typeof d === 'number');
  const kept = values.filter((d) => d <= PROBE_KEPT).length;
  return {
    measured: values.length,
    kept,
    share: values.length === 0 ? null : kept / values.length,
    meanDisplacement: values.length === 0 ? null : mean(values),
  };
}

function probeShare(traces: readonly Trace[], kind: 'near' | 'far'): ProbeShare {
  const probes = traces.flatMap((t) => t.probes).filter((p) => p.kind === kind);
  return {
    made: probes.length,
    after: {
      '2n': horizonShare(probes, '2n'),
      '4n': horizonShare(probes, '4n'),
      '8n': horizonShare(probes, '8n'),
    },
  };
}

function probeShares(traces: readonly Trace[]): ProbeShares {
  return {
    near: probeShare(traces, 'near'),
    far: probeShare(traces, 'far'),
    skipped: traces.reduce((sum, t) => sum + t.probesSkipped, 0),
  };
}

function sideStats(traces: readonly Trace[], n: number | null): SideStats {
  return {
    last: quality(traces.map((t) => t.samples[t.samples.length - 1])),
    at4n: n === null ? null : quality(traces.map((t) => nearest(t.samples, 4 * n))),
    at8n: n === null ? null : quality(traces.map((t) => nearest(t.samples, 8 * n))),
    probes: probeShares(traces),
  };
}

function compareScenario(
  current: ResultFile,
  candidate: ResultFile,
  scenario: string,
  model: string | null,
): { cell: Cell; currentTraces: Trace[]; candidateTraces: Trace[] } {
  const ours = tracesBySeed(current, scenario);
  const theirs = tracesBySeed(candidate, scenario);
  const pairedSeeds = [...ours.keys()].filter((seed) => theirs.has(seed)).sort((a, b) => a - b);
  const unpairedSeeds = [...new Set([...ours.keys(), ...theirs.keys()])]
    .filter((seed) => !(ours.has(seed) && theirs.has(seed)))
    .sort((a, b) => a - b);
  const currentTraces = pairedSeeds.map((seed) => ours.get(seed) as Trace);
  const candidateTraces = pairedSeeds.map((seed) => theirs.get(seed) as Trace);

  const changes: number[] = [];
  const skippedSeeds: number[] = [];
  pairedSeeds.forEach((seed, k) => {
    const before = gateOf(currentTraces[k] as Trace).answers;
    const after = gateOf(candidateTraces[k] as Trace).answers;
    if (before === 0) {
      if (after === 0) changes.push(0);
      else skippedSeeds.push(seed);
      return;
    }
    changes.push((after - before) / before);
  });

  const n = sizeOf(scenario);
  const gates = (traces: Trace[]) => traces.map(gateOf);
  const cell: Cell = {
    scenario,
    model,
    meanGate: mean(gates(candidateTraces).map((g) => g.answers)),
    censored: gates(candidateTraces).filter((g) => g.censored).length,
    currentMeanGate: mean(gates(currentTraces).map((g) => g.answers)),
    currentCensored: gates(currentTraces).filter((g) => g.censored).length,
    relativeChange: changes.length === 0 ? null : mean(changes),
    pairedSeeds,
    skippedSeeds,
    unpairedSeeds,
    current: sideStats(currentTraces, n),
    candidate: sideStats(candidateTraces, n),
  };
  return { cell, currentTraces, candidateTraces };
}

/** Compares a candidate run with the current value's run over the named scenarios. See the module comment. */
export function compare(
  current: ResultFile,
  candidate: ResultFile,
  scenarios: string[],
  options: CompareOptions = {},
): Comparison {
  const groupOf = options.groupOf ?? baseModelOf;
  const cells: Cell[] = [];
  const allCurrent: Trace[] = [];
  const allCandidate: Trace[] = [];
  for (const scenario of scenarios) {
    const { cell, currentTraces, candidateTraces } = compareScenario(
      current,
      candidate,
      scenario,
      groupOf(scenario),
    );
    cells.push(cell);
    allCurrent.push(...currentTraces);
    allCandidate.push(...candidateTraces);
  }

  const byModel = new Map<string, GroupResult>();
  for (const cell of cells) {
    if (cell.model === null) continue;
    const group = byModel.get(cell.model) ?? {
      relativeChange: NaN,
      censoredSeeds: 0,
      currentCensoredSeeds: 0,
      scenarios: [],
    };
    group.censoredSeeds += cell.censored;
    group.currentCensoredSeeds += cell.currentCensored;
    group.scenarios.push(cell.scenario);
    byModel.set(cell.model, group);
  }
  for (const group of byModel.values()) {
    const changes = cells
      .filter((c) => group.scenarios.includes(c.scenario) && c.relativeChange !== null)
      .map((c) => c.relativeChange as number);
    group.relativeChange = mean(changes);
  }
  // A group whose every seed was skipped has no change to average; it stays in byModel, out of the mean.
  const groupChanges = [...byModel.values()].map((g) => g.relativeChange).filter((c) => !Number.isNaN(c));

  return {
    current: current.label,
    candidate: candidate.label,
    cells,
    byModel,
    mean: mean(groupChanges),
    slowerModels: [...byModel.entries()].filter(([, g]) => g.relativeChange > SLOWER_LIMIT).map(([m]) => m),
    slowerGuards: cells
      .filter((c) => c.model === null && c.relativeChange !== null && c.relativeChange > SLOWER_LIMIT)
      .map((c) => c.scenario),
    censoredSeeds: [...byModel.values()].reduce((sum, g) => sum + g.censoredSeeds, 0),
    currentCensoredSeeds: [...byModel.values()].reduce((sum, g) => sum + g.currentCensoredSeeds, 0),
    probes: { current: probeShares(allCurrent), candidate: probeShares(allCandidate) },
  };
}

export type VerdictStatus = 'chosen' | 'eligible' | 'rejected' | 'ineligible' | 'no gain';

export interface Verdict {
  label: string;
  comparison: Comparison;
  status: VerdictStatus;
  /** Why, in a few words. */
  note: string;
}

export interface Decision {
  current: string;
  /** The chosen label: a candidate's, or the current value's. */
  chosen: string;
  /** "no gain" when the current value stays; otherwise the chosen candidate's change. */
  reason: string;
  /** One row per candidate, in the order given. */
  table: Verdict[];
}

const percent = (share: number): string => `${share >= 0 ? '+' : ''}${(share * 100).toFixed(1)}%`;

function judge(comparison: Comparison): { status: VerdictStatus; note: string } {
  const slower = [...comparison.slowerModels, ...comparison.slowerGuards];
  if (slower.length > 0) {
    return { status: 'rejected', note: `more than ${SLOWER_LIMIT * 100}% slower on ${slower.join(', ')}` };
  }
  if (Number.isNaN(comparison.mean)) return { status: 'no gain', note: 'no deciding scenario' };
  if (comparison.mean > -GAIN_MARGIN) {
    return { status: 'no gain', note: `mean ${percent(comparison.mean)}, not ${GAIN_MARGIN * 100}% faster` };
  }
  if (comparison.censoredSeeds > comparison.currentCensoredSeeds) {
    return {
      status: 'ineligible',
      note: `mean ${percent(comparison.mean)} but ${comparison.censoredSeeds} censored seeds against ${comparison.currentCensoredSeeds}`,
    };
  }
  return { status: 'eligible', note: `mean ${percent(comparison.mean)}` };
}

/** Applies the deciding rule (see the module comment) to each candidate against the current value. */
export function decide(
  current: ResultFile,
  candidates: ResultFile[],
  scenarios: string[],
  options: CompareOptions = {},
): Decision {
  const table: Verdict[] = candidates.map((candidate) => {
    const comparison = compare(current, candidate, scenarios, options);
    return { label: candidate.label, comparison, ...judge(comparison) };
  });
  let best: Verdict | undefined;
  for (const row of table) {
    if (row.status === 'eligible' && (!best || row.comparison.mean < best.comparison.mean)) best = row;
  }
  if (best) {
    best.status = 'chosen';
    return {
      current: current.label,
      chosen: best.label,
      reason: `fewest answers to the gate: ${percent(best.comparison.mean)} against ${current.label}`,
      table,
    };
  }
  const grouped = table.some((row) => !Number.isNaN(row.comparison.mean));
  return {
    current: current.label,
    chosen: current.label,
    reason:
      grouped || table.length === 0
        ? 'no gain'
        : 'no deciding scenario: every compared scenario is a guard, so the current value stays',
    table,
  };
}

/**
 * The scenarios to compare: those of the current file (`names`, in its order)
 * that the filter selects by name or by a tag. Tags come from the scenario
 * catalogue; a name the catalogue no longer has can still be selected by name.
 */
export function comparedScenarios(
  names: readonly string[],
  filter: RegExp | undefined,
  catalogue: readonly { name: string; tags?: string[] }[],
): string[] {
  const tags = new Map(catalogue.map((s) => [s.name, s.tags ?? []]));
  return selectScenarios(
    names.map((name) => ({ name, tags: tags.get(name) ?? [] })),
    filter,
  ).map((s) => s.name);
}

const fixed = (value: number | null | undefined, digits = 2): string =>
  value === null || value === undefined || Number.isNaN(value) ? 'n/a' : value.toFixed(digits);

function gateText(answers: number, censored: number, n: number | null): string {
  const multiple = n === null || n === 0 ? '' : ` (${fixed(answers / n)}n)`;
  return `${Math.round(answers)}${multiple}${censored > 0 ? `, ${censored} censored` : ''}`;
}

const pair = (a: number | null | undefined, b: number | null | undefined): string =>
  `${fixed(a)} / ${fixed(b)}`;

/**
 * The decision as Markdown: the verdicts, then per candidate the scenario
 * table, the groups and the probe shares. Written to compare-<first candidate>.md.
 */
export function formatDecision(
  decision: Decision,
  current: ResultFile,
  filter: string,
  grouping: 'model' | 'scenario' = 'model',
): string {
  const lines: string[] = [];
  const settings = (file: ResultFile): string =>
    `overrides ${JSON.stringify(file.overrides)}, picker ${file.picker ?? 'current'}, seeds ${file.seeds.join(' ')}`;
  lines.push(`# Compare against ${current.label}`, '');
  lines.push(`Current: ${current.label} (${settings(current)}).`);
  lines.push(`Scenarios: ${filter === '' ? 'every scenario of the current file' : `filter ${filter}`}.`);
  lines.push(
    grouping === 'model'
      ? 'Groups: the base models (the mean is over them; every other scenario is a guard).'
      : 'Groups: each scenario its own (the mean is over every compared scenario).',
  );
  lines.push(
    'Seeds are paired by number. A run that never reached the gate counts as its last sample (its budget, or fewer on an early stop) and is counted as censored.',
    '',
  );
  lines.push(`Decision: **${decision.chosen}** (${decision.reason}).`, '');
  lines.push('| Candidate | Mean change | Censored seeds (candidate / current) | Verdict |');
  lines.push('| --------- | ----------: | -----------------------------------: | ------- |');
  for (const row of decision.table) {
    const c = row.comparison;
    lines.push(
      `| ${row.label} | ${Number.isNaN(c.mean) ? 'n/a' : percent(c.mean)} | ${c.censoredSeeds} / ${c.currentCensoredSeeds} | ${row.status}: ${row.note} |`,
    );
  }

  for (const row of decision.table) {
    const c = row.comparison;
    lines.push('', `## ${row.label}`, '');
    lines.push(
      '| Scenario | Group | Gate, current | Gate, candidate | Change | within5 last | within1 at 4n | within1 at 8n | Notes |',
    );
    lines.push(
      '| -------- | ----- | ------------: | --------------: | -----: | -----------: | ------------: | ------------: | ----- |',
    );
    for (const cell of c.cells) {
      const n = sizeOf(cell.scenario);
      const notes = [
        cell.skippedSeeds.length > 0 ? `skipped seeds ${cell.skippedSeeds.join(' ')} (current gate 0)` : '',
        cell.unpairedSeeds.length > 0 ? `unpaired seeds ${cell.unpairedSeeds.join(' ')}` : '',
      ]
        .filter((s) => s !== '')
        .join('; ');
      lines.push(
        `| ${cell.scenario} | ${cell.model ?? 'guard'} | ${gateText(cell.currentMeanGate, cell.currentCensored, n)} | ${gateText(cell.meanGate, cell.censored, n)} | ${cell.relativeChange === null ? 'n/a' : percent(cell.relativeChange)} | ${pair(cell.current.last.within5, cell.candidate.last.within5)} | ${pair(cell.current.at4n?.within1, cell.candidate.at4n?.within1)} | ${pair(cell.current.at8n?.within1, cell.candidate.at8n?.within1)} | ${notes} |`,
      );
    }
    if (c.byModel.size > 0) {
      lines.push('', '| Group | Change | Censored seeds (candidate / current) |');
      lines.push('| ----- | -----: | -----------------------------------: |');
      for (const [group, result] of c.byModel) {
        lines.push(
          `| ${group} | ${Number.isNaN(result.relativeChange) ? 'n/a' : percent(result.relativeChange)} | ${result.censoredSeeds} / ${result.currentCensoredSeeds} |`,
        );
      }
    }
    const { current: ours, candidate: theirs } = c.probes;
    if (
      ours.near.made + ours.far.made + theirs.near.made + theirs.far.made + ours.skipped + theirs.skipped >
      0
    ) {
      lines.push(
        '',
        `Probes back within ${PROBE_KEPT * 100}% of their true place a further 2n, 4n and 8n answers after the move (a probe is measured at a horizon only if the run lasted that long and the item was still shown):`,
        '',
      );
      lines.push('| Side | Kind | Horizon | Made | Measured | Kept | Share | Mean displacement |');
      lines.push('| ---- | ---- | ------- | ---: | -------: | ---: | ----: | ----------------: |');
      for (const [side, shares] of [
        ['current', ours],
        ['candidate', theirs],
      ] as const) {
        for (const kind of ['near', 'far'] as const) {
          for (const horizon of PROBE_HORIZONS) {
            const at = shares[kind].after[horizon];
            lines.push(
              `| ${side} | ${kind} | ${horizon} | ${shares[kind].made} | ${at.measured} | ${at.kept} | ${fixed(at.share)} | ${fixed(at.meanDisplacement, 3)} |`,
            );
          }
        }
      }
      lines.push('', `Probe moves skipped: current ${ours.skipped}, candidate ${theirs.skipped}.`);
    }
  }
  lines.push(
    '',
    'within5 and within1 columns are current / candidate, means over the paired seeds. A change is the mean over paired seeds of (candidate - current) / current.',
  );
  return `${lines.join('\n')}\n`;
}
