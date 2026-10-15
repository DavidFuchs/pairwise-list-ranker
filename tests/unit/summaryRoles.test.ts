import { describe, expect, it } from 'vitest';

import { resolveRoles } from '@/lib/import/roles';

const entries = [
  { title: 'A', year: 1, genre: 'x' },
  { title: 'B', year: 2 },
];

describe('resolveRoles summaryFields', () => {
  it('keeps chosen fields that exist, in order, capped at three', () => {
    const roles = resolveRoles(entries, {
      labelField: 'title',
      summaryFields: ['genre', 'year', 'title', 'gone', 'year'],
    });
    expect(roles.summaryFields).toEqual(['genre', 'year']);
  });

  it('treats a cleared choice as a choice, and does not suggest over it', () => {
    expect(resolveRoles(entries, { labelField: 'title', summaryFields: [] }).summaryFields).toEqual([]);
  });

  it('suggests short fields every item carries when nothing was chosen', () => {
    // genre is missing from one item, so only year qualifies.
    expect(resolveRoles(entries, { labelField: 'title' }).summaryFields).toEqual(['year']);
  });
});
