import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { OVERRIDABLE } from '@/tests/sim/overrides';

/**
 * scripts/sim-sweep.mjs is plain Node and cannot import the TypeScript list of
 * overridable constants, so it keeps its own. These tests read that list from
 * the script's text and hold it equal to OVERRIDABLE, and check the argument
 * handling with --dry-run, which prints the runs without starting them.
 */
const SCRIPT = join(process.cwd(), 'scripts', 'sim-sweep.mjs');
const TIMEOUT = 120_000;

function sweep(...args: string[]): { status: number | null; stdout: string; stderr: string } {
  const out = spawnSync(process.execPath, [SCRIPT, ...args], { encoding: 'utf8', timeout: TIMEOUT });
  return { status: out.status, stdout: out.stdout, stderr: out.stderr };
}

describe('the sweep script', () => {
  it('keeps the same list of constants as tests/sim/overrides.ts', () => {
    const text = readFileSync(SCRIPT, 'utf8');
    const block = /const CONSTANTS = \{([\s\S]*?)\n\};/.exec(text)?.[1];
    expect(block).toBeDefined();
    const names = [...block!.matchAll(/^ {2}([A-Z_]+):/gm)].map((m) => m[1]);
    expect(names).toEqual([...OVERRIDABLE]);
  });

  it(
    'plans one run per value, with the label, the overrides, the filter, the seeds and the size',
    () => {
      const out = sweep(
        '--dry-run',
        '--constant',
        'STRONG_WEIGHT',
        '--values',
        '1.75,2.0',
        '--size',
        'ci',
        '--seeds',
        '1',
        '--filter',
        'cal-strong',
      );
      expect(out.stderr).toBe('');
      expect(out.status).toBe(0);
      expect(out.stdout).toContain('SIM_LABEL=STRONG_WEIGHT-1.75 ');
      expect(out.stdout).toContain('SIM_OVERRIDES={"STRONG_WEIGHT":1.75}');
      // A value is written as a number, so 2.0 gives the label STRONG_WEIGHT-2.
      expect(out.stdout).toContain('SIM_LABEL=STRONG_WEIGHT-2 ');
      expect(out.stdout).toContain('SIM_OVERRIDES={"STRONG_WEIGHT":2}');
      expect(out.stdout).toContain('SIM_FILTER=cal-strong');
      expect(out.stdout).toContain('SIM_SEEDS=1');
      expect(out.stdout).toContain('SIM_SIZE=ci');
      expect(out.stdout).toContain('SIM_PICKER=current');
      expect(out.stdout).toContain('npx vitest run --config vitest.sim.config.mts tests/sim/baseline.sim.ts');
      expect(out.stdout.match(/^run /gm)).toHaveLength(2);
    },
    TIMEOUT,
  );

  it(
    'exits nonzero naming an unknown constant',
    () => {
      const out = sweep('--dry-run', '--constant', 'NOPE', '--values', '1');
      expect(out.status).not.toBe(0);
      expect(out.stderr).toContain('NOPE');
      expect(out.stdout).not.toMatch(/^run /m);
    },
    TIMEOUT,
  );

  it(
    'refuses a value that is not a finite number, naming the constant',
    () => {
      for (const bad of ['abc', 'Infinity', 'NaN', '', '1,,2']) {
        const out = sweep('--dry-run', '--constant', 'PAIR_WEIGHT', '--values', bad);
        expect(out.status, bad).not.toBe(0);
        expect(out.stderr, bad).toContain('PAIR_WEIGHT');
      }
    },
    TIMEOUT,
  );

  it(
    'refuses a value the constant cannot take, and takes a draw weight of 0',
    () => {
      for (const [name, bad] of [
        ['STRONG_WEIGHT', '0'],
        ['DRAW_WEIGHT_EACH_WAY', '-0.1'],
        ['PLACEMENT_SD_FRACTION', '0'],
        ['REPEAT_FACTOR', '1.5'],
      ] as const) {
        const out = sweep('--dry-run', '--constant', name, '--values', bad);
        expect(out.status, `${name} ${bad}`).not.toBe(0);
        expect(out.stderr, `${name} ${bad}`).toContain(name);
      }
      const draw = sweep('--dry-run', '--constant', 'DRAW_WEIGHT_EACH_WAY', '--values', '0,0.1');
      expect(draw.status).toBe(0);
      expect(draw.stdout).toContain('SIM_LABEL=DRAW_WEIGHT_EACH_WAY-0 ');
    },
    TIMEOUT,
  );

  it(
    'refuses the constants of the removed group sorts',
    () => {
      for (const name of ['GROUP_REORDERED_WEIGHT', 'AUTO_GROUPS_PER_ITEM']) {
        const out = sweep('--dry-run', '--constant', name, '--values', '1');
        expect(out.status, name).not.toBe(0);
        expect(out.stderr, name).toContain(name);
      }
    },
    TIMEOUT,
  );

  it(
    'runs the adjacent picker once, labelled picker-adjacent, when no constant is given',
    () => {
      const out = sweep('--dry-run', '--picker', 'adjacent', '--filter', 'cal-pairs');
      expect(out.stderr).toBe('');
      expect(out.status).toBe(0);
      expect(out.stdout.match(/^run /gm)).toHaveLength(1);
      expect(out.stdout).toContain('SIM_LABEL=picker-adjacent ');
      expect(out.stdout).toContain('SIM_PICKER=adjacent');
      expect(out.stdout).not.toContain('SIM_OVERRIDES');
    },
    TIMEOUT,
  );

  it(
    'needs a constant and values unless a picker is named, and refuses an unknown option or picker',
    () => {
      for (const args of [
        [],
        ['--constant', 'STRONG_WEIGHT'],
        ['--values', '1'],
        ['--constant', 'STRONG_WEIGHT', '--values', '1', '--bogus', 'x'],
        ['--picker', 'random'],
        ['--constant', 'STRONG_WEIGHT', '--values', '1', '--parallel', '0'],
        ['--constant', 'STRONG_WEIGHT', '--values', '1', '--size', 'huge'],
        ['--constant', 'STRONG_WEIGHT', '--values', '1', '--seeds', '1.5'],
        ['--constant', 'STRONG_WEIGHT', '--values', '1,1.0'],
      ]) {
        const out = sweep('--dry-run', ...args);
        expect(out.status, args.join(' ')).not.toBe(0);
        expect(out.stderr, args.join(' ')).toMatch(/sim-sweep/);
      }
    },
    TIMEOUT,
  );
});
