/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ItemCard } from '@/components/comparison/ItemCard';
import type { ListItem } from '@/types/list';

const NOW = '2026-08-15T12:00:00.000Z';

function song(id: string): ListItem {
  return {
    id: `item-${id}`,
    listId: 'list-1',
    value: { title: 'Song', artist: 'Band', apple_music_id: id },
    active: true,
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
        item={song('1001')}
        side="left"
        sortField="title"
        summaryFields={['artist']}
        previewField="apple_music_id"
        onChoose={onChoose}
      />,
    );

    const button = await screen.findByRole('button', { name: 'Play preview of Song' });
    expect(screen.getByText('artist: Band')).toBeDefined();
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
        item={song('2002')}
        side="left"
        sortField="title"
        summaryFields={['artist']}
        previewField="apple_music_id"
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
        const results = country === 'us' ? [{ trackId: 3003, previewUrl: 'https://audio.example/3003.m4a' }] : [];
        return { ok: true, json: async () => ({ results }) };
      }),
    );

    render(
      <ItemCard item={song('3003')} side="left" sortField="title" previewField="apple_music_id" />,
    );

    expect(await screen.findByRole('button', { name: 'Play preview of Song' })).toBeDefined();
  });
});
