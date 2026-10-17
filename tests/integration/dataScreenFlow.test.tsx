/** @vitest-environment jsdom */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import { MOVIE_SAMPLE, SONG_SAMPLE } from '@/lib/import/sampleData';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';

const replace = vi.fn();
const push = vi.fn();

vi.mock('expo-router', () => ({
  useRouter: () => ({ replace, push }),
}));

const NESTED =
  'version: 3\nmovies:\n  - title: Alien\n    order: 2\n  - title: Arrival\n    order: 1\nactors:\n  - Weaver\n  - Adams\n';

function typeSource(text: string) {
  fireEvent.change(screen.getByLabelText(/your list/i), { target: { value: text } });
}

describe('the data screen', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    push.mockClear();
  });

  it('starts ranking a plain list with no further questions', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien\nArrival\nSolaris\n');
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).items).toHaveLength(3);
    expect(listStore.getState().workspace?.source.format).toBe('list');
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('asks which array to rank, then which field labels it', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);

    expect(await screen.findByRole('radio', { name: /rank the list at movies/i })).toBeDefined();
    await user.click(screen.getByRole('radio', { name: /rank the list at movies/i }));

    // The first field titles the cards by default; any other is a tap away.
    expect(screen.getByRole('button', { name: /label items by title/i }).getAttribute('aria-pressed')).toBe(
      'true',
    );
  });

  it('keeps the whole document, not only the ranked array', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(listStore.getState().workspace?.source.document).toMatchObject({ version: 3 });
  });

  it('preselects the ordering field it recognises', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource(NESTED);
    await user.click(await screen.findByRole('radio', { name: /rank the list at movies/i }));
    await user.click(screen.getByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).roles).toEqual({
      labelField: 'title',
      positionField: 'order',
    });
  });

  it('blocks and explains a one-item list', async () => {
    render(<DataScreen />);

    typeSource('Alien\n');

    expect(await screen.findByText(/at least two items/i)).toBeDefined();
  });

  it('keeps the text and reports the line when parsing fails', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as json/i }));
    typeSource('{"a": 1}\n{"b": 2}');

    expect(await screen.findByText(/line 2/i)).toBeDefined();
    expect((screen.getByLabelText(/your list/i) as HTMLTextAreaElement).value).toContain('"a"');
  });

  it('reads ambiguous text as a plain list when told to', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    typeSource('Alien: 1979\nArrival: 2016\n');
    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));
    await user.click(await screen.findByRole('button', { name: /start ranking/i }));

    expect(openList(listStore).items).toHaveLength(2);
  });

  it('resumes a saved workspace exactly once', async () => {
    listStore.getState().startRanking({
      source: { format: 'list', document: ['a', 'b'], arrayPath: [] },
      roles: {},
    });
    listStore.setState({ resumed: false });
    render(<DataScreen />);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rank'));
    expect(replace).toHaveBeenCalledTimes(1);
  });
});

describe('the samples', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
  });

  it('bring the songs in set up to show the renderers off', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(screen.getByRole('button', { name: /load the songs sample/i }));

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
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(screen.getByRole('button', { name: /load the movies sample/i }));

    expect(screen.getByRole('button', { name: 'Label items by title' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.getByText('Read as YAML.')).toBeDefined();

    await user.click(screen.getByRole('button', { name: /start ranking/i }));
    expect(openList(listStore).items).toHaveLength(10);
    expect(listStore.getState().workspace?.source.format).toBe('yaml');
    expect(openList(listStore).roles.fieldRenderers).toEqual(MOVIE_SAMPLE.roles.fieldRenderers);
  });

  it('read a sample by its own format even with Plain list chosen', async () => {
    const user = userEvent.setup();
    render(<DataScreen />);

    await user.click(screen.getByRole('radio', { name: /read the text as a plain list/i }));
    await user.click(screen.getByRole('button', { name: /load the movies sample/i }));

    expect(screen.getByText('Read as YAML.')).toBeDefined();
  });
});
