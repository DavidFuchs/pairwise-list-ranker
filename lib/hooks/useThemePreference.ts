import { useSyncExternalStore } from 'react';

import { THEME_STORAGE_KEY } from '@/lib/themeCss';

export type ThemePreference = 'system' | 'light' | 'dark';

export function readThemePreference(): ThemePreference {
  try {
    const saved = globalThis.localStorage?.getItem(THEME_STORAGE_KEY);
    return saved === 'light' || saved === 'dark' ? saved : 'system';
  } catch {
    return 'system';
  }
}

/**
 * Pins the document to a palette, or hands it back to the OS setting. The
 * stylesheet does the rest: `data-theme` overrides the media query.
 */
export function applyThemePreference(preference: ThemePreference): void {
  if (typeof document !== 'undefined') {
    switchWithoutTransitions(() => {
      if (preference === 'system') {
        document.documentElement.removeAttribute('data-theme');
      } else {
        document.documentElement.setAttribute('data-theme', preference);
      }
    });
  }

  try {
    if (preference === 'system') {
      globalThis.localStorage?.removeItem(THEME_STORAGE_KEY);
    } else {
      globalThis.localStorage?.setItem(THEME_STORAGE_KEY, preference);
    }
  } catch {
    // A blocked storage API only costs us the preference on the next visit.
  }

  for (const listener of listeners) listener();
}

/**
 * Swaps the palette in one frame. Buttons and panels ease their colours on
 * hover, and left running those transitions would walk every one of them
 * through an unreadable halfway colour on the way to the new theme.
 */
function switchWithoutTransitions(change: () => void): void {
  const root = document.documentElement;
  root.setAttribute('data-theme-switching', 'true');
  change();
  // Reading a style makes the browser apply the new colours now, while the
  // transitions are still off.
  void getComputedStyle(root).color;
  requestAnimationFrame(() => requestAnimationFrame(() => root.removeAttribute('data-theme-switching')));
}

// The OS switching between light and dark moves the 'system' palette too.
if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => {
    switchWithoutTransitions(() => {});
  });
}

const listeners = new Set<() => void>();

function subscribe(onChange: () => void): () => void {
  listeners.add(onChange);
  // Another tab changing the preference should move this one too.
  globalThis.addEventListener?.('storage', onChange);
  return () => {
    listeners.delete(onChange);
    globalThis.removeEventListener?.('storage', onChange);
  };
}

/**
 * The static build cannot know what the visitor chose, so the server snapshot
 * is always 'system'; React swaps in the real value right after hydration. The
 * pre-paint script in `app/+html.tsx` keeps the colours correct meanwhile, so
 * there is no flash.
 */
function getServerSnapshot(): ThemePreference {
  return 'system';
}

export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (next: ThemePreference) => void;
} {
  const preference = useSyncExternalStore(subscribe, readThemePreference, getServerSnapshot);

  return { preference, setPreference: applyThemePreference };
}
