/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import SetupScreen from '@/app/setup';
import { pathKey } from '@/lib/import/paths';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { reachSetup } from '@/tests/helpers/screens';
import { engineHost } from '@/lib/engine/engineHost';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();
const params = vi.hoisted(() => ({ current: {} as Record<string, string> }));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace,
    push,
    back: vi.fn(),
    canGoBack: () => false,
    canDismiss: () => false,
    dismissAll: vi.fn(),
  }),
  useLocalSearchParams: () => params.current,
}));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule } = await import('@/tests/helpers/engineHost');
  return engineHostModule(await importOriginal());
});

/** The open list's order as it stands, by value. */
function shownOrder(): unknown[] {
  return engineHost.rankingNow(openList(listStore)).map((item) => item.value);
}

/**
 * Declaring a list "best to worst" sets its starting order: the engine starts
 * from the order given rather than from nothing, and answers refine it.
 */
describe('marking a list as already ranked', () => {
  beforeEach(() => {
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('starts a freshly-declared list from the order given', async () => {
    const user = userEvent.setup();
    await reachSetup('Solaris\nAlien\nArrival\n');
    await user.click(
      await screen.findByRole('radio', { name: /the list is already ranked, best to worst/i }),
    );
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).initialStartingOrder).toBe('ranked');
    expect(shownOrder()).toEqual(['Solaris', 'Alien', 'Arrival']);
  });

  it('starts an unsorted list in no particular order', async () => {
    const user = userEvent.setup();
    await reachSetup('Alien\nArrival\nSolaris\n');
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).initialStartingOrder).toBe('unordered');
  });

  it('shows a previously-declared list as "best to worst" when it is set up again, with no click', async () => {
    const document = { list1: ['Alien', 'Arrival', 'Solaris'], list2: ['Ford', 'Chevy'] };
    listStore.getState().startRanking({
      source: { format: 'yaml', document, arrayPath: ['list1'] },
      roles: {},
      startingOrder: 'ranked',
    });
    // Switch to list2 first, so list1's declared answer lives only on a list
    // that is not open - the thing this has to be read from.
    listStore.getState().switchList({
      source: { format: 'yaml', document, arrayPath: ['list2'] },
      roles: {},
      startingOrder: 'unordered',
    });
    params.current = { path: pathKey(['list1']) };

    render(<SetupScreen />);

    const ranked = await screen.findByRole('radio', { name: /the list is already ranked, best to worst/i });
    expect(ranked.getAttribute('aria-checked')).toBe('true');
  });

  it('keeps the ranking and the starting order when the setup is saved untouched', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'list',
        document: ['Alien', 'Arrival', 'Solaris'],
        arrayPath: [],
      },
      roles: {},
    });
    const [left, right] = openList(listStore).items;
    listStore.getState().recordComparison(right?.id ?? '', left?.id ?? '', 'left');
    const before = shownOrder();
    const events = openList(listStore).events;

    const user = userEvent.setup();
    render(<SetupScreen />);
    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    expect(openList(listStore).events).toEqual(events);
    expect(openList(listStore).initialStartingOrder).toBe('unordered');
    expect(shownOrder()).toEqual(before);
  });

  /**
   * Reported bug, from the meter's time: a list ranked through answers showed
   * the order control on "no particular order", and the fix showed "best to
   * worst" for any list with progress. With no meter there is nothing for the
   * control to contradict, so it says what the list was set up with - and
   * saving without touching it must still not disturb the ranking the answers
   * built.
   */
  it('keeps a list ranked entirely through answers on its own starting order', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'list',
        document: ['Alien', 'Arrival', 'Solaris', 'Stalker', 'Dune'],
        arrayPath: [],
      },
      roles: {},
    });

    // Answers that reorder the list well away from the import order.
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
    ];
    for (const [left, right] of pairs) {
      listStore.getState().recordComparison(ids[left] ?? '', ids[right] ?? '', 'left');
    }
    const before = shownOrder();
    expect(before[0]).toBe('Dune');

    const user = userEvent.setup();
    render(<SetupScreen />);

    expect(await screen.findByRole('radio', { name: /the list is in no particular order/i })).toHaveProperty(
      'ariaChecked',
      'true',
    );

    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(openList(listStore).initialStartingOrder).toBe('unordered');
    expect(shownOrder()).toEqual(before);
  });
});
