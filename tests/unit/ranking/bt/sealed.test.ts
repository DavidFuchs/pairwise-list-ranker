import { describe, expect, it } from 'vitest';

import { EngineSession, replayWithStats } from '@/lib/ranking/bt/engine';
import { openSealed, openSealedEntry, sealSnapshot } from '@/lib/ranking/bt/sealed';
import type { EngineSnapshot } from '@/lib/ranking/bt/snapshot';
import { drivenHistory } from '@/tests/helpers/engineCorpus';
import type { EngineList } from '@/types/rankingEvents';

const list: EngineList = drivenHistory({
  n: 20,
  events: 60,
  seed: 5,
  user: 'typical',
  startingOrder: 'rough',
  mix: { placement: 0.12, undo: 0 },
});

function snapshotOf(l: EngineList): EngineSnapshot {
  const snapshot = new EngineSession(l).exportSnapshot();
  if (snapshot === null) throw new Error('no snapshot');
  return snapshot;
}

const snapshot = snapshotOf(list);
const sealed = sealSnapshot(snapshot);

describe('sealed snapshots', () => {
  it('seal and open round-trip', () => {
    expect(JSON.parse(sealed)).toMatchObject({ v: 1, sum: expect.stringMatching(/^[0-9a-f]{8}$/) });
    const opened = openSealed(list, sealed);
    expect(opened).toEqual(JSON.parse(JSON.stringify(snapshot)));
    expect(replayWithStats(list, { snapshot: opened }).fromEvent).toBe(list.events.length);
    // The same snapshot always seals to the same text, whatever order its keys were set in.
    const reordered = Object.fromEntries(Object.entries(snapshot).reverse()) as unknown as EngineSnapshot;
    expect(sealSnapshot(reordered)).toBe(sealed);
  });

  it('a snapshot ending in a drag keeps its earlier prior through the seal', () => {
    const lastDrag = list.events.findLastIndex((event) => event.kind === 'placement');
    const l = { ...list, events: list.events.slice(0, lastDrag + 1) };
    const dragged = snapshotOf(l);
    expect(dragged.displaced).toBeDefined();
    expect(openSealed(l, sealSnapshot(dragged))).toEqual(dragged);
  });

  it('a flipped character, a truncated string, a wrong checksum, a wrong version or non-JSON opens as null without throwing', () => {
    const body = sealed.indexOf('"strengths"');
    const digit = sealed.slice(body).search(/[0-9]/) + body;
    const flipped = `${sealed.slice(0, digit)}${sealed[digit] === '1' ? '2' : '1'}${sealed.slice(digit + 1)}`;
    expect(JSON.parse(flipped)).toBeTruthy();
    expect(openSealed(list, flipped)).toBeNull();
    for (const cut of [1, 10, sealed.length / 2, sealed.length - 1]) {
      expect(openSealed(list, sealed.slice(0, cut))).toBeNull();
    }
    const parsed = JSON.parse(sealed) as { v: number; sum: string; snapshot: unknown };
    expect(openSealed(list, JSON.stringify({ ...parsed, sum: '00000000' }))).toBeNull();
    expect(openSealed(list, JSON.stringify({ ...parsed, sum: 12 }))).toBeNull();
    expect(openSealed(list, JSON.stringify({ ...parsed, v: 2 }))).toBeNull();
    expect(openSealed(list, JSON.stringify(snapshot))).toBeNull();
    for (const junk of [
      '',
      'not json',
      '{',
      'null',
      '42',
      '[]',
      '{"v":1}',
      '{"v":1,"sum":"0","snapshot":null}',
    ]) {
      expect(openSealed(list, junk)).toBeNull();
    }
    for (const junk of [undefined, null, 42, {}, [], parsed, Symbol('x')]) {
      expect(openSealed(list, junk)).toBeNull();
    }
  });

  it('a sealed snapshot of another list opens as null', () => {
    expect(openSealed({ ...list, startingOrder: 'ranked' }, sealed)).toBeNull();
    expect(openSealed({ ...list, originalItemIds: [...list.originalItemIds, 'extra'] }, sealed)).toBeNull();
    expect(openSealed({ ...list, events: list.events.slice(0, -1) }, sealed)).toBeNull();
    const other = drivenHistory({ n: 20, events: 60, seed: 6, user: 'typical', startingOrder: 'rough' });
    expect(openSealed(other, sealed)).toBeNull();
  });

  it('a sealed snapshot whose priors were nudged consistently with its checksum is still caught by the walk', () => {
    // Hand-mixing, not corruption: the checksum is recomputed, so only the restore walk can reject it.
    const seedSlot = snapshot.placedAt.indexOf(-1);
    const nudged = {
      ...snapshot,
      priorMean: snapshot.priorMean.map((m, slot) => (slot === seedSlot ? m + 1 : m)),
    };
    expect(openSealed(list, sealSnapshot(nudged))).toBeNull();
  });
});

describe('the view sealed with a snapshot', () => {
  const session = new EngineSession(list);
  const { ranked, unrecognized, nextPair } = session.state;
  const shown = { ranked, unrecognized, nextPair };
  const withView = sealSnapshot(snapshot, shown);

  it('round-trips with the snapshot', () => {
    const entry = openSealedEntry(list, withView);

    expect(entry?.snapshot).toEqual(JSON.parse(JSON.stringify(snapshot)));
    expect(entry?.shown).toEqual(JSON.parse(JSON.stringify(shown)));
    expect(openSealed(list, withView)).toEqual(entry?.snapshot);
  });

  it('is absent from an entry sealed without one, which opens as it always did', () => {
    expect(openSealedEntry(list, sealed)).toEqual({
      snapshot: JSON.parse(JSON.stringify(snapshot)),
      shown: null,
    });
  });

  it('does not change the snapshot checksum', () => {
    expect(JSON.parse(withView)).toMatchObject({ v: 1, sum: JSON.parse(sealed).sum });
  });

  it('is dropped, and the snapshot kept, when its own checksum fails', () => {
    const text = JSON.parse(withView) as { shown: { sum: string; view: { ranked: string[] } } };
    text.shown.view.ranked = [...text.shown.view.ranked].reverse();

    const entry = openSealedEntry(list, JSON.stringify(text));
    expect(entry?.shown).toBeNull();
    expect(entry?.snapshot).toEqual(JSON.parse(JSON.stringify(snapshot)));
  });

  it.each([
    ['ids that are not strings', { ...shown, ranked: [1, 2] }],
    ['a pair of three', { ...shown, nextPair: ['a', 'b', 'c'] }],
    ['no unrecognized list', { ...shown, unrecognized: undefined }],
    ['a pair that is not a list', { ...shown, nextPair: 'ab' }],
  ])('is dropped, and the snapshot kept, with %s', (_name, view) => {
    const entry = openSealedEntry(list, sealSnapshot(snapshot, view as unknown as typeof shown));

    expect(entry?.shown).toBeNull();
    expect(entry?.snapshot).toEqual(JSON.parse(JSON.stringify(snapshot)));
  });
});
