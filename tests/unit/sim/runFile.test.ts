import { describe, expect, it } from 'vitest';

import { checkLabel, parseFilter, resultFileName, selectScenarios } from '@/tests/sim/runFile';

describe('checkLabel', () => {
  it('refuses overrides under the baseline label', () => {
    expect(() => checkLabel('baseline', { STRONG_WEIGHT: 2 }, 'current')).toThrow(/SIM_LABEL/);
  });
  it('refuses the adjacent picker under the baseline label', () => {
    expect(() => checkLabel('baseline', {}, 'adjacent')).toThrow(/SIM_LABEL/);
    expect(() => checkLabel('baseline', {}, 'adjacent')).toThrow(/SIM_PICKER/);
  });
  it('allows the baseline with no overrides and the current picker, and other labels with either', () => {
    expect(() => checkLabel('baseline', {}, 'current')).not.toThrow();
    expect(() => checkLabel('strong-2', { STRONG_WEIGHT: 2 }, 'current')).not.toThrow();
    expect(() => checkLabel('adjacent', {}, 'adjacent')).not.toThrow();
  });
});

describe('checkLabel with a filter', () => {
  it('refuses a filter under the baseline label', () => {
    expect(() => checkLabel('baseline', {}, 'current', 'cal-strong')).toThrow(/SIM_FILTER/);
    expect(() => checkLabel('baseline', {}, 'current', 'cal-strong')).toThrow(/SIM_LABEL/);
  });
  it('allows a filter under another label, and the baseline with none', () => {
    expect(() => checkLabel('strong-2', {}, 'current', 'cal-strong')).not.toThrow();
    expect(() => checkLabel('baseline', {}, 'current', '')).not.toThrow();
    expect(() => checkLabel('baseline', {}, 'current', undefined)).not.toThrow();
  });
});

describe('parseFilter', () => {
  it('is undefined when unset or empty', () => {
    expect(parseFilter(undefined)).toBeUndefined();
    expect(parseFilter('')).toBeUndefined();
  });
  it('builds a regular expression', () => {
    expect(parseFilter('cal-(a|b)')?.test('cal-b')).toBe(true);
  });
  it('names an invalid regular expression', () => {
    expect(() => parseFilter('cal-(')).toThrow(/SIM_FILTER/);
    expect(() => parseFilter('cal-(')).toThrow(/cal-\(/);
  });
});

describe('selectScenarios', () => {
  const all = [
    { name: 'alpha-n100', tags: ['cal-groups'] },
    { name: 'beta-n100', tags: ['cal-pairs', 'other'] },
    { name: 'gamma-n100' },
  ];
  it('keeps every scenario with no filter', () => {
    expect(selectScenarios(all, undefined)).toHaveLength(3);
  });
  it('matches the name or any tag', () => {
    expect(selectScenarios(all, /^gamma/).map((s) => s.name)).toEqual(['gamma-n100']);
    expect(selectScenarios(all, /^cal-pairs$/).map((s) => s.name)).toEqual(['beta-n100']);
    expect(selectScenarios(all, /cal-|gamma/)).toHaveLength(3);
    expect(selectScenarios(all, /nothing/)).toEqual([]);
  });
  it('makes the run complete when every selected scenario ran, and partial otherwise', () => {
    const selected = selectScenarios(all, /cal-/);
    expect(resultFileName('x', selected.length, selected.length)).toBe('x.json');
    expect(resultFileName('x', selected.length - 1, selected.length)).toBe('x.partial.json');
  });
});

describe('resultFileName', () => {
  it('names a complete run <label>.json and an incomplete one <label>.partial.json', () => {
    expect(resultFileName('baseline', 43, 43)).toBe('baseline.json');
    expect(resultFileName('baseline', 1, 43)).toBe('baseline.partial.json');
  });
});
