/** @vitest-environment jsdom */
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { useSourceDraft } from '@/lib/hooks/useSourceDraft';

const NESTED =
  'movies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

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
});
