/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const RAW = 'movies:\n  - Alien\n  - Arrival\nactors:\n  - Weaver\n  - Adams\n';

function seedWorkspace() {
  listStore.getState().startRanking({
    source: {
      format: 'yaml',
      rawText: RAW,
      document: { movies: ['Alien', 'Arrival'], actors: ['Weaver', 'Adams'] },
      arrayPath: ['movies'],
    },
    roles: {},
  });
  const [left, right] = listStore.getState().items;
  listStore.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
}

/**
 * The reported bug: switching to a different list in the same document
 * treated the list being left as if it were being deleted. It must not be -
 * the whole point is ranking several lists from one document across the same
 * session, moving back and forth between them.
 */
describe('switching between lists in the same document', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('switches immediately, with no confirmation or discard warning', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at actors/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));

    expect(screen.queryByText(/discard/i)).toBeNull();
    expect(replace).toHaveBeenCalledWith('/rank');
    expect(listStore.getState().items.map((item) => item.value)).toEqual(['Weaver', 'Adams']);
  });

  it('keeps the ranking of the list being left, instead of discarding it', async () => {
    seedWorkspace();
    const movieItems = listStore.getState().items;
    const movieComparisons = listStore.getState().comparisonEvents;
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at actors/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));

    const saved = listStore
      .getState()
      .savedLists.find((list) => list.arrayPath.join('.') === 'movies');
    expect(saved?.items).toEqual(movieItems);
    expect(saved?.comparisonEvents).toEqual(movieComparisons);
  });

  it('restores a list exactly as it was left when switching back to it', async () => {
    seedWorkspace();
    const movieItems = listStore.getState().items;
    const movieComparisons = listStore.getState().comparisonEvents;
    const user = userEvent.setup();
    const first = render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at actors/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));
    first.unmount();

    // A fresh mount, the way navigating back here from the rank screen would.
    render(<DataScreen />);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));

    expect(listStore.getState().items).toEqual(movieItems);
    expect(listStore.getState().comparisonEvents).toEqual(movieComparisons);
  });

  it('shows a progress meter for a list that already has ranking behind it', async () => {
    seedWorkspace();
    render(<DataScreen />);

    expect(
      await screen.findByRole('progressbar', { name: /ranking progress for movies/i }),
    ).toBeDefined();
  });
});
