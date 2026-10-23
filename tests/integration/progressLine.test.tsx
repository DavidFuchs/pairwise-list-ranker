/** @vitest-environment jsdom */
import { act, cleanup, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import RankScreen from '@/app/rank';
import { pasteDraft } from '@/lib/state/pasteDraft';
import { listStore } from '@/lib/state/useListStore';
import { openList } from '@/tests/helpers/lists';
import type { StartingOrder } from '@/types/rankingEvents';

vi.mock('expo-router', () => ({
  useRouter: () => ({
    replace: vi.fn(),
    push: vi.fn(),
    back: vi.fn(),
    canGoBack: () => false,
    canDismiss: () => false,
    dismissAll: vi.fn(),
  }),
  useLocalSearchParams: () => ({}),
}));

vi.mock('@/lib/engine/engineHost', async (importOriginal) => {
  const { engineHostModule } = await import('@/tests/helpers/engineHost');
  return engineHostModule(await importOriginal());
});

const STAGE_ONE = /Can't tell how close you are yet/;
const A_LEVEL =
  /Rough order so far|Taking shape|Close\. Mostly fine adjustments|Changes from here should be small/;

const RANKED_START = /Every item has been compared\. Keep going/;

function start(n: number, startingOrder: StartingOrder = 'unordered') {
  listStore.getState().startRanking({
    source: {
      format: 'yaml',
      document: { items: Array.from({ length: n }, (_, i) => `Item ${i + 1}`) },
      arrayPath: ['items'],
    },
    roles: {},
    startingOrder,
  });
}

/** Answers a pair for each neighbouring two items, so every item is compared once. */
function compareEverything() {
  const items = openList(listStore).items;
  act(() => {
    for (let i = 0; i < items.length; i += 2) {
      const left = items[i]!;
      const right = items[(i + 1) % items.length]!;
      listStore.getState().recordComparison(left.id, right.id, 'left');
    }
  });
}

describe('the progress line on the ranking screen', () => {
  beforeEach(() => {
    cleanup();
    listStore.getState().reset();
    pasteDraft.getState().clear();
    globalThis.localStorage?.clear();
  });

  it('says it cannot tell yet, and how many items are left to compare, on a new list', async () => {
    start(30);
    render(<RankScreen />);

    expect(
      await screen.findByText("Can't tell how close you are yet. 30 of 30 items haven't been compared."),
    ).toBeDefined();
    expect(screen.queryByText(A_LEVEL)).toBeNull();
  });

  it('counts the items down as they are compared', async () => {
    start(30);
    render(<RankScreen />);
    await screen.findByText(STAGE_ONE);

    const [a, b, c, d] = openList(listStore).items;
    act(() => {
      listStore.getState().recordComparison(a!.id, b!.id, 'left');
      listStore.getState().recordComparison(c!.id, d!.id, 'right');
    });

    expect(await screen.findByText(/26 of 30 items haven't been compared/)).toBeDefined();
  });

  it('names a level once every item has been compared', async () => {
    start(30);
    render(<RankScreen />);
    await screen.findByText(STAGE_ONE);

    compareEverything();

    expect(await screen.findByText(A_LEVEL)).toBeDefined();
    expect(screen.queryByText(STAGE_ONE)).toBeNull();
  });

  it('says why it cannot tell for a list that started ranked', async () => {
    start(30, 'ranked');
    render(<RankScreen />);
    await screen.findByText(STAGE_ONE);

    compareEverything();

    expect(await screen.findByText(RANKED_START)).toBeDefined();
    expect(screen.queryByText(STAGE_ONE)).toBeNull();
    expect(screen.queryByText(A_LEVEL)).toBeNull();
  });

  it('names a level for a short list too', async () => {
    start(10);
    render(<RankScreen />);
    await screen.findByText(STAGE_ONE);

    compareEverything();

    expect(await screen.findByText(A_LEVEL)).toBeDefined();
    expect(screen.queryByText(STAGE_ONE)).toBeNull();
  });
});
