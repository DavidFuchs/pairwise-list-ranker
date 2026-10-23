/** @vitest-environment jsdom */
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PasteScreen from '@/app/index';
import RankScreen from '@/app/rank';
import SetupScreen from '@/app/setup';
import { pathKey } from '@/lib/import/paths';
import { listAt } from '@/lib/state/lists';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore } from '@/lib/state/useListStore';
import { listAtPath, openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();
const nav = vi.hoisted(() => ({ canGoBack: false, back: vi.fn() }));
const params = vi.hoisted(() => ({ current: {} as Record<string, string> }));

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace,
    push,
    back: nav.back,
    canGoBack: () => nav.canGoBack,
    canDismiss: () => false,
    dismissAll: vi.fn(),
  }),
  useLocalSearchParams: () => params.current,
}));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule } = await import('@/tests/helpers/engineHost');
  return engineHostModule(await importOriginal());
});

const MOVIES = [
  { title: 'Alien', year: 1979 },
  { title: 'Arrival', year: 2016 },
  { title: 'Solaris', year: 1972 },
];

function seedWorkspace() {
  listStore.getState().startRanking({
    source: {
      format: 'yaml',
      document: { movies: MOVIES, actors: ['Weaver', 'Adams', 'Banionis'] },
      arrayPath: ['movies'],
    },
    roles: { labelField: 'title' },
  });
  const [left, right] = openList(listStore).items;
  listStore.getState().recordComparison(left!.id, right!.id, 'left');
}

const SAVE = { name: /^save$/i };
const ROUGH = { name: /the list is roughly in order, best to worst/i };

