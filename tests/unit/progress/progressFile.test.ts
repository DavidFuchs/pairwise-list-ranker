import { describe, expect, it } from 'vitest';

import {
  applyProgressFile,
  buildProgressFile,
  itemKeys,
  parseProgressFile,
} from '@/lib/progress/progressFile';
import type { ListItem } from '@/types/list';
import type { ComparisonEvent } from '@/types/ranking';

const NOW = '2026-08-15T12:00:00.000Z';

function item(id: string, value: ListItem['value'], active = true): ListItem {
  return { id, listId: 'l', value, active, createdAt: NOW, updatedAt: NOW };
}

function event(id: string, left: string, right: string, outcome: ComparisonEvent['outcome']): ComparisonEvent {
  return { id, listId: 'l', leftItemId: left, rightItemId: right, outcome, createdAt: NOW };
}

let n = 0;
const createId = () => `new-${(n += 1)}`;

describe('progress file', () => {
  it('names an item by its value, regardless of key order', () => {
    const a = itemKeys([item('1', { a: 1, b: 2 })]).get('1');
    const b = itemKeys([item('9', { b: 2, a: 1 })]).get('9');
    expect(a).toBe(b);
  });

  it('tells identical entries apart by order of appearance', () => {
    const keys = itemKeys([item('1', 'x'), item('2', 'x'), item('3', 'y')]);
    expect(new Set(keys.values()).size).toBe(3);
  });

  it('round-trips onto freshly imported items with new ids', () => {
    const before = [item('a', 'Tacos'), item('b', 'Pizza'), item('c', 'Sushi', false)];
    const file = buildProgressFile(before, [event('e1', 'a', 'b', 'left_strong')], ['movies'], NOW);

    const parsed = parseProgressFile(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;

    const after = [item('x', 'Tacos'), item('y', 'Pizza'), item('z', 'Sushi')];
    const applied = applyProgressFile(parsed.file, after, 'l2', createId);

    expect(applied.events).toHaveLength(1);
    expect(applied.events[0]).toMatchObject({ leftItemId: 'x', rightItemId: 'y', outcome: 'left_strong' });
    expect(applied.removedIds).toEqual(['z']);
    expect(applied.unmatchedEvents).toBe(0);
  });

  it('counts, rather than guesses at, items edited since the save', () => {
    const before = [item('a', 'Tacos'), item('b', 'Pizza')];
    const file = buildProgressFile(before, [event('e1', 'a', 'b', 'left')], [], NOW);

    const after = [item('x', 'Tacos'), item('y', 'Pizza (edited)')];
    const applied = applyProgressFile(file, after, 'l', createId);

    expect(applied.events).toHaveLength(0);
    expect(applied.unmatchedEvents).toBe(1);
  });

  it('rejects text that is not a progress file', () => {
    expect(parseProgressFile('nope').ok).toBe(false);
    expect(parseProgressFile('{"kind":"other"}').ok).toBe(false);
  });
});
