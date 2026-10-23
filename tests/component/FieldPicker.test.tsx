/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { FieldPicker } from '@/components/data/FieldPicker';
import type { FieldRoles } from '@/types/source';

const songs = [
  {
    title: 'Cold Heart',
    artist: 'Elton John',
    year: 2021,
    apple_music_id: '1578986673',
    tags: ['pop'],
    url: 'https://music.example/a',
    art: 'https://img.example/a.jpg',
  },
  {
    title: 'A Bar Song',
    artist: 'Shaboozey',
    year: 2024,
    apple_music_id: '1737085899',
    tags: ['country'],
    url: 'https://music.example/b',
    art: 'https://img.example/b.png',
  },
  {
    title: 'Mary On A Cross',
    artist: 'Ghost',
    year: 2019,
    apple_music_id: '1744433354',
    url: 'https://music.example/c',
    art: 'https://img.example/c.webp',
  },
];

function setup(roles: FieldRoles) {
  const onChange = vi.fn();
  render(<FieldPicker objects={songs} roles={roles} onChange={onChange} />);
  return { onChange, user: userEvent.setup() };
}

/** The cell's play button looks clips up for real; here only FOUND_ID has one. */
const FOUND_ID = '900000001';

beforeEach(() => {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      const ids = new URL(url).searchParams.get('id')!.split(',');
      const results = ids
        .filter((id) => id === FOUND_ID)
        .map((id) => ({ trackId: Number(id), previewUrl: 'https://audio.example/clip.m4a' }));
      return { ok: true, json: async () => ({ results }) };
    }),
  );
});

afterEach(() => vi.unstubAllGlobals());

const checkbox = (field: string) => screen.getByRole('checkbox', { name: `Show ${field} on cards` });

