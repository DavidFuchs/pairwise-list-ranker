import { describe, expect, it } from 'vitest';

import { analyzeSource } from '@/lib/import/analyze';

describe('analyzeSource', () => {
  it('reads a plain list end to end', () => {
    const analysis = analyzeSource('Alien\nArrival\n', 'auto');

    expect(analysis.format).toBe('list');
    expect(analysis.candidates[0]).toMatchObject({ path: [], count: 2, entryKind: 'scalar' });
    expect(analysis.issues).toEqual([]);
  });

  it('reads nested YAML and offers each array', () => {
    const analysis = analyzeSource('movies:\n  - title: Alien\n  - title: Arrival\n', 'auto');

    expect(analysis.format).toBe('yaml');
    expect(analysis.candidates.map((entry) => entry.path.join('.'))).toEqual(['movies']);
  });

  it('honours a format override', () => {
    const analysis = analyzeSource('Alien: 1979\nArrival: 2016\n', 'list');

    expect(analysis.format).toBe('list');
    expect(analysis.candidates[0]?.count).toBe(2);
  });

  it('reports parse failures without throwing', () => {
    const analysis = analyzeSource('{ "a": , }', 'json');

    expect(analysis.issues).toHaveLength(1);
    expect(analysis.candidates).toEqual([]);
  });

  it('reports no candidates for a mapping with no arrays', () => {
    const analysis = analyzeSource('Alien: 1979\nArrival: 2016\n', 'auto');

    expect(analysis.format).toBe('yaml');
    expect(analysis.candidates).toEqual([]);
  });

  it('carries the warnings from array discovery', () => {
    const analysis = analyzeSource('mixed:\n  - Alien\n  - title: Arrival\n', 'auto');

    expect(analysis.warnings[0]).toMatch(/mixes text and objects/i);
  });

  it('is blank-safe', () => {
    const analysis = analyzeSource('', 'auto');

    expect(analysis.candidates).toEqual([]);
    expect(analysis.issues).toHaveLength(1);
  });
});
