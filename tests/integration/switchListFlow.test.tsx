/** @vitest-environment jsdom */
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RankScreen from '@/app/rank';
import SetupScreen from '@/app/setup';
import { pathKey } from '@/lib/import/paths';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore } from '@/lib/state/useListStore';
import { listAtPath, openList } from '@/tests/helpers/lists';
import type { StartingOrder } from '@/types/rankingEvents';

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

function seedWorkspace() {
  listStore.getState().startRanking({
    source: {
      format: 'yaml',
      document: { movies: ['Alien', 'Arrival'], actors: ['Weaver', 'Adams'] },
      arrayPath: ['movies'],
    },
    roles: {},
  });
  const [left, right] = openList(listStore).items;
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
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('switches from list setup immediately, with no confirmation or discard warning', async () => {
    seedWorkspace();
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    expect(screen.queryByText(/discard/i)).toBeNull();
    expect(replace).toHaveBeenCalledWith('/rank');
    expect(openList(listStore).items.map((item) => item.value)).toEqual(['Weaver', 'Adams']);
  });

  it('keeps the ranking of the list being left, instead of discarding it', async () => {
    seedWorkspace();
    const movieItems = openList(listStore).items;
    const movieComparisons = openList(listStore).events;
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    const saved = listAtPath(listStore, ['movies']);
    expect(saved?.items).toEqual(movieItems);
    expect(saved?.events).toEqual(movieComparisons);
  });

  it('restores a list exactly as it was left when switching back to it from list setup', async () => {
    seedWorkspace();
    const movieItems = openList(listStore).items;
    const movieComparisons = openList(listStore).events;
    const user = userEvent.setup();
    params.current = { path: pathKey(['actors']) };
    const first = render(<SetupScreen />);
    await user.click(await screen.findByRole('button', { name: /^save$/i }));
    first.unmount();

    // A fresh mount, the way going back to list setup from the rank screen would.
    params.current = { path: pathKey(['movies']) };
    render(<SetupScreen />);
    await user.click(await screen.findByRole('button', { name: /^save$/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['movies']);
    expect(openList(listStore).items).toEqual(movieItems);
    expect(openList(listStore).events).toEqual(movieComparisons);
  });

  it('shows the answer count for a list that already has answers behind it, with no meter', async () => {
    seedWorkspace();
    render(<SetupScreen />);

    expect(await screen.findByText('1 answer so far')).toBeDefined();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('restores the ranking of a list switched back to from the toolbar', async () => {
    seedWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);
    const stage = () => within(screen.getByRole('main'));
    expect(stage().getByText('1 answer so far')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));
    expect(await stage().findByText('0 answers so far')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at movies/i }));

    expect(await stage().findByText('1 answer so far')).toBeDefined();
    expect(screen.getAllByRole('listitem').map((row) => row.textContent)).toEqual(['⠿1Alien', '⠿2Arrival']);
  });
});

const OBJECT_DOC = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: [{ name: 'Weaver' }, { name: 'Adams' }],
  books: [{ title: 'Dune' }, { title: 'Ubik' }],
};

function seedObjectWorkspace(startingOrder: StartingOrder = 'unordered') {
  listStore.getState().startRanking({
    source: { format: 'yaml', document: OBJECT_DOC, arrayPath: ['movies'] },
    roles: { labelField: 'title' },
    startingOrder,
  });
}

/**
 * A user with several lists in one document complained that every switch made
 * them stop and configure the new list first. When the new list carries the
 * title field the document's defaults name, the switcher assumes the setup
 * carries over; when it is missing, it is a different kind of list and opens
 * setup. Other default fields are optional and left off a list without them.
 */
