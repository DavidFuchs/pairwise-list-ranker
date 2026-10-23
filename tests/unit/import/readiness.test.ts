import { describe, expect, it } from 'vitest';

import type { ArrayCandidate } from '@/lib/import/arrayCandidates';
import { describeReadiness } from '@/lib/import/readiness';

const candidate: ArrayCandidate = {
  path: ['movies'],
  count: 2,
  entryKind: 'object',
  samples: ['Alien', 'Arrival'],
};

const base = {
  candidates: [candidate],
  selectedPath: ['movies'],
  entries: [{ title: 'Alien' }, { title: 'Arrival' }] as unknown[],
  roles: { labelField: 'title' },
  hasIssues: false,
};

describe('describeReadiness', () => {
  it('is ready when a list, a label, and two items are all present', () => {
    expect(describeReadiness(base)).toEqual({ ready: true });
  });

  it('blocks while the text has parse errors', () => {
    const result = describeReadiness({ ...base, hasIssues: true });

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/fix the/i);
  });

  it('asks for a list rather than reporting a failure when nothing is typed yet', () => {
    const result = describeReadiness({
      ...base,
      isBlank: true,
      candidates: [],
      selectedPath: null,
      entries: [],
    });

    expect(result.ready).toBe(false);
    expect(result.reason).toMatch(/to get started/i);
    expect(result.reason).not.toMatch(/no list to rank/i);
  });

  it('keeps the empty box ahead of every other complaint', () => {
    const result = describeReadiness({ ...base, isBlank: true, hasIssues: true, entries: [] });

    expect(result.reason).toMatch(/to get started/i);
  });

  it('blocks when nothing rankable was found', () => {
    const result = describeReadiness({ ...base, candidates: [], selectedPath: null, entries: [] });

    expect(result.reason).toMatch(/no list to rank/i);
  });

  it('blocks until one of several lists is chosen', () => {
    const result = describeReadiness({
      ...base,
      candidates: [candidate, { ...candidate, path: ['actors'] }],
      selectedPath: null,
      entries: [],
    });

    expect(result.reason).toMatch(/choose which list/i);
  });

  it('blocks a one-item list', () => {
    const result = describeReadiness({ ...base, entries: [{ title: 'Alien' }] });

    expect(result.reason).toMatch(/at least two items/i);
  });

  it('blocks object entries with no label field chosen', () => {
    const result = describeReadiness({ ...base, roles: {} });

    expect(result.reason).toMatch(/which field should title/i);
  });

  it('needs no label field for scalar entries', () => {
    expect(describeReadiness({ ...base, entries: ['Alien', 'Arrival'], roles: {} })).toEqual({
      ready: true,
    });
  });
});
