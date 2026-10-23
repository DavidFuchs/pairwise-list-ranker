import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { EngineSession } from '@/lib/ranking/bt/engine';
import {
  recordGolden,
  survivorHistories,
  toCurrentFormat,
  type GoldenRecord,
} from '@/tests/helpers/survivorsGolden';
import type { RankingEvent } from '@/types/rankingEvents';

const FIXTURE = join(__dirname, 'fixtures', 'survivors-golden.json');
const recording = process.env.UPDATE_GOLDEN === '1';

if (recording) {
  writeFileSync(FIXTURE, JSON.stringify(recordGolden(survivorHistories())) + '\n');
}

describe('survivors golden fixture', () => {
  it('every survivor history uses only the kinds that remain', () => {
    const histories = survivorHistories();
    expect(histories).toHaveLength(8);
    for (const { name, list } of histories) {
      for (const event of list.events) {
        if (event.kind === 'placement') {
          expect(event, name).not.toHaveProperty('targets');
          expect(typeof event.itemId, name).toBe('string');
        } else {
          expect(['pair', 'unrecognized', 'removal'], name).toContain(event.kind);
        }
      }
    }
  });

  it.skipIf(recording)(
    'replaying the stored histories, translated to the current format, reproduces the recorded order, next pair, strengths and uncertainties',
    async () => {
      const records = (await import('./fixtures/survivors-golden.json')).default as unknown as GoldenRecord[];
      expect(records).toHaveLength(8);
      for (const record of records) {
        for (const at of record.at) {
          const session = new EngineSession({ ...record.list, events: [] });
          for (const event of record.list.events.slice(0, at.events)) session.append(toCurrentFormat(event));
          const state = session.state;
          expect(state.ranked, record.name).toEqual(at.ranked);
          expect(state.unrecognized, record.name).toEqual(at.unrecognized);
          expect(state.nextPair, record.name).toEqual(at.nextPair);
          for (const [label, actual, expectedMap] of [
            ['strength', state.strengths, at.strengths],
            ['uncertainty', state.uncertainty, at.uncertainty],
          ] as const) {
            expect([...actual.keys()].sort(), `${record.name} ${label}`).toEqual(
              Object.keys(expectedMap).sort(),
            );
            for (const [id, expected] of Object.entries(expectedMap)) {
              expect(actual.get(id) as number, `${record.name} ${label} ${id}`).toBeCloseTo(expected, 9);
            }
          }
        }
      }
    },
  );

  it('toCurrentFormat leaves a pair and a mark unchanged', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const events = [
      { ...base, kind: 'pair', leftItemId: 'a', rightItemId: 'b', outcome: 'left' },
      { ...base, kind: 'unrecognized', itemIds: ['a'] },
    ] as unknown as RankingEvent[];
    for (const event of events) expect(toCurrentFormat(event)).toEqual(event);
  });

  it('toCurrentFormat turns a one-target placement into a flat placement', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const target = { itemId: 'a', aboveItemId: 'b', belowItemId: 'c' };
    const stored = { ...base, kind: 'placement', targets: [target] };
    expect(toCurrentFormat(stored)).toEqual({ ...base, kind: 'placement', ...target });
    const top = { ...base, kind: 'placement', targets: [{ itemId: 'a', belowItemId: 'c' }] };
    expect(toCurrentFormat(top)).toEqual({ ...base, kind: 'placement', itemId: 'a', belowItemId: 'c' });
  });

  it('toCurrentFormat refuses a placement of several targets', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const stored = { ...base, kind: 'placement', targets: [{ itemId: 'a' }, { itemId: 'b' }] };
    expect(() => toCurrentFormat(stored)).toThrow();
  });

  it('toCurrentFormat turns a membership event that only removes into a removal', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const stored = { ...base, kind: 'membership', removed: ['a', 'b'], added: [], restored: [] };
    expect(toCurrentFormat(stored)).toEqual({ ...base, kind: 'removal', itemIds: ['a', 'b'] });
  });

  it('toCurrentFormat refuses a membership event that adds or restores', () => {
    const base = { id: 'e', listId: 'l', createdAt: '2026-01-01T00:00:00.000Z' };
    const added = { ...base, kind: 'membership', removed: [], added: ['x'], restored: [] };
    const restored = { ...base, kind: 'membership', removed: [], added: [], restored: ['a'] };
    expect(() => toCurrentFormat(added)).toThrow();
    expect(() => toCurrentFormat(restored)).toThrow();
  });
});
