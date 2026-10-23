/** @vitest-environment jsdom */
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RankScreen from '@/app/rank';
import { listStore } from '@/lib/state/useListStore';
import type { HeldBuilds } from '@/tests/helpers/engineHost';
import { openList } from '@/tests/helpers/lists';
import type { DataSource } from '@/types/source';

vi.mock('expo-router', () => ({ useRouter: () => ({ replace: vi.fn(), push: vi.fn() }) }));

/** Cold builds wait for the test to release them. */
const held = vi.hoisted(() => ({ builds: null as HeldBuilds | null }));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule, heldBuilds } = await import('@/tests/helpers/engineHost');
  held.builds = heldBuilds();
  return engineHostModule(await importOriginal(), held.builds.builder);
});

function builds(): HeldBuilds {
  if (held.builds === null) throw new Error('The engine host mock was not set up.');
  return held.builds;
}

const NAMES = Array.from({ length: 50 }, (_, index) => `Item ${index + 1}`);

function source(count: number): DataSource {
  return { format: 'list', document: NAMES.slice(0, count), arrayPath: [] };
}

function start(count: number) {
  listStore.getState().startRanking({ source: source(count), roles: {}, startingOrder: 'unordered' });
}

function eventKinds(): string[] {
  return openList(listStore).events.map((event) => event.kind);
}

function pairShown(): boolean {
  return screen.queryAllByLabelText(/^Choose /).length === 2;
}

describe('pairs only', () => {
  beforeEach(() => {
    builds().release();
    listStore.getState().reset();
    globalThis.localStorage.clear();
  });

  it('a 50-item unordered list shows a pair, with no mode control and no five-card deck', () => {
    start(50);
    render(<RankScreen />);

    expect(pairShown()).toBe(true);
    expect(screen.getByRole('button', { name: "Can't decide" })).toBeDefined();
    expect(screen.getAllByRole('button', { name: / is much better$/ }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('radiogroup', { name: /Sort mode|What to ask/i })).toBeNull();
    expect(screen.queryByText(/Five at a time/i)).toBeNull();
    expect(screen.queryByLabelText(/Five at a time/i)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });

  it.each([2, 3, 4])('a list of %i items asks a pair', (count) => {
    start(count);
    render(<RankScreen />);

    expect(pairShown()).toBe(true);
  });

  it('with fewer than two visible items the screen shows the nothing-to-ask panel', () => {
    start(2);
    const list = openList(listStore);
    listStore.getState().removeItem(list.items[1]!.id);
    render(<RankScreen />);

    expect(pairShown()).toBe(false);
    expect(screen.getByText('Nothing to compare yet')).toBeDefined();
  });

  it("the pair shortcuts and Don't recognize still record their events", async () => {
    start(12);
    render(<RankScreen />);
    const user = userEvent.setup();

    await user.keyboard('{ArrowLeft}');
    await user.keyboard('{ArrowRight}');
    await user.keyboard('s');
    expect(eventKinds()).toEqual(['pair', 'pair', 'pair']);

    await user.click(screen.getByRole('button', { name: "Don't recognize…" }));
    await user.click(screen.getByRole('button', { name: "Don't recognize either" }));
    expect(eventKinds().at(-1)).toBe('unrecognized');
  });
});
