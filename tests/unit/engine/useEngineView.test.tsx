/** @vitest-environment jsdom */
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createEngineCache } from '@/lib/engine/engineCache';
import { createEngineHost, useEngineView } from '@/lib/engine/engineHost';
import { heldBuilds } from '@/tests/helpers/engineHost';
import { listItem, NOW, rankedList, recorded } from '@/tests/helpers/snapshots';
import type { RankingEvent } from '@/types/rankingEvents';

const LIST_ID = 'movies-1';
const IDS = ['a', 'b', 'c', 'd'];

function list(events: RankingEvent[]) {
  return rankedList({
    id: LIST_ID,
    originalItemIds: IDS,
    items: IDS.map((id) => listItem(id, LIST_ID, { title: id })),
    events: recorded(events),
  });
}

const answer: RankingEvent = {
  id: 'e1',
  listId: LIST_ID,
  createdAt: NOW,
  kind: 'pair',
  leftItemId: 'a',
  rightItemId: 'b',
  outcome: 'left',
};

afterEach(cleanup);

describe('useEngineView', () => {
  it('tells the host the view is shown when a ready one has rendered, and not before', async () => {
    const held = heldBuilds();
    const host = createEngineHost({ builder: held.builder, cache: createEngineCache(null) });
    const shown = vi.spyOn(host, 'viewShown');
    function Probe() {
      useEngineView(host);
      return null;
    }
    render(<Probe />);
    expect(shown).not.toHaveBeenCalled();

    // A history to restore: the view is "restoring" until the build is released.
    act(() => host.sync(list([answer])));
    expect(host.view()?.status).toBe('restoring');
    expect(shown).not.toHaveBeenCalled();

    await act(async () => {
      held.release();
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(host.view()?.status).toBe('ready');
    expect(shown).toHaveBeenCalled();
  });
});
