import { describe, expect, it, vi } from 'vitest';

import { Evidence } from '@/lib/ranking/bt/evidence';
import { Timeline } from '@/lib/ranking/bt/timeline';
import { BT_CONSTANTS, OVERRIDABLE, parseOverrides, parsePicker, withOverrides } from '@/tests/sim/overrides';
import type { RankingEvent } from '@/types/rankingEvents';

// The factories run while the engine's imports above are still loading, before
// this file's own import of the overrides module is ready, so they load it themselves.
vi.mock('@/lib/ranking/bt/constants', async (original) => {
  const { OVERRIDABLE, withOverrides } = await import('@/tests/sim/overrides');
  return withOverrides(await original(), { STRONG_WEIGHT: 3 }, OVERRIDABLE);
});

describe('the overridable names', () => {
  it('are exports of the modules the setup file mocks, so a rename in lib/ fails here', async () => {
    const constants = await vi.importActual<Record<string, unknown>>('@/lib/ranking/bt/constants');
    for (const name of BT_CONSTANTS) expect(typeof constants[name], name).toBe('number');
  });

  it('are the engine constants only, with no group weight or ask-next constant', () => {
    expect([...OVERRIDABLE]).toEqual([...BT_CONSTANTS]);
    expect(OVERRIDABLE).not.toContain('GROUP_REORDERED_WEIGHT');
    expect(OVERRIDABLE).not.toContain('AUTO_GROUPS_PER_ITEM');
  });
});

describe('parseOverrides', () => {
  it('is empty with no text', () => {
    expect(parseOverrides(undefined)).toEqual({});
    expect(parseOverrides('')).toEqual({});
  });

  it('reads a JSON object of known constants', () => {
    expect(parseOverrides('{"STRONG_WEIGHT":3,"PAIR_WEIGHT":0.5}')).toEqual({
      STRONG_WEIGHT: 3,
      PAIR_WEIGHT: 0.5,
    });
  });

  it('names an unknown key', () => {
    expect(() => parseOverrides('{"STRONG_WEIGHT":3,"NOT_A_CONSTANT":1}')).toThrow(/NOT_A_CONSTANT/);
    // Constants of the removed group sorts and of the old ask-next rule are no longer overridable.
    expect(() => parseOverrides('{"GROUP_REORDERED_WEIGHT":1}')).toThrow(/GROUP_REORDERED_WEIGHT/);
    expect(() => parseOverrides('{"AUTO_GROUPS_PER_ITEM":{"rough":1}}')).toThrow(/AUTO_GROUPS_PER_ITEM/);
  });

  it('quotes text that is not a JSON object', () => {
    expect(() => parseOverrides('STRONG_WEIGHT=3')).toThrow(/STRONG_WEIGHT=3/);
    expect(() => parseOverrides('[1,2]')).toThrow(/\[1,2\]/);
    expect(() => parseOverrides('3')).toThrow(/3/);
    expect(() => parseOverrides('null')).toThrow(/null/);
  });

  it('names a constant given a value of the wrong kind', () => {
    expect(() => parseOverrides('{"STRONG_WEIGHT":"3"}')).toThrow(/STRONG_WEIGHT/);
    expect(() => parseOverrides('{"REPEAT_FACTOR":{"a":1}}')).toThrow(/REPEAT_FACTOR/);
  });
});

describe('parsePicker', () => {
  it('is the current picker with no text', () => {
    expect(parsePicker(undefined)).toBe('current');
    expect(parsePicker('')).toBe('current');
  });

  it('reads current and adjacent', () => {
    expect(parsePicker('current')).toBe('current');
    expect(parsePicker('adjacent')).toBe('adjacent');
  });

  it('names an unknown value', () => {
    expect(() => parsePicker('nearest')).toThrow(/SIM_PICKER.*nearest/);
    expect(() => parsePicker('Adjacent')).toThrow(/Adjacent/);
  });
});

describe('withOverrides', () => {
  const module = { A: 1, B: 2, C: 3 };

  it('replaces a named export and leaves the others', () => {
    const copy = withOverrides(module, { A: 10, B: 20 }, ['A', 'C']);
    expect(copy).toEqual({ A: 10, B: 2, C: 3 });
    expect(module).toEqual({ A: 1, B: 2, C: 3 });
  });

  it('refuses a name the module does not export', () => {
    expect(() => withOverrides(module, { D: 4 }, ['D'])).toThrow(/D/);
  });
});

describe('the override mocks reach the engine', () => {
  it('a much better pair weighs the overridden STRONG_WEIGHT', () => {
    const ids = ['a', 'b'];
    const timeline = new Timeline(ids);
    const evidence = new Evidence();
    const event: RankingEvent = {
      id: 'p',
      listId: 'list-1',
      createdAt: '2026-10-17T12:00:00.000Z',
      kind: 'pair',
      leftItemId: 'a',
      rightItemId: 'b',
      outcome: 'left_strong',
    };
    timeline.apply(event, 0);
    evidence.add(event, 0, timeline);
    const [a, b] = ids.map((id) => timeline.slotOf(id));
    expect(evidence.activeTerms(timeline).pairs).toEqual([{ winner: a, loser: b, weight: 3, eventIndex: 0 }]);
  });
});
