/** @vitest-environment jsdom */
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import PasteScreen from '@/app/index';
import SetupScreen from '@/app/setup';
import { MOVIE_SAMPLE, SONG_SAMPLE } from '@/lib/import/sampleData';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';
import { pressContinue, reachSetup, typeSource } from '@/tests/helpers/screens';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace,
    push,
    back: vi.fn(),
    canGoBack: () => false,
    canDismiss: () => false,
    dismissAll: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

const NESTED =
  'version: 3\nmovies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

describe('the paste page and the setup screen', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('starts ranking a plain list with no further questions', async () => {
    const user = userEvent.setup();
    await reachSetup('Alien\nArrival\nSolaris\n');
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).items).toHaveLength(3);
    expect(listStore.getState().workspace?.source.format).toBe('list');
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('asks which array to rank, then which field labels it', async () => {
    const user = userEvent.setup();
    await reachSetup(NESTED);

    expect(await screen.findByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    await user.click(screen.getByRole('radio', { name: /rank the list at movies/i }));

    // The first field titles the cards by default; any other is a tap away.
    expect(screen.getByRole('button', { name: /label items by title/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps the whole document, not only the ranked array', async () => {
    const user = userEvent.setup();
    await reachSetup(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().workspace?.source.document).toMatchObject({ version: 3 });
  });

  it('preselects the ordering field it recognises', async () => {
    const user = userEvent.setup();
    await reachSetup(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).roles).toEqual({
      labelField: 'title',
      positionField: 'order',
    });
  });

  it('blocks and explains a one-item list', async () => {
    render(<PasteScreen />);

    typeSource('Alien\n');

    expect(await screen.findAllByText(/at least two items/i)).not.toHaveLength(0);
  });

  it('keeps the text and reports the line when parsing fails', async () => {
    const user = userEvent.setup();
    render(<PasteScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as json/i }));
    typeSource('{"a": 1}\n{"b": 2}');

    expect(await screen.findByText(/line 2/i)).toBeDefined();
    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toContain('"a"');
  });

  it('reads ambiguous text as a plain list when told to', async () => {
    const user = userEvent.setup();
    await reachSetup('Alien: 1979\nArrival: 2016\n', { format: /read the text as a plain list/i });
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).items).toHaveLength(2);
  });

  it('keeps the text when the paste page is opened again from setup', async () => {
    const paste = render(<PasteScreen />);
    typeSource('Alien\nArrival\n');
    await pressContinue();
    paste.unmount();

    render(<PasteScreen />);

    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toBe('Alien\nArrival\n');
  });
});

describe('the samples', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
  });

  /** A sample loaded on the paste page, then through Continue to setup. */
  async function sampleThroughSetup(label: RegExp) {
    const user = userEvent.setup();
    const paste = render(<PasteScreen />);
    await user.click(screen.getByRole('button', { name: label }));
    await pressContinue();
    paste.unmount();
    render(<SetupScreen />);
    return user;
  }

  it('bring the songs in set up to show the renderers off', async () => {
    const user = await sampleThroughSetup(/load the songs sample/i);

    expect(
      screen.getByRole('button', { name: 'Label items by song_name' }).getAttribute('aria-pressed'),
    ).toBe('true');
    for (const field of ['artwork_url', 'apple_music_id', 'duration_sec', 'explicit']) {
      expect(
        screen.getByRole('checkbox', { name: `Show ${field} on cards` }).getAttribute('aria-checked'),
      ).toBe('true');
    }

    await user.click(screen.getByRole('button', { name: /start ranking/i }));
    expect(openList(listStore).roles.fieldRenderers).toEqual(SONG_SAMPLE.roles.fieldRenderers);
    expect(listStore.getState().workspace?.source.arrayPath).toEqual(['songs']);
  });

  it('bring the movies in as YAML, set up the same way', async () => {
    const user = await sampleThroughSetup(/load the movies sample/i);

    expect(screen.getByRole('button', { name: 'Label items by title' }).getAttribute('aria-pressed')).toBe(
      'true',
    );

    await user.click(screen.getByRole('button', { name: /start ranking/i }));
    expect(openList(listStore).items).toHaveLength(10);
    expect(listStore.getState().workspace?.source.format).toBe('yaml');
    expect(openList(listStore).roles.fieldRenderers).toEqual(MOVIE_SAMPLE.roles.fieldRenderers);
  });

  it('read a sample by its own format even with Plain list chosen', async () => {
    const user = userEvent.setup();
    render(<PasteScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));
    await user.click(screen.getByRole('button', { name: /load the movies sample/i }));

    expect(screen.getByText('Format').parentElement?.textContent).toBe('FormatYAML');
    expect(screen.getByText('Items').parentElement?.textContent).toBe('Items10');
  });
});
