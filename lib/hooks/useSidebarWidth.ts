import { useSyncExternalStore } from 'react';

export const SIDEBAR_WIDTH_STORAGE_KEY = 'pairwise-list-ranker:sidebar-width:v1';

/**
 * Wide enough for a ranked row to show its title and a line of detail without
 * truncating, and narrow enough that the comparison cards still sit side by
 * side next to it on a 1100px window. Much wider and the sidebar starts
 * competing with the stage for attention on an ordinary laptop screen.
 */
export const SIDEBAR_DEFAULT_WIDTH = 380;
/** Below this the preview tabs and export actions no longer fit on one row. */
export const SIDEBAR_MIN_WIDTH = 300;

export function readSidebarWidth(): number {
  try {
    const saved = Number(globalThis.localStorage?.getItem(SIDEBAR_WIDTH_STORAGE_KEY));
    return Number.isFinite(saved) && saved >= SIDEBAR_MIN_WIDTH ? Math.round(saved) : SIDEBAR_DEFAULT_WIDTH;
  } catch {
    return SIDEBAR_DEFAULT_WIDTH;
  }
}

/**
 * Stores the width the user dragged to, or forgets it when they reset to the
 * default, so a later change to the default still reaches them.
 */
export function saveSidebarWidth(width: number): void {
  try {
    if (Math.round(width) === SIDEBAR_DEFAULT_WIDTH) {
      globalThis.localStorage?.removeItem(SIDEBAR_WIDTH_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(width)));
    }
  } catch {
    // A blocked storage API only costs us the width on the next visit.
  }

  for (const listener of listeners) listener();
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  globalThis.addEventListener?.('storage', onChange);
  return () => {
    listeners.delete(onChange);
    globalThis.removeEventListener?.('storage', onChange);
  };
}

/** The static build cannot know the saved width, so it renders the default. */
function getServerSnapshot(): number {
  return SIDEBAR_DEFAULT_WIDTH;
}

export function useSidebarWidth(): { width: number; setWidth: (next: number) => void } {
  const width = useSyncExternalStore(subscribe, readSidebarWidth, getServerSnapshot);
  return { width, setWidth: saveSidebarWidth };
}
