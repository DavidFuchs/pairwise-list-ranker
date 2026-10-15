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

  it('omits the key when nothing survives', () => {
    expect(resolveRoles(entries, { labelField: 'title', summaryFields: ['gone'] })).not.toHaveProperty(
      'summaryFields',
    );
  });
});