describe('list setup for a list already being ranked', () => {
  beforeEach(() => {
    cleanup();
    nav.canGoBack = false;
    nav.back.mockClear();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    params.current = {};
    replace.mockClear();
    push.mockClear();
  });

  it('the gear on the Your data panel opens list setup with the starting order read-only', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    const rank = render(<RankScreen />);

    expect(screen.queryByRole('button', { name: /edit data/i })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'List setup' }));
    expect(push).toHaveBeenCalledWith('/setup');
    rank.unmount();

    render(<SetupScreen />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('button', SAVE)).toBeDefined();
    expect(screen.queryByRole('button', { name: /start ranking/i })).toBeNull();
    expect(screen.getByText('Set when this list was created.')).toBeDefined();
    for (const radio of screen.getAllByRole('radio', { name: /^the list is/i })) {
      expect(radio.getAttribute('aria-disabled')).toBe('true');
    }
    expect(screen.getByRole('radio', { name: /in no particular order/i }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('changing the card fields and pressing Save changes the cards and records no event and no undo step', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    const before = openList(listStore);
    const steps = listStore.getState().undoStack;
    render(<SetupScreen />);

    await user.click(await screen.findByRole('checkbox', { name: 'Show year on cards' }));
    await user.click(screen.getByRole('button', SAVE));

    const after = openList(listStore);
    expect(after.roles.summaryFields).toEqual(['year']);
    expect(after.id).toBe(before.id);
    expect(after.events).toBe(before.events);
    expect(listStore.getState().undoStack).toBe(steps);
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('saving with nothing changed returns to the ranking and touches nothing', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    const before = listStore.getState().workspace;
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', SAVE));

    expect(listStore.getState().workspace).toBe(before);
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('saving goes back to the ranking it was opened from, rather than stacking another', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    nav.canGoBack = true;
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', SAVE));

    expect(nav.back).toHaveBeenCalledTimes(1);
    expect(replace).not.toHaveBeenCalled();
  });

  it('switching to a never-opened list in setup lets its starting order be chosen, then Save opens that list', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    params.current = { path: pathKey(['actors']) };
    expect(listAt(listStore.getState().workspace!, ['actors'])).toBeUndefined();
    render(<SetupScreen />);

    expect(screen.queryByText('Set when this list was created.')).toBeNull();
    await user.click(await screen.findByRole('radio', ROUGH));
    await user.click(screen.getByRole('button', SAVE));

    const workspace = listStore.getState().workspace!;
    expect(workspace.source.arrayPath).toEqual(['actors']);
    expect(openList(listStore).initialStartingOrder).toBe('rough');
    expect(openList(listStore).items.map((item) => item.value)).toEqual(['Weaver', 'Adams', 'Banionis']);
    // The list left is kept as it was.
    expect(listAtPath(listStore, ['movies'])?.events).toHaveLength(1);
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('saving a never-opened list in setup with nothing changed leaves it following the defaults', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    params.current = { path: pathKey(['actors']) };
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', SAVE));

    expect(openList(listStore).arrayPath).toEqual(['actors']);
    expect(openList(listStore).configuredExplicitly).toBe(false);
  });

  it('changing the starting order of a never-opened list in setup marks it as set up by hand', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    params.current = { path: pathKey(['actors']) };
    render(<SetupScreen />);

    await user.click(await screen.findByRole('radio', ROUGH));
    await user.click(screen.getByRole('button', SAVE));

    expect(openList(listStore).configuredExplicitly).toBe(true);
  });

  it('setup for a sorted list shows the sort read-only, and a never-opened list in the document can be given a sort', async () => {
    const user = userEvent.setup();
    listStore.getState().startRanking({
      source: {
        format: 'yaml',
        document: {
          songs: [
            { title: 'A', plays: 3 },
            { title: 'B', plays: 9 },
            { title: 'C', plays: 5 },
          ],
          books: [
            { title: 'X', pages: 100 },
            { title: 'Y', pages: 300 },
            { title: 'Z', pages: 200 },
          ],
        },
        arrayPath: ['songs'],
      },
      roles: { labelField: 'title' },
      sort: { field: 'plays', direction: 'desc' },
    });
    const sortRadio = { name: /sort by a field/i };

    const first = render(<SetupScreen />);
    expect(await screen.findByText('Sorted by plays, high to low.')).toBeDefined();
    expect(screen.getByText('Set when this list was created.')).toBeDefined();
    expect(screen.getByRole('radio', sortRadio).getAttribute('aria-checked')).toBe('true');
    expect(screen.getByRole('radio', sortRadio).getAttribute('aria-disabled')).toBe('true');
    first.unmount();

    params.current = { path: pathKey(['books']) };
    render(<SetupScreen />);
    expect(screen.queryByText('Set when this list was created.')).toBeNull();
    await user.click(await screen.findByRole('radio', sortRadio));
    await user.click(screen.getByRole('radio', { name: 'Low to high' }));
    await user.click(screen.getByRole('button', SAVE));

    const workspace = listStore.getState().workspace!;
    expect(workspace.source.arrayPath).toEqual(['books']);
    expect(openList(listStore).initialSort).toEqual({ field: 'pages', direction: 'asc' });
    expect(listAtPath(listStore, ['songs'])?.initialSort).toEqual({ field: 'plays', direction: 'desc' });
  });

  function seedSortedLists() {
    const document = {
      songs: [
        { title: 'A', plays: 3 },
        { title: 'B', plays: 9 },
        { title: 'C', plays: 5 },
      ],
      books: [
        { title: 'X', pages: 100 },
        { title: 'Y', pages: 300 },
        { title: 'Z', pages: 200 },
      ],
    };
    listStore.getState().startRanking({
      source: { format: 'yaml', document, arrayPath: ['songs'] },
      roles: { labelField: 'title' },
      sort: { field: 'plays', direction: 'desc' },
    });
    listStore.getState().switchList({
      source: { format: 'yaml', document, arrayPath: ['books'] },
      roles: { labelField: 'title' },
      sort: { field: 'pages', direction: 'asc' },
    });
  }

  it('saving an already sorted list rewrites nothing', async () => {
    const user = userEvent.setup();
    seedSortedLists();
    const before = listStore.getState().workspace;
    const order = [...openList(listStore).originalItemIds];
    render(<SetupScreen />);

    await user.click(await screen.findByRole('button', SAVE));

    expect(listStore.getState().workspace).toBe(before);
    expect(openList(listStore).originalItemIds).toEqual(order);
    expect(openList(listStore).initialSort).toEqual({ field: 'pages', direction: 'asc' });
  });

  it('a visited list picked in the panel shows its own stored sort read-only', async () => {
    const user = userEvent.setup();
    seedSortedLists();
    render(<SetupScreen />);

    expect(await screen.findByText('Sorted by pages, low to high.')).toBeDefined();
    await user.click(screen.getByRole('radio', { name: /rank the list at songs/i }));

    expect(screen.getByText('Sorted by plays, high to low.')).toBeDefined();
    expect(screen.getByText('Set when this list was created.')).toBeDefined();
    expect(screen.getByRole('radio', { name: /sort by a field/i }).getAttribute('aria-checked')).toBe('true');
  });

  it('Configure on an opened list starts from the setup that list already has', async () => {
    seedWorkspace();
    listStore.getState().switchList({
      source: { ...listStore.getState().workspace!.source, arrayPath: ['actors'] },
      roles: {},
      startingOrder: 'ranked',
    });
    params.current = { path: pathKey(['movies']) };
    render(<SetupScreen />);

    expect(await screen.findByText('Set when this list was created.')).toBeDefined();
    expect(screen.getByRole('button', { name: /label items by title/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('picking another opened list in setup shows its own saved fields, and Save keeps them', async () => {
    const user = userEvent.setup();
    const source = {
      format: 'yaml' as const,
      document: {
        movies: MOVIES,
        shows: [
          { name: 'Dark', network: 'Netflix' },
          { name: 'Lost', network: 'ABC' },
        ],
      },
      arrayPath: ['shows'],
    };
    listStore.getState().startRanking({
      source,
      roles: { labelField: 'name', summaryFields: ['network'] },
      startingOrder: 'ranked',
    });
    listStore.getState().switchList({
      source: { ...source, arrayPath: ['movies'] },
      roles: { labelField: 'title' },
    });
    const savedShows = listAtPath(listStore, ['shows'])!;
    render(<SetupScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at shows/i }));

    expect(screen.getByRole('button', { name: /label items by name/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByRole('checkbox', { name: 'Show network on cards' }).getAttribute('aria-checked')).toBe(
      'true',
    );
    expect(screen.getByText('Set when this list was created.')).toBeDefined();
    expect(screen.getByRole('radio', { name: /already ranked/i }).getAttribute('aria-checked')).toBe('true');

    await user.click(screen.getByRole('button', SAVE));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['shows']);
    expect(openList(listStore).roles).toEqual(savedShows.roles);
    expect(openList(listStore).configuredExplicitly).toBe(savedShows.configuredExplicitly);
  });

  it('Configure on an opened list that is not explicit shows the roles the document defaults give it', async () => {
    const source = {
      format: 'yaml' as const,
      document: {
        movies: MOVIES,
        shows: [
          { name: 'Dark', network: 'Netflix' },
          { name: 'Lost', network: 'ABC' },
        ],
      },
      arrayPath: ['movies'],
    };
    listStore.getState().startRanking({ source, roles: { labelField: 'title' } });
    listStore.getState().switchList({
      source: { ...source, arrayPath: ['shows'] },
      roles: { labelField: 'network' },
      configuredExplicitly: false,
    });
    listStore.getState().switchList({ source, roles: { labelField: 'title' } });
    listStore.getState().setListDefaults({
      roles: { labelField: 'name', summaryFields: ['network'] },
      startingOrder: 'unordered',
    });
    params.current = { path: pathKey(['shows']) };
    render(<SetupScreen />);

    expect(
      (await screen.findByRole('button', { name: /label items by name/i })).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(screen.getByRole('checkbox', { name: 'Show network on cards' }).getAttribute('aria-checked')).toBe(
      'true',
    );
  });

  it('Start over from the ranking returns to an empty paste page', async () => {
    const user = userEvent.setup();
    seedWorkspace();
    pasteDraft.getState().setRawText('left over from before');
    const rank = render(<RankScreen />);

    await user.click(screen.getByRole('button', { name: 'Start over' }));
    await user.click(screen.getByRole('button', { name: 'Confirm start over' }));

    expect(replace).toHaveBeenCalledWith('/');
    expect(listStore.getState().workspace).toBeNull();
    expect(pasteDraft.getState().rawText).toBe('');
    rank.unmount();

    render(<PasteScreen />);
    await waitFor(() => expect(screen.getByLabelText(/your list/i)).toBeDefined());
    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe('');
  });
});
