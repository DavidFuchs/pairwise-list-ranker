/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import RankScreen from '@/app/rank';
import { listStore } from '@/lib/state/useListStore';
import { listAtPath, openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

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
    expect(openList(listStore).items.map((item) => item.value)).toEqual(['Weaver', 'Adams']);
  });

  it('keeps the ranking of the list being left, instead of discarding it', async () => {
    seedWorkspace();
    const movieItems = openList(listStore).items;
    const movieComparisons = openList(listStore).comparisonEvents;
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at actors/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));

    const saved = listAtPath(listStore, ['movies']);
    expect(saved?.items).toEqual(movieItems);
    expect(saved?.comparisonEvents).toEqual(movieComparisons);
  });

  it('restores a list exactly as it was left when switching back to it', async () => {
    seedWorkspace();
    const movieItems = openList(listStore).items;
    const movieComparisons = openList(listStore).comparisonEvents;
    const user = userEvent.setup();
    const first = render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /rank the list at actors/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));
    first.unmount();

    // A fresh mount, the way navigating back here from the rank screen would.
    render(<DataScreen />);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /switch list/i }));

    expect(openList(listStore).items).toEqual(movieItems);
    expect(openList(listStore).comparisonEvents).toEqual(movieComparisons);
  });

  it('shows a progress meter for a list that already has ranking behind it', async () => {
    seedWorkspace();
    render(<DataScreen />);

    expect(
      await screen.findByRole('progressbar', { name: /ranking progress for movies/i }),
    ).toBeDefined();
  });
});

const OBJECT_DOC = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: [{ name: 'Weaver' }, { name: 'Adams' }],
};

function seedObjectWorkspace(alreadyRanked = false) {
  listStore.getState().startRanking({
    source: { format: 'yaml', document: OBJECT_DOC, arrayPath: ['movies'] },
    roles: { labelField: 'title' },
    alreadyRanked,
  });
}

/**
 * A user with several lists in one document complained that every switch made
 * them stop and configure the new list first. Lists sharing a document share
 * their shape, so the switcher now assumes the current setup carries over.
 */
describe('switching from the toolbar to a list never configured before', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('switches straight to it, with no trip through the data screen', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['actors']);
    expect(replace).not.toHaveBeenCalledWith('/');
  });

  it('labels the new list by its own field when the inherited one does not fit', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(openList(listStore).roles).toEqual({ labelField: 'name' });
  });

  it('carries the already-ranked answer over to the new list', async () => {
    seedObjectWorkspace(true);
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at actors/i }));

    expect(openList(listStore).alreadyRanked).toBe(true);
  });

  it('says up front what setup the list would be ranked with', async () => {
    seedObjectWorkspace(true);
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));

    expect(screen.getByText('shown by name · already ranked')).toBeDefined();
  });

  it('still offers Configure, which opens the data screen instead of switching', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<RankScreen />);

    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('button', { name: /configure the list at actors/i }));

    expect(listStore.getState().pendingSwitchPath).toEqual(['actors']);
    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['movies']);
    expect(replace).toHaveBeenCalledWith('/');
  });
});

/**
 * The data screen's picker and the toolbar's switcher are the same rows, so
 * both say what setup each list carries. Here that answer is live: the list
 * being edited follows the controls below it rather than what is saved.
 */
describe('the data screen picker showing each list setup', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('says what a list never configured before would inherit', async () => {
    seedObjectWorkspace(true);
    render(<DataScreen />);

    expect(await screen.findByText('shown by name · already ranked')).toBeDefined();
  });

  it('follows the order control for the list being edited', async () => {
    seedObjectWorkspace();
    const user = userEvent.setup();
    render(<DataScreen />);

    expect(await screen.findByText('shown by title')).toBeDefined();

    await user.click(screen.getByRole('radio', { name: /already ranked, best to worst/i }));

    expect(screen.getByText('shown by title · already ranked')).toBeDefined();
  });
});

const THREE_LISTS = {
  movies: [{ title: 'Alien' }, { title: 'Arrival' }],
  actors: [{ name: 'Weaver' }, { name: 'Adams' }],
  books: [{ title: 'Dune' }, { title: 'Ubik' }],
};

function seedThreeLists() {
  listStore.getState().startRanking({
    source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
    roles: { labelField: 'title' },
    alreadyRanked: true,
  });
}

/**
 * The document keeps one answer of its own rather than reading it off whichever
 * list happens to be open, so setting up one list by hand cannot quietly
 * redefine what the next untouched list inherits.
 */
describe('the defaults every unconfigured list follows', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
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
      alreadyRanked: false,
    });

    const user = userEvent.setup();
    render(<RankScreen />);
    await user.click(await screen.findByRole('button', { name: /switch list/i }));
    await user.click(screen.getByRole('radio', { name: /rank the list at books/i }));

    expect(openList(listStore).alreadyRanked).toBe(true);
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

  it('is rewritten the moment the user asks, without waiting for a submit', async () => {
    listStore.getState().startRanking({
      source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
      roles: { labelField: 'title' },
    });

    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /set as default/i }));

    expect(listStore.getState().workspace?.listDefaults.alreadyRanked).toBe(true);
  });

  it('does not apply the settings to the list being edited', async () => {
    listStore.getState().startRanking({
      source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
      roles: { labelField: 'title' },
    });

    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /set as default/i }));

    expect(openList(listStore).alreadyRanked).toBe(false);
  });

  it('says so once the settings on screen are the default', async () => {
    listStore.getState().startRanking({
      source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
      roles: { labelField: 'title' },
    });

    render(<DataScreen />);

    expect(await screen.findByText(/these are the default/i)).toBeDefined();
  });

  it('is left alone by an ordinary edit', async () => {
    listStore.getState().startRanking({
      source: { format: 'yaml', document: THREE_LISTS, arrayPath: ['movies'] },
      roles: { labelField: 'title' },
    });

    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(await screen.findByRole('radio', { name: /already ranked, best to worst/i }));
    await user.click(screen.getByRole('button', { name: /apply edits/i }));
    await user.click(screen.getByRole('button', { name: /apply edits/i }));

    expect(listStore.getState().workspace?.listDefaults.alreadyRanked).toBe(false);
  });
});
