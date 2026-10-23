import { describe, expect, it } from 'vitest';

import { rendererNote, slotOf } from '@/lib/renderers';
import { FAMILIES, RENDERERS, definitionOf, familyOf } from '@/lib/renderers/registry';
import { FIELD_RENDERERS } from '@/types/source';

describe('renderer registry', () => {
  it('defines every renderer exactly once, as an entry or a family variant', () => {
    for (const id of FIELD_RENDERERS) {
      const homes = [definitionOf(id), ...FAMILIES.filter((family) => family.owns(id))].filter(Boolean);
      expect(homes, id).toHaveLength(1);
    }
  });

  it('defines nothing that is not a known renderer', () => {
    const known = new Set<string>(FIELD_RENDERERS);
    expect(Object.keys(RENDERERS).filter((id) => !known.has(id))).toEqual([]);
  });

  it('names every renderer for a setup summary', () => {
    for (const id of FIELD_RENDERERS) expect(rendererNote(id), id).not.toBe('');
  });

  it('keeps family variants on a line of their own', () => {
    for (const id of FIELD_RENDERERS) {
      if (familyOf(id) !== undefined) expect(slotOf(id), id).toBe('line');
    }
  });
});
