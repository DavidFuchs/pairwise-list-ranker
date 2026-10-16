/** @vitest-environment jsdom */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import DataScreen from '@/app/index';
import RankScreen from '@/app/rank';
import { buildProgressFile } from '@/lib/progress/progressFile';
import { buildSessionFile } from '@/lib/session/sessionFile';
import { listStore } from '@/lib/state/useListStore';
import type { DataSource } from '@/types/source';

const replace = vi.fn();
vi.mock('expo-router', () => ({ useRouter: () => ({ replace, push: vi.fn() }) }));

const picked = vi.hoisted(() => ({ text: null as string | null }));
const downloads = vi.hoisted(() => [] as { name: string; text: string }[]);
vi.mock('@/lib/browser/exportActions', () => ({
  copyText: vi.fn(async () => true),
  downloadText: (name: string, text: string) => {
    downloads.push({ name, text });
    return true;
  },
  pickTextFile: async () => picked.text,
}));

const songs: DataSource = {
  format: 'json',
  rawText: '[{"title":"One","plays":1200},{"title":"Two","plays":5300},{"title":"Three","plays":90}]',
  document: [
    { title: 'One', plays: 1200 },
    { title: 'Two', plays: 5300 },
    { title: 'Three', plays: 90 },
  ],
  arrayPath: [],
};

/** A session with setup and a decision in it, as a file's text - then a clean slate. */
function savedSessionText(): string {
  listStore.getState().startRanking({
    source: songs,
    roles: { labelField: 'title', summaryFields: ['plays'], fieldRenderers: { plays: 'compact' } },
  });
  const [one, two] = listStore.getState().items;
  listStore.getState().recordComparison(two!.id, one!.id, 'left');
  const text = JSON.stringify(buildSessionFile(listStore.getState().snapshot()!, '2026-10-16T00:00:00.000Z'));
  listStore.getState().reset();
  globalThis.localStorage?.clear();
  return text;
}

async function chooseFile(text: string) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await userEvent.setup().upload(input, new File([text], 'saved.json', { type: 'application/json' }));
}

describe('session files', () => {
  beforeEach(() => {
    listStore.getState().reset();
    globalThis.localStorage?.clear();
    replace.mockClear();
    downloads.length = 0;
    picked.text = null;
  });

  it('picks up exactly where it left off when chosen on the setup screen', async () => {
    const text = savedSessionText();
    render(<DataScreen />);

    await chooseFile(text);

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/rank'));
    const state = listStore.getState();
    expect(state.workspace?.roles.fieldRenderers).toEqual({ plays: 'compact' });
    expect(state.comparisonEvents).toHaveLength(1);
    // Not pasted into the box as though it were a list.
    expect(screen.getByRole('textbox', { name: 'Your list' })).toHaveProperty('value', '');
  });

  it('still imports an ordinary JSON file as a list', async () => {
    render(<DataScreen />);

    await chooseFile(songs.rawText);

    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Your list' })).toHaveProperty('value', songs.rawText));
    expect(replace).not.toHaveBeenCalledWith('/rank');
  });

  it('asks before a session replaces a list with decisions behind it', async () => {
    const text = savedSessionText();
    listStore.getState().startRanking({ source: { ...songs, rawText: 'A\nB', document: ['A', 'B'], format: 'list' }, roles: {} });
    const [a, b] = listStore.getState().items;
    listStore.getState().recordComparison(a!.id, b!.id, 'left');
    listStore.getState().markResumed();
    render(<DataScreen />);

    await chooseFile(text);

    expect(await screen.findByText(/It replaces the list you are ranking now/)).toBeDefined();
    expect(listStore.getState().items.map((item) => item.value)).toEqual(['A', 'B']);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Replace with the saved session' }));
    expect(listStore.getState().items).toHaveLength(3);
    expect(replace).toHaveBeenCalledWith('/rank');
  });

  it('explains a progress file dropped on the setup screen instead of importing it', async () => {
    listStore.getState().startRanking({ source: songs, roles: { labelField: 'title' } });
    const progress = JSON.stringify(buildProgressFile(listStore.getState().items, [], [], ''));
    listStore.getState().reset();
    render(<DataScreen />);

    await chooseFile(progress);

    expect(await screen.findByText(/That is a progress file/)).toBeDefined();
    expect(screen.getByRole('textbox', { name: 'Your list' })).toHaveProperty('value', '');
  });

  it('saves and reopens a session from the ranking screen', async () => {
    const text = savedSessionText();
    picked.text = text;
    listStore.getState().startRanking({ source: songs, roles: { labelField: 'title' } });
    render(<RankScreen />);
    const user = userEvent.setup();

    await user.click(screen.getByRole('button', { name: 'Save this session to a file' }));
    expect(downloads[0]?.name).toMatch(/-session\.json$/);
    expect(JSON.parse(downloads[0]!.text).kind).toBe('pairwise-list-ranker-session');

    // Nothing decided yet in the open list, so there is nothing to ask about.
    await user.click(screen.getByRole('button', { name: 'Open a session file' }));
    await waitFor(() => expect(listStore.getState().comparisonEvents).toHaveLength(1));
    expect(listStore.getState().workspace?.roles.fieldRenderers).toEqual({ plays: 'compact' });
    expect(await screen.findByText(/Opened the session: 3 items · 1 decision/)).toBeDefined();
  });
});