describe('switching from the toolbar to a list never configured before', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('switches straight to it, with no trip through the data screen', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['books']);
    expect(openList(listStore).roles).toEqual({ labelField: 'title' });
    expect(replace).not.toHaveBeenCalledWith('/');
    expect(push).not.toHaveBeenCalled();
  });

  it('opens setup instead when the new list lacks the default title field', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['movies']);
    expect(push).toHaveBeenCalledWith({ pathname: '/setup', params: { path: 'actors' } });
  });

  it('switches without setup when only an optional default field is missing', async () => {
    listStore.getState().startRanking({
      source: {
        format: 'yaml',
        document: {
          movies: [{ title: 'Alien', year: 1979 }],
          books: [{ title: 'Dune' }, { title: 'Ubik' }],
        },
        arrayPath: ['movies'],
      },
      roles: { labelField: 'title', summaryFields: ['year'] },
    });
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['books']);
    expect(openList(listStore).roles.summaryFields ?? []).toEqual([]);
    expect(push).not.toHaveBeenCalled();
  });

  it('carries the starting order over to the new list', async () => {
    seedObjectWorkspace('ranked');
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(openList(listStore).initialStartingOrder).toBe('ranked');
  });

  it('says up front what setup the list would be ranked with', async () => {
    seedObjectWorkspace('ranked');
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));

    expect(screen.getByText('shown by name · already ranked')).toBeDefined();
  });

  it('still offers Configure, which opens list setup on that list instead of switching', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('button', { name: /configure the list at actors/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['movies']);
    expect(push).toHaveBeenCalledWith({ pathname: '/setup', params: { path: 'actors' } });
  });
});

/**
 * List setup's picker and the toolbar's switcher are the same rows, so both
 * say what setup each list carries. Here that answer is live: the list being
 * set up follows the controls below it rather than what is saved.
 */
describe('the list setup picker showing each list setup', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('says what a list never configured before would inherit', async () => {
    seedObjectWorkspace('ranked');
    render(<SetupScreen />);

    expect(await screen.findByText('shown by name · already ranked')).toBeDefined();
  });

  it('follows the order control for a list that has never been opened', async () => {
    seedObjectWorkspace();
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    expect(await screen.findByText('shown by name')).toBeDefined();

    await user.click(screen.getByRole('radio', { name: /already ranked, best to worst/i }));

    expect(screen.getByText('shown by name · already ranked')).toBeDefined();
  });
});

const THREE_LISTS = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: [{ name: 'Weaver' }, { name: 'Adams' }],
  books: [{ title: 'Dune' }, { title: 'Ubik' }],
};

function seedThreeLists(startingOrder: StartingOrder = 'ranked') {
  listStore.getState().startRanking({
    source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
    roles: { labelField: 'title' },
    startingOrder,
  });
}

/**
 * The document keeps one answer of its own rather than reading it off whichever
 * list happens to be open, so setting up one list by hand cannot quietly
 * redefine what the next untouched list inherits.
 */
describe('the defaults every unconfigured list follows', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('holds while another list is set up by hand against them', async () => {
    seedThreeLists();
    // actors, configured by hand the way the data screen would: its own label
    // field, and an order answer that disagrees with the document default.
    listStore.getState().switchList({
      source: {
        format: 'yaml',
        document: THREE_LISTS,
        arrayPath: ['actors'],
      },
      roles: { labelField: 'name' },
      startingOrder: 'unordered',
    });

    const user = userEvent.setup();
    render(<RankScreen />);
    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(openList(listStore).initialStartingOrder).toBe('ranked');
    expect(openList(listStore).roles).toEqual({ labelField: 'title' });
  });

  it('leaves a list reached from the switcher free to follow a later change', async () => {
    seedThreeLists();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(openList(listStore).configuredExplicitly).toBe(false);
  });

  it('is rewritten the moment the user asks, without waiting for a save', async () => {
    seedThreeLists('unordered');
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /set as default/i }));

    expect(listStore.getState().workspace?.listDefaults.startingOrder).toBe('ranked');
  });

  it('does not apply the settings to the list being set up', async () => {
    seedThreeLists('unordered');
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /set as default/i }));

    expect(openList(listStore).initialStartingOrder).toBe('unordered');
    expect(listAtPath(listStore, ['actors'])).toBeUndefined();
  });

  it('says so once the settings on screen are the default', async () => {
    seedThreeLists('unordered');

    render(<SetupScreen />);

    expect(await screen.findByText(/these are the default/i)).toBeDefined();
  });

  it('is left alone by saving the setup of another list', async () => {
    seedThreeLists('unordered');
    params.current = { path: pathKey(['actors']) };
    const user = userEvent.setup();
    render(<SetupScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /^save$/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['actors']);
    expect(listStore.getState().workspace?.listDefaults.startingOrder).toBe('unordered');
  });
});
