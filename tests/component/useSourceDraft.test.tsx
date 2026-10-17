/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSourceDraft } from '@/lib/hooks/useSourceDraft';

const NESTED =
  'movies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

// Both lists carry a field named "foo", ambiguous on its own (paired with an
// equally usable "bar"), so a labelField only ends up on list2 if it truly
// carried over from list1's choice rather than being re-resolved fresh.
const SAME_FIELD_NAME_LISTS =
  'list1:\n  - foo: pears\n    bar: fruit\n  - foo: oranges\n    bar: fruit\nlist2:\n  - foo: chevy\n    bar: car\n  - foo: ford\n    bar: car\n';

describe('useSourceDraft', () => {
  it('starts empty', () => {
    const { result } = renderHook(() => useSourceDraft());

    expect(result.current.rawText).toBe('');
    expect(result.current.selectedPath).toBeNull();
    expect(result.current.entries).toEqual([]);
  });

  it('auto-selects the only candidate', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.selectedPath).toEqual([]);
    expect(result.current.entries).toEqual(['Alien', 'Arrival']);
  });

  it('keeps an order chosen with no list selected off a document that is itself the list', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText(NESTED));
    expect(result.current.selectedPath).toBeNull();
    act(() => result.current.setAlreadyRanked(true));
    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.selectedPath).toEqual([]);
    expect(result.current.alreadyRanked).toBe(false);
    expect(result.current.alreadyRankedIsExplicit).toBe(false);
  });

  it('asks nothing of a plain list', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.roles).toEqual({});
  });

  it('waits for a choice when several arrays qualify', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setRawText(NESTED));

    expect(result.current.selectedPath).toBeNull();
  });

  it('resolves entries and roles once an array is chosen', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));

    act(() => result.current.selectPath(['movies']));

    expect(result.current.entries).toHaveLength(2);
    expect(result.current.roles).toEqual({ labelField: 'title', positionField: 'order' });
  });

  it('keeps a cleared position field cleared', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));
    act(() => result.current.selectPath(['movies']));

    act(() => result.current.setRoles({ labelField: 'title' }));

    expect(result.current.roles.positionField).toBeUndefined();
    expect(result.current.roles.labelField).toBe('title');
  });

  it('honours a format override', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText('Alien: 1979\nArrival: 2016\n'));

    act(() => result.current.setOverride('list'));

    expect(result.current.analysis.format).toBe('list');
    expect(result.current.entries).toHaveLength(2);
  });

  it('transforms a plain list into YAML when the tab switches', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText('Alien\nArrival\n'));

    act(() => result.current.setOverride('yaml'));

    expect(result.current.analysis.format).toBe('yaml');
    expect(result.current.entries).toEqual(['Alien', 'Arrival']);
    expect(result.current.rawText).not.toBe('Alien\nArrival\n');
  });

  it('round-trips a transform back to a plain list', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText('Alien\nArrival\n'));
    act(() => result.current.setOverride('json'));

    act(() => result.current.setOverride('list'));

    expect(result.current.analysis.format).toBe('list');
    expect(result.current.entries).toEqual(['Alien', 'Arrival']);
  });

  it('hides plain list once entries are complex objects', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));
    act(() => result.current.selectPath(['movies']));

    expect(result.current.availableOverrides).not.toContain('list');
  });

  it('offers plain list while entries stay scalar', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText('Alien\nArrival\n'));

    expect(result.current.availableOverrides).toContain('list');
  });

  it('builds a data source from the current choices', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));
    act(() => result.current.selectPath(['movies']));

    expect(result.current.toSource()).toMatchObject({ format: 'yaml', arrayPath: ['movies'] });
  });

  it('builds nothing while no array is chosen', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(NESTED));

    expect(result.current.toSource()).toBeNull();
  });

  it('seeds from an existing workspace', () => {
    const { result } = renderHook(() =>
      useSourceDraft({
        rawText: NESTED,
        arrayPath: ['movies'],
        roles: { labelField: 'title' },
        alreadyRanked: true,
      }),
    );

    expect(result.current.selectedPath).toEqual(['movies']);
    expect(result.current.roles.labelField).toBe('title');
    expect(result.current.alreadyRanked).toBe(true);
  });

  it('defaults alreadyRanked to false with no seed', () => {
    const { result } = renderHook(() => useSourceDraft());

    expect(result.current.alreadyRanked).toBe(false);
  });

  it('updates alreadyRanked', () => {
    const { result } = renderHook(() => useSourceDraft());

    act(() => result.current.setAlreadyRanked(true));

    expect(result.current.alreadyRanked).toBe(true);
  });

  /**
   * Regression: switching to a list the user has said nothing about must not
   * inherit the seeded list's "already ranked" answer - each candidate gets
   * its own default until told otherwise.
   */
  it('does not carry alreadyRanked over to a different candidate list', () => {
    const { result } = renderHook(() =>
      useSourceDraft({
        rawText: NESTED,
        arrayPath: ['movies'],
        roles: { labelField: 'title' },
        alreadyRanked: true,
      }),
    );
    expect(result.current.alreadyRanked).toBe(true);

    act(() => result.current.selectPath(['actors']));
    expect(result.current.alreadyRanked).toBe(false);

    act(() => result.current.selectPath(['movies']));
    expect(result.current.alreadyRanked).toBe(true);
  });

  it('remembers a choice made for a non-seeded candidate when returning to it', () => {
    const { result } = renderHook(() =>
      useSourceDraft({
        rawText: NESTED,
        arrayPath: ['movies'],
        roles: { labelField: 'title' },
        alreadyRanked: false,
      }),
    );

    act(() => result.current.selectPath(['actors']));
    act(() => result.current.setAlreadyRanked(true));
    expect(result.current.alreadyRanked).toBe(true);

    act(() => result.current.selectPath(['movies']));
    expect(result.current.alreadyRanked).toBe(false);

    act(() => result.current.selectPath(['actors']));
    expect(result.current.alreadyRanked).toBe(true);
  });

  /**
   * A list already ranked in an earlier switch this session (tracked in
   * the workspace's lists, passed in as knownLists) must default to its own real answer
   * when revisited - not "no particular order" just because the seed's
   * arrayPath points at a different list.
   */
  it('defaults a known candidate to its real alreadyRanked answer, not the seeded list\'s', () => {
    const { result } = renderHook(() =>
      useSourceDraft({
        rawText: NESTED,
        arrayPath: ['movies'],
        roles: { labelField: 'title' },
        alreadyRanked: false,
        knownLists: { actors: true },
      }),
    );
    expect(result.current.alreadyRanked).toBe(false);

    act(() => result.current.selectPath(['actors']));

    expect(result.current.alreadyRanked).toBe(true);
  });

  it('lets an explicit choice override a known candidate\'s remembered answer', () => {
    const { result } = renderHook(() =>
      useSourceDraft({
        rawText: NESTED,
        arrayPath: ['movies'],
        roles: { labelField: 'title' },
        alreadyRanked: false,
        knownLists: { actors: true },
      }),
    );

    act(() => result.current.selectPath(['actors']));
    act(() => result.current.setAlreadyRanked(false));

    expect(result.current.alreadyRanked).toBe(false);
  });

  /**
   * Reported bug: switching to a second complex list "didn't ask" - it had
   * silently inherited the first list's field choice. That happens whenever
   * the new list coincidentally has a field of the same name, which slips
   * past resolveRoles' compatibility check because the field genuinely does
   * exist - the check alone cannot tell "reused on purpose" from "reused by
   * coincidence".
   */
  it('does not carry a label field choice over to a different candidate, even with a same-named field', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(SAME_FIELD_NAME_LISTS));
    act(() => result.current.selectPath(['list1']));
    act(() => result.current.setRoles({ labelField: 'bar' }));
    expect(result.current.roles.labelField).toBe('bar');

    act(() => result.current.selectPath(['list2']));

    // list2 gets its own default - its first field - not list1's choice.
    expect(result.current.roles.labelField).toBe('foo');
  });

  it('remembers a label field choice made for a non-seeded candidate when returning to it', () => {
    const { result } = renderHook(() => useSourceDraft());
    act(() => result.current.setRawText(SAME_FIELD_NAME_LISTS));
    act(() => result.current.selectPath(['list1']));
    act(() => result.current.setRoles({ labelField: 'foo' }));

    act(() => result.current.selectPath(['list2']));
    act(() => result.current.setRoles({ labelField: 'bar' }));
    expect(result.current.roles.labelField).toBe('bar');

    act(() => result.current.selectPath(['list1']));
    expect(result.current.roles.labelField).toBe('foo');

    act(() => result.current.selectPath(['list2']));
    expect(result.current.roles.labelField).toBe('bar');
  });
});
