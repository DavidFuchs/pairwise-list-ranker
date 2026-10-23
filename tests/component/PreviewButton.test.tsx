/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemCard } from '@/components/comparison/ItemCard';
import { cardLayout } from '@/lib/renderers';
import { isExpired, setDeezerTransport } from '@/lib/preview/deezerPreview';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function song(id: string): ListItem {
  return {
    id: `item-${id}`,
    listId: 'list-1',
    value: { title: 'Song', artist: 'Band', apple_music_id: id },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function mockLookup(previews: Record<string, string>) {
  const calls: string[] = [];
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: string) => {
      calls.push(url);
      const ids = new URL(url).searchParams.get('id')!.split(',');
      const results = ids
        .filter((id) => previews[id] !== undefined)
        .map((id) => ({ trackId: Number(id), previewUrl: previews[id] }));
      return { ok: true, json: async () => ({ results }) };
    }),
  );
  return calls;
}

const play = vi.fn(() => Promise.resolve());
const pause = vi.fn();

beforeEach(() => {
  play.mockClear();
  pause.mockClear();
  vi.stubGlobal(
    'Audio',
    class {
      src = '';
      ended = false;
      play = play;
      pause = pause;
      addEventListener() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Apple Music preview on a card', () => {
  it('shows a play button instead of a text line, and plays the preview without choosing the card', async () => {
    mockLookup({ '1001': 'https://audio.example/1001.m4a' });
    const onChoose = vi.fn();
    const user = userEvent.setup();

    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['artist', 'apple_music_id'],
          fieldRenderers: { apple_music_id: 'apple-music-preview' },
        })}
        item={song('1001')}
        side="left"
        onChoose={onChoose}
      />,
    );

    const button = await screen.findByRole('button', { name: 'Play preview of Song' });
    expect(screen.getByText('Artist: Band')).toBeDefined();
    expect(screen.queryByText(/apple_music_id/)).toBeNull();

    await user.click(button);

    expect(play).toHaveBeenCalledTimes(1);
    expect(onChoose).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Stop preview of Song' })).toBeDefined();
  });

  it('draws no button when no storefront has a preview', async () => {
    const calls = mockLookup({});

    render(
      <ItemCard
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['artist', 'apple_music_id'],
          fieldRenderers: { apple_music_id: 'apple-music-preview' },
        })}
        item={song('2002')}
        side="left"
      />,
    );

    // Looked up in the configured storefront, then the fallback.
    await waitFor(() => expect(calls.length).toBe(2));
    expect(calls[0]).toContain('country=ca');
    expect(calls[1]).toContain('country=us');
    expect(screen.queryByRole('button', { name: /preview of Song/ })).toBeNull();
  });

  it('finds a preview in the fallback storefront', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        const country = new URL(url).searchParams.get('country');
        const results =
          country === 'us' ? [{ trackId: 3003, previewUrl: 'https://audio.example/3003.m4a' }] : [];
        return { ok: true, json: async () => ({ results }) };
      }),
    );

    render(
      <ItemCard
        item={song('3003')}
        side="left"
        layout={cardLayout({
          labelField: 'title',
          summaryFields: ['apple_music_id'],
          fieldRenderers: { apple_music_id: 'apple-music-preview' },
        })}
      />,
    );

    expect(await screen.findByRole('button', { name: 'Play preview of Song' })).toBeDefined();
  });
});

describe('several clip sources on a card', () => {
  function track(apple: string, deezer: string): ListItem {
    return { ...song(apple), value: { title: 'Song', apple_music_id: apple, deezer_id: deezer } };
  }
  const both = cardLayout({
    labelField: 'title',
    summaryFields: ['apple_music_id', 'deezer_id'],
    fieldRenderers: { apple_music_id: 'apple-music-preview', deezer_id: 'deezer-preview' },
  });

  it('plays from the first catalogue that has a clip, asking the next only when it has none', async () => {
    mockLookup({});
    const asked: string[] = [];
    setDeezerTransport(async (url) => {
      asked.push(url);
      return { preview: 'https://cdn.example/deezer.mp3' };
    });
    const user = userEvent.setup();

    render(<ItemCard item={track('4004', '77')} side="left" layout={both} />);

    await user.click(await screen.findByRole('button', { name: 'Play preview of Song' }));
    expect(asked).toEqual(['https://api.deezer.com/track/77']);
    expect(play).toHaveBeenCalledTimes(1);
  });

  it('never asks the later catalogue when the first has a clip', async () => {
    mockLookup({ '5005': 'https://audio.example/5005.m4a' });
    const asked: string[] = [];
    setDeezerTransport(async (url) => {
      asked.push(url);
      return { preview: 'https://cdn.example/deezer.mp3' };
    });

    render(<ItemCard item={track('5005', '78')} side="left" layout={both} />);

    expect(await screen.findByRole('button', { name: 'Play preview of Song' })).toBeDefined();
    expect(asked).toEqual([]);
  });

  it('draws no button when no catalogue has a clip', async () => {
    const calls = mockLookup({});
    setDeezerTransport(async () => ({ error: { type: 'DataException' } }));

    render(<ItemCard item={track('6006', '79')} side="left" layout={both} />);

    await waitFor(() => expect(calls.length).toBe(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole('button', { name: /preview of Song/ })).toBeNull();
  });
});

describe('Deezer clip addresses', () => {
  it('lapse a minute before the time they are signed for', () => {
    const now = 1_800_000_000_000;
    expect(isExpired('https://cdnt-preview.dzcdn.net/a.mp3?hdnea=exp=1800000030~acl=x', now)).toBe(true);
    expect(isExpired('https://cdnt-preview.dzcdn.net/a.mp3?hdnea=exp=1800000600~acl=x', now)).toBe(false);
    expect(isExpired('https://audio.example/a.mp3', now)).toBe(false);
  });
});
