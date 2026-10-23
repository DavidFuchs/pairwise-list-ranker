import { useMemo, useState } from 'react';

import type { ProgressLevel } from '@/lib/ranking/bt/progress';
import { describeProgress, levelFor, selectProgressState, type ProgressDisplay } from '@/lib/state/progress';
import type { ListItem } from '@/types/list';
import type { RankedList } from '@/types/source';

/**
 * The progress line for the open list (docs/ARCHITECTURE.md 6.12), or null when it has
 * nothing to say. The level it shows is remembered per list so a level does not
 * flicker at a boundary; a different list starts fresh.
 */
export function useProgress(
  list: RankedList | null,
  view: { status: string; ranked: readonly ListItem[]; disorder: number | null },
): ProgressDisplay | null {
  const [shown, setShown] = useState<{ listId: string; level: ProgressLevel | null }>({
    listId: '',
    level: null,
  });

  const ready = view.status === 'ready' ? view : null;
  const state = useMemo(
    () =>
      list === null || ready === null
        ? null
        : selectProgressState(
            list,
            ready.ranked.map((item) => item.id),
            ready.disorder,
          ),
    [list, ready],
  );

  const previous = list !== null && shown.listId === list.id ? shown.level : null;
  const level = state === null ? null : levelFor(state, previous);
  // Adjusting state while rendering is React's way to keep a value derived from the last one.
  if (list !== null && (shown.listId !== list.id || shown.level !== level)) {
    setShown({ listId: list.id, level });
  }
  return state === null ? null : describeProgress(state, level);
}
