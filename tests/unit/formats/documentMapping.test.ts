import { describe, expect, it } from 'vitest';

import { documentFromWorkspace, workspaceFromDocument } from '@/lib/formats/documentMapping';
import type { ListItem, WorkspaceList } from '@/types/list';
import { LIST_DOCUMENT_VERSION } from '@/types/workspace';

const NOW = '2026-08-15T12:00:00.000Z';

function idFactory(): () => string {
  let next = 0;
  return () => {
    next += 1;
    return `id-${next}`;
  };
}

const list: WorkspaceList = {
  id: 'list-1',
  title: 'Favorite sci-fi films',
  description: 'Personal ranking list',
  kind: 'object',
  sortField: 'title',
  createdAt: NOW,
  updatedAt: NOW,
};

const items: ListItem[] = [
  {
    id: 'item-1',
    listId: 'list-1',
    value: { title: 'Arrival', year: 2016 },
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
  {
    id: 'item-2',
    listId: 'list-1',
    value: { title: 'Alien', year: 1979 },
    active: true,
    createdAt: NOW,
    updatedAt: NOW,
  },
];

describe('documentFromWorkspace', () => {
  it('carries list metadata into the document', () => {
    const doc = documentFromWorkspace(list, items);

    expect(doc).toMatchObject({
      version: LIST_DOCUMENT_VERSION,
      title: 'Favorite sci-fi films',
      description: 'Personal ranking list',
      kind: 'object',
      sortField: 'title',
    });
  });

  it('keeps item ids and full object values', () => {
    const doc = documentFromWorkspace(list, items);

    expect(doc.items).toEqual([
      { id: 'item-1', value: { title: 'Arrival', year: 2016 } },
      { id: 'item-2', value: { title: 'Alien', year: 1979 } },
    ]);
  });

  it('omits deleted items', () => {
    const doc = documentFromWorkspace(list, [...items, { ...items[0]!, id: 'item-3', active: false }]);

    expect(doc.items.map((entry) => entry.id)).toEqual(['item-1', 'item-2']);
  });

  it('exports items in the order given, so callers can export a ranking', () => {
    const doc = documentFromWorkspace(list, [items[1]!, items[0]!]);

    expect(doc.items.map((entry) => entry.id)).toEqual(['item-2', 'item-1']);
  });

  it('leaves out an absent description rather than emitting undefined', () => {
    const doc = documentFromWorkspace({ ...list, description: undefined }, items);

    expect('description' in doc).toBe(false);
  });
});

describe('workspaceFromDocument', () => {
  it('builds a list and items from a document', () => {
    const result = workspaceFromDocument(
      {
        version: 1,
        title: 'Weeknight dinners',
        kind: 'primitive',
        items: [{ value: 'Tacos' }, { value: 'Ramen' }],
      },
      { now: () => NOW, createId: idFactory() },
    );

    expect(result.list).toMatchObject({ title: 'Weeknight dinners', kind: 'primitive' });
    expect(result.items.map((item) => item.value)).toEqual(['Tacos', 'Ramen']);
  });

  it('generates ids for items that do not carry one', () => {
    const result = workspaceFromDocument(
      { version: 1, title: 'T', kind: 'primitive', items: [{ value: 'One' }] },
      { now: () => NOW, createId: idFactory() },
    );

    expect(result.items[0]?.id).toBe('id-2');
  });

  it('preserves ids that the document already carries', () => {
    const result = workspaceFromDocument(
      {
        version: 1,
        title: 'T',
        kind: 'primitive',
        items: [{ id: 'kept', value: 'One' }],
      },
      { now: () => NOW, createId: idFactory() },
    );

    expect(result.items[0]?.id).toBe('kept');
  });

  it('points every item at the new list and marks it active', () => {
    const result = workspaceFromDocument(
      { version: 1, title: 'T', kind: 'primitive', items: [{ value: 'One' }] },
      { now: () => NOW, createId: idFactory() },
    );

    expect(result.items[0]?.listId).toBe(result.list.id);
    expect(result.items[0]?.active).toBe(true);
  });

  it('round-trips a workspace through a document without losing item data', () => {
    const doc = documentFromWorkspace(list, items);
    const rebuilt = workspaceFromDocument(doc, { now: () => NOW, createId: idFactory() });

    expect(rebuilt.list.sortField).toBe('title');
    expect(rebuilt.items.map((item) => item.value)).toEqual(items.map((item) => item.value));
    expect(rebuilt.items.map((item) => item.id)).toEqual(['item-1', 'item-2']);
  });
});
