/** @vitest-environment jsdom */
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

function typeSource(text: string) {
  fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: text } });
}

/**
 * Declaring a list "best to worst" is a claim of full confidence in the
 * order, so the progress meter should read as fully done immediately, and
 * further comparisons should climb past that rather than starting the meter
 * over at zero and pretending nothing is known yet.
 */
describe('marking a list as already ranked', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('starts a freshly-declared list at full coverage', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien\nArrival\nSolaris\n');
    await user.click(
      await screen.findByRole('radio', { name: /the list is already ranked, best to worst/i }),
    );
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    const { items, comparisonEvents, alreadyRanked } = openList(listStore);
    expect(alreadyRanked).toBe(true);

    const { selectProgress } = await import('@/lib/state/selectors');
    expect(selectProgress(items, comparisonEvents, alreadyRanked).coverage).toBe(1);
  });

  it('leaves an unsorted list at zero coverage', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien\nArrival\nSolaris\n');
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    const { items, comparisonEvents, alreadyRanked } = openList(listStore);
    const { selectProgress } = await import('@/lib/state/selectors');
    expect(selectProgress(items, comparisonEvents, alreadyRanked).coverage).toBe(0);
  });

  it('defaults a previously-declared list back to "best to worst" when revisited, with no click', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'yaml',
        document: { list1: ['Alien', 'Arrival', 'Solaris'], list2: ['Ford', 'Chevy'] },
        arrayPath: ['list1'],
      },
      roles: {},
      alreadyRanked: true,
    });
    // Switch to list2 first, so list1's declared answer lives only on a list
    // that is not open - the thing this default has to be derived from.
    listStore.getState().switchList({
      source: {
        format: 'yaml',
        document: { list1: ['Alien', 'Arrival', 'Solaris'], list2: ['Ford', 'Chevy'] },
        arrayPath: ['list2'],
      },
      roles: {},
      alreadyRanked: false,
    });

    render(<DataScreen />);

    await screen.findByRole('radio', { name: /rank the list at list1/i });
    fireEvent.click(screen.getByRole('radio', { name: /rank the list at list1/i }));

    expect(
      screen
        .getByRole('radio', { name: /the list is already ranked, best to worst/i })
        .getAttribute('aria-checked'),
    ).toBe('true');
  });

  it('keeps the existing percent when applying edits without touching the order control', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'list',
        document: ['Alien', 'Arrival', 'Solaris'],
        arrayPath: [],
      },
      roles: {},
    });
    const [left, right] = openList(listStore).items;
    listStore.getState().recordComparison(left?.id ?? '', right?.id ?? '', 'left');
    const { selectProgress } = await import('@/lib/state/selectors');
    const before = selectProgress(
      openList(listStore).items,
      openList(listStore).comparisonEvents,
      openList(listStore).alreadyRanked,
    ).coverage;

    const user = userEvent.setup();
    render(<DataScreen />);
    // No change to the text or the order control - applying edits should be
    // a pure no-op for the percent, same item count and all.
    await user.click(await screen.findByRole('button', { name: /apply edits/i }));
    await user.click(screen.getAllByRole('button', { name: /apply edits/i })[0]!);

    const after = selectProgress(
      openList(listStore).items,
      openList(listStore).comparisonEvents,
      openList(listStore).alreadyRanked,
    ).coverage;
    expect(after).toBe(before);
  });

  /**
   * Reported bug: a list fully ranked through real comparisons (never
   * declared "best to worst") showed 100% on the meter but "no particular
   * order" selected on the order control - a visible contradiction. The
   * control's default must follow the same percent the meter shows, without
   * that cosmetic default ever being what gets submitted (which would
   * reseed ratings by import position and could reshuffle a real ranking).
   */
  it('shows "best to worst" selected for a list ranked entirely through comparisons', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'list',
        document: ['Alien', 'Arrival', 'Solaris', 'Stalker', 'Dune'],
        arrayPath: [],
      },
      roles: {},
    });

    // Enough real comparisons to meet the n*log2(n) estimate (12 for 5
    // items), reordering well away from the import order.
    const ids = openList(listStore).items.map((item) => item.id);
    const pairs: [number, number][] = [
      [4, 0],
      [4, 1],
      [4, 2],
      [4, 3],
      [0, 1],
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
      [2, 3],
      [4, 0],
      [0, 1],
    ];
    for (const [left, right] of pairs) {
      listStore.getState().recordComparison(ids[left] ?? '', ids[right] ?? '', 'left');
    }

    const { selectProgress, selectRanking } = await import('@/lib/state/selectors');
    const before = selectRanking(
      openList(listStore).items,
      openList(listStore).comparisonEvents,
      false,
    ).map((entry) => entry.item.id);
    const coverageBefore = selectProgress(
      openList(listStore).items,
      openList(listStore).comparisonEvents,
      false,
    ).coverage;
    expect(coverageBefore).toBeGreaterThanOrEqual(1);

    const user = userEvent.setup();
    render(<DataScreen />);

    expect(
      await screen.findByRole('radio', { name: /the list is already ranked, best to worst/i }),
    ).toHaveProperty('ariaChecked', 'true');

    // Applying without touching the order control must not disturb the
    // ranking that real comparisons already built.
    await user.click(screen.getByRole('button', { name: /apply edits/i }));
    await user.click(screen.getAllByRole('button', { name: /apply edits/i })[0]!);

    const after = selectRanking(
      openList(listStore).items,
      openList(listStore).comparisonEvents,
      openList(listStore).alreadyRanked,
    ).map((entry) => entry.item.id);
    expect(openList(listStore).alreadyRanked).toBe(false);
    expect(after).toEqual(before);
  });
});
