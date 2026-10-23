/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RankScreen from '@/app/rank';
import { engineHost } from '@/lib/engine/engineHost';
import { toEngineList } from '@/lib/engine/engineList';
import type * as Engine from '@/lib/ranking/bt/engine';
import { replay } from '@/lib/ranking/bt/engine';
import { listStore } from '@/lib/state/useListStore';
import type { HeldBuilds } from '@/tests/helpers/engineHost';
import { openList } from '@/tests/helpers/lists';
import type { DataSource } from '@/types/source';
import { activeItems } from '@/lib/state/membership';

vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

/** Cold builds wait for the test to release them. */
const held = vi.hoisted(() => ({ builds: null as HeldBuilds | null }));
/** The host's calls to the engine's replay, so a test can tell whether it replayed. */
const replays = vi.hoisted(() => ({ count: 0 }));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule, heldBuilds } = await import('@/tests/helpers/engineHost');
  held.builds = heldBuilds();
  return engineHostModule(await importOriginal(), held.builds.builder);
});

vi.mock('@/lib/ranking/bt/engine', async (importOriginal) => {
  const actual = await importOriginal<typeof Engine>();
  const replay: typeof actual.replay = (...args) => {
    replays.count++;
    return actual.replay(...args);
  };
  return { ...actual, replay };
});

function builds(): HeldBuilds {
  if (held.builds === null) throw new Error('The engine host mock was not set up.');
  return held.builds;
}

const RESTORING = 'Restoring your ranking…';

const dinners: DataSource = {
  format: 'list',
  document: ['Tacos', 'Ramen', 'Curry', 'Pho'],
  arrayPath: [],
};

/**
 * Opens a saved session with three answers in it, the way Open session does:
 * the host has never seen the list, so it starts a cold build, held here
 * until the test releases it.
 */
function openSavedSession(): void {
  listStore.getState().startRanking({ source: dinners, roles: {} });
  const [tacos, ramen, curry, pho] = openList(listStore).items;
  listStore.getState().recordComparison(tacos!.id, ramen!.id, 'right');
  listStore.getState().recordComparison(curry!.id, pho!.id, 'left_strong');
  listStore.getState().recordComparison(ramen!.id, curry!.id, 'draw');
  const session = structuredClone(listStore.getState().snapshot()!);
  listStore.getState().reset();
  globalThis.localStorage.clear();
  listStore.getState().loadSession(session);
}

function rankedIds(): string[] {
  const view = engineHost.view();
  if (view?.status !== 'ready') throw new Error(`Expected a ready view, got ${JSON.stringify(view)}.`);
  return view.ranked.map((item) => item.id);
}

describe('restoring a ranking', () => {
  beforeEach(() => {
    builds().release();
    listStore.getState().reset();
    globalThis.localStorage.clear();
    replays.count = 0;
  });

  it('shows "Restoring your ranking…" in the deck and the ranked list, and nothing to act on', () => {
    openSavedSession();
    render(<RankScreen />);

    expect(builds().pending).toBe(1);
    expect(screen.getAllByText(RESTORING)).toHaveLength(2);
    expect(screen.queryByLabelText(/^Choose /)).toBeNull();
    expect(screen.queryByRole('button', { name: "Can't decide" })).toBeNull();
    expect(screen.queryByRole('button', { name: /undo/i })).toBeNull();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(screen.queryAllByLabelText(/^Reorder /)).toHaveLength(0);
    expect(screen.queryByText(/answers? so far/)).toBeNull();
  });

  it('records nothing from an arrow key, S, D or Ctrl+Z while restoring', async () => {
    openSavedSession();
    // The session offers its last answer to undo (W6), so Ctrl+Z has something to take.
    expect(listStore.getState().undoStack).toHaveLength(1);
    const before = openList(listStore).events;
    render(<RankScreen />);
    const user = userEvent.setup();

    await user.keyboard('{ArrowLeft}{ArrowRight}{Shift>}{ArrowLeft}{/Shift}s');
    await user.keyboard('dl{Enter}');
    await user.keyboard('{Control>}z{/Control}');

    expect(openList(listStore).events).toBe(before);
    expect(activeItems(openList(listStore))).toHaveLength(openList(listStore).items.length);
    expect(screen.getAllByText(RESTORING)).toHaveLength(2);
  });

  it('shows the pair and the ranking once the build finishes, equal to a fresh replay', async () => {
    openSavedSession();
    render(<RankScreen />);

    await act(async () => builds().release());

    expect(await screen.findByText('3 answers so far')).toBeDefined();
    expect(screen.queryByText(RESTORING)).toBeNull();
    expect(screen.getAllByLabelText(/^Choose /)).toHaveLength(2);
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    expect(rankedIds()).toEqual(replay(toEngineList(openList(listStore))).ranked);

    // And it answers again, warm.
    await userEvent.setup().keyboard('s');
    expect(screen.getByText('4 answers so far')).toBeDefined();
    expect(builds().pending).toBe(0);
  });

  it('undo as the first action after opening uses the snapshot', async () => {
    openSavedSession();
    render(<RankScreen />);
    await act(async () => builds().release());
    await screen.findByText('3 answers so far');
    const user = userEvent.setup();
    replays.count = 0;

    await user.click(await screen.findByRole('button', { name: 'Undo last change' }));

    // Warm: no cold build was started and the host replayed nothing.
    expect(builds().pending).toBe(0);
    expect(replays.count).toBe(0);
    expect(screen.getByText('2 answers so far')).toBeDefined();
    expect(openList(listStore).events).toHaveLength(2);
    expect(rankedIds()).toEqual(replay(toEngineList(openList(listStore))).ranked);
  });
});

describe('a two-item list with nothing left to ask', () => {
  beforeEach(() => {
    builds().release();
    listStore.getState().reset();
    globalThis.localStorage.clear();
  });

  it('says both items are ranked, and Ctrl+Z takes the answer back', async () => {
    listStore
      .getState()
      .startRanking({ source: { format: 'list', document: ['Tacos', 'Ramen'], arrayPath: [] }, roles: {} });
    render(<RankScreen />);
    const user = userEvent.setup();

    await user.keyboard('{ArrowRight}');

    expect(
      screen.getByText('Both items are ranked. Drag a row to swap them, or undo your answer.'),
    ).toBeDefined();
    expect(screen.getByText('1 answer so far')).toBeDefined();
    expect(screen.queryByText(/at least two items/i)).toBeNull();

    await user.keyboard('{Control>}z{/Control}');

    expect(screen.getByText('0 answers so far')).toBeDefined();
    expect(screen.getAllByLabelText(/^Choose /)).toHaveLength(2);
  });
});
