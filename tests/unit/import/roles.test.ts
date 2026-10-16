import { describe, expect, it } from 'vitest';

import { resolveRoles } from '@/lib/import/roles';

describe('resolveRoles', () => {
  it('preselects an obvious label field', () => {
    expect(resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }]).labelField).toBe('title');
  });

  it('titles cards with the first field by default', () => {
    const roles = resolveRoles([
      { alpha: 'Alien', beta: 'Scott' },
      { alpha: 'Arrival', beta: 'Villeneuve' },
    ]);

    expect(roles.labelField).toBe('alpha');
  });

  it('preselects an ordering field', () => {
    const roles = resolveRoles([
      { title: 'Alien', order: 2 },
      { title: 'Arrival', order: 1 },
    ]);

    expect(roles).toEqual({ labelField: 'title', positionField: 'order' });
  });

  it('assigns no roles to scalar entries', () => {
    expect(resolveRoles(['Alien', 'Arrival'])).toEqual({});
  });

  it('keeps a previous label choice that still works', () => {
    const entries = [
      { alpha: 'Alien', beta: 'Scott' },
      { alpha: 'Arrival', beta: 'Villeneuve' },
    ];

    expect(resolveRoles(entries, { labelField: 'beta' }).labelField).toBe('beta');
  });

  it('drops a previous label choice the new data no longer has', () => {
    const roles = resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }], { labelField: 'gone' });

    expect(roles.labelField).toBe('title');
  });

  it('keeps a previous position field that still works', () => {
    const entries = [
      { title: 'Alien', year: 1979 },
      { title: 'Arrival', year: 2016 },
    ];

    expect(resolveRoles(entries, { positionField: 'year' }).positionField).toBe('year');
  });

  it('drops a previous position field the new data cannot carry', () => {
    const roles = resolveRoles([{ title: 'Alien' }, { title: 'Arrival' }], {
      positionField: 'year',
    });

    expect(roles.positionField).toBeUndefined();
  });
});