describe('FieldPicker', () => {
  it('makes a field the title when its cell is tapped', async () => {
    const { onChange, user } = setup({ labelField: 'title', summaryFields: ['artist', 'year'] });
    await user.click(screen.getByRole('button', { name: 'Label items by artist' }));
    // A detail that becomes the title leaves the details.
    expect(onChange).toHaveBeenCalledWith({
      labelField: 'artist',
      summaryFields: ['year'],
      fieldRenderers: undefined,
    });
  });

  it('marks the title and gives it no checkbox', () => {
    setup({ labelField: 'title' });
    expect(screen.getByRole('button', { name: 'Label items by title' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    expect(screen.queryByRole('checkbox', { name: 'Show title on cards' })).toBeNull();
  });

  it('does not offer fields that cannot be a title as one, but can still show them', () => {
    setup({ labelField: 'title' });
    expect(screen.getByRole('button', { name: 'Label items by tags' }).getAttribute('aria-disabled')).toBe(
      'true',
    );
    expect(checkbox('tags').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('previews every field with its sample values', () => {
    setup({ labelField: 'title' });
    expect(screen.getByText('Elton John · Shaboozey · Ghost')).toBeDefined();
    expect(screen.getByText('2 of 3')).toBeDefined();
  });

  it('adds and removes details with the checkbox', async () => {
    const { onChange, user } = setup({ labelField: 'title', summaryFields: ['artist'] });
    expect(checkbox('artist').getAttribute('aria-checked')).toBe('true');

    await user.click(checkbox('year'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ summaryFields: ['artist', 'year'] }));

    await user.click(checkbox('artist'));
    expect(onChange).toHaveBeenLastCalledWith(expect.objectContaining({ summaryFields: [] }));
  });

  it('numbers the details and lists them under the title in card order', () => {
    setup({ labelField: 'title', summaryFields: ['year', 'artist'] });
    expect(within(checkbox('year')).getByText('1')).toBeDefined();
    expect(within(checkbox('artist')).getByText('2')).toBeDefined();

    const order = screen
      .getAllByRole('button', { name: /^Label items by / })
      .map((cell) => cell.getAttribute('aria-label')?.replace('Label items by ', ''));
    expect(order.slice(0, 3)).toEqual(['title', 'year', 'artist']);
    expect(screen.getByText(/2 details/)).toBeDefined();
  });

  it('reorders details with the arrows', async () => {
    const { onChange, user } = setup({ labelField: 'title', summaryFields: ['artist', 'year', 'tags'] });
    expect(screen.getByRole('button', { name: 'Move artist up' }).getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByRole('button', { name: 'Move tags down' }).getAttribute('aria-disabled')).toBe('true');

    await user.click(screen.getByRole('button', { name: 'Move year up' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ summaryFields: ['year', 'artist', 'tags'] }),
    );

    // Controlled: still rendering the original order.
    await user.click(screen.getByRole('button', { name: 'Move year down' }));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ summaryFields: ['artist', 'tags', 'year'] }),
    );
  });

  it('keeps a renderer with its field when the field moves', async () => {
    const { onChange, user } = setup({
      labelField: 'title',
      summaryFields: ['artist', 'apple_music_id'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
    await user.click(screen.getByRole('button', { name: 'Move apple_music_id up' }));
    expect(onChange).toHaveBeenCalledWith({
      labelField: 'title',
      summaryFields: ['apple_music_id', 'artist'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
  });

  it('draws a field as an Apple Music preview from its side menu, showing it', async () => {
    const { onChange, user } = setup({ labelField: 'title', summaryFields: ['artist'] });
    await user.click(screen.getByRole('button', { name: 'Choose how apple_music_id is drawn' }));
    await user.click(screen.getByRole('button', { name: 'Show apple_music_id as Apple Music preview' }));
    expect(onChange).toHaveBeenCalledWith({
      labelField: 'title',
      summaryFields: ['artist', 'apple_music_id'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
  });

  it('previews the Apple Music renderer as a round play button in the cell', () => {
    setup({
      labelField: 'title',
      summaryFields: ['apple_music_id'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
    expect(screen.getByText('▶')).toBeDefined();
    expect(screen.queryByText(/1578986673/)).toBeNull();
  });

  it('gives the title no drawing menu - it is always shown as it is', () => {
    setup({ labelField: 'title' });
    expect(screen.queryByRole('button', { name: 'Choose how title is drawn' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Choose how tags is drawn' })).toBeDefined();
  });

  it('takes as many details as there are fields', async () => {
    const { onChange, user } = setup({
      labelField: 'title',
      summaryFields: ['artist', 'year', 'apple_music_id', 'tags', 'url'],
    });
    expect(checkbox('art').getAttribute('aria-disabled')).not.toBe('true');
    await user.click(checkbox('art'));
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ summaryFields: ['artist', 'year', 'apple_music_id', 'tags', 'url', 'art'] }),
    );
  });

  it('offers stars and bars at each scale every value fits, and applies the one chosen', async () => {
    const rated = [
      { title: 'A', score: 9.2, share: 0.4 },
      { title: 'B', score: 6, share: 0.9 },
    ];
    const onChange = vi.fn();
    render(<FieldPicker objects={rated} roles={{ labelField: 'title' }} onChange={onChange} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Choose how score is drawn' }));

    // 9.2 rules out 1 and 5.
    expect(screen.queryByRole('radio', { name: 'Show score as Stars out of 5' })).toBeNull();
    expect(screen.getByRole('radio', { name: 'Show score as Stars out of 10' })).toBeDefined();
    expect(screen.getByRole('radio', { name: 'Show score as Bar out of 100' })).toBeDefined();

    await user.click(screen.getByRole('radio', { name: 'Show score as Stars out of 10' }));
    expect(onChange).toHaveBeenCalledWith({
      labelField: 'title',
      summaryFields: ['score'],
      fieldRenderers: { score: 'stars-10' },
    });
  });

  it('marks the scale in use', async () => {
    const rated = [
      { title: 'A', score: 4 },
      { title: 'B', score: 3 },
    ];
    render(
      <FieldPicker
        objects={rated}
        roles={{ labelField: 'title', summaryFields: ['score'], fieldRenderers: { score: 'bar-5' } }}
        onChange={vi.fn()}
      />,
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Choose how score is drawn' }));
    expect(
      screen.getByRole('radio', { name: 'Show score as Bar out of 5' }).getAttribute('aria-checked'),
    ).toBe('true');
    expect(
      screen.getByRole('radio', { name: 'Show score as Stars out of 5' }).getAttribute('aria-checked'),
    ).toBe('false');
  });

  it('previews new renderers with the field’s own values', () => {
    const rich = [
      { title: 'A', genres: ['Pop', 'Disco'], length: 171, explicit: false, released: '2024-04-12' },
      { title: 'B', genres: ['Rock'], length: 3735, explicit: true, released: '2021-08-13' },
    ];
    render(
      <FieldPicker
        objects={rich}
        roles={{
          labelField: 'title',
          summaryFields: ['genres', 'length', 'explicit', 'released'],
          fieldRenderers: { genres: 'tags', length: 'duration', explicit: 'badge', released: 'year' },
        }}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByText('Disco')).toBeDefined();
    expect(screen.getByText('2:51 · 1:02:15')).toBeDefined();
    // The field's own key names it; its badge previews as a card draws it.
    expect(screen.getByText('explicit')).toBeDefined();
    expect(screen.getByText('Explicit')).toBeDefined();
    expect(screen.getByText('2024 · 2021')).toBeDefined();
  });

  it('keeps the Apple Music preview out of the cell, so pressing it never makes the field the title', () => {
    setup({
      labelField: 'title',
      summaryFields: ['apple_music_id'],
      fieldRenderers: { apple_music_id: 'apple-music-preview' },
    });
    const cell = screen.getByRole('button', { name: 'Label items by apple_music_id' });
    expect(within(cell).queryByText('▶')).toBeNull();
    expect(screen.getByText('▶')).toBeDefined();
  });

  it('opens a link field from its cell without changing the field', async () => {
    const { onChange, user } = setup({
      labelField: 'title',
      summaryFields: ['url'],
      fieldRenderers: { url: 'link' },
    });
    const link = screen.getByRole('link');
    expect(link.getAttribute('href')).toBe('https://music.example/a');
    link.addEventListener('click', (event) => event.preventDefault());
    await user.click(link);
    expect(onChange).not.toHaveBeenCalled();
  });

  it('offers Link for web addresses and Image only for image addresses', async () => {
    const { user } = setup({ labelField: 'title' });
    await user.click(screen.getByRole('button', { name: 'Choose how url is drawn' }));
    expect(screen.getByRole('button', { name: 'Show url as Link' })).toBeDefined();
    expect(screen.queryByRole('button', { name: 'Show url as Image' })).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Choose how art is drawn' }));
    expect(screen.getByRole('button', { name: 'Show art as Link' })).toBeDefined();
    expect(screen.getByRole('button', { name: 'Show art as Image' })).toBeDefined();
  });

  it('previews an image field as pictures', () => {
    setup({ labelField: 'title', summaryFields: ['art'], fieldRenderers: { art: 'image' } });
    for (const url of [
      'https://img.example/a.jpg',
      'https://img.example/b.png',
      'https://img.example/c.webp',
    ]) {
      expect(screen.getByRole('img', { name: url })).toBeDefined();
    }
  });

  it('draws the title only as its own data, with no renderer to choose', () => {
    setup({ labelField: 'art', summaryFields: [], fieldRenderers: undefined });
    expect(screen.queryByRole('button', { name: 'Choose how art is drawn' })).toBeNull();
    expect(screen.getByText(/img\.example\/a\.jpg/)).toBeDefined();
  });

  it('plays the first sample from the cell once a clip is found', async () => {
    const found = songs.map((song, index) => ({
      ...song,
      apple_music_id: index === 0 ? FOUND_ID : song.apple_music_id,
    }));
    render(
      <FieldPicker
        objects={found}
        roles={{
          labelField: 'title',
          summaryFields: ['apple_music_id'],
          fieldRenderers: { apple_music_id: 'apple-music-preview' },
        }}
        onChange={vi.fn()}
      />,
    );
    const play = await waitFor(() =>
      screen.getByRole('button', { name: 'Play preview of apple_music_id sample' }),
    );
    expect(
      within(screen.getByRole('button', { name: 'Label items by apple_music_id' })).queryByRole('button'),
    ).toBeNull();
    expect(play).toBeDefined();
  });
});

describe('caveats', () => {
  const games = (headers: unknown[]) => headers.map((header, index) => ({ title: `Game ${index}`, header }));
  const roles: FieldRoles = {
    labelField: 'title',
    summaryFields: ['header'],
    fieldRenderers: { header: 'steam-header' },
  };

  it('warns under a Steam field of app ids', () => {
    render(<FieldPicker objects={games([620, 400])} roles={roles} onChange={vi.fn()} />);

    expect(screen.getByText(/app id can't find it/i)).toBeDefined();
  });

  it('says nothing once the field holds banner addresses', () => {
    const banner = (id: number) =>
      `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${id}/ab12/header.jpg`;
    render(<FieldPicker objects={games([banner(620), banner(400)])} roles={roles} onChange={vi.fn()} />);

    expect(screen.queryByText(/app id can't find it/i)).toBeNull();
  });

  it('says nothing about a field that is not on the card', () => {
    render(<FieldPicker objects={games([620, 400])} roles={{ labelField: 'title' }} onChange={vi.fn()} />);

    expect(screen.queryByText(/app id can't find it/i)).toBeNull();
  });
});
