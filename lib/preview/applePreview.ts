import { useEffect, useState, useSyncExternalStore } from 'react';

/**
 * The Apple Music storefront looked up first. Set EXPO_PUBLIC_APPLE_MUSIC_REGION
 * to a two-letter country code when building; it is compiled into the bundle.
 */
export const APPLE_MUSIC_REGION = (process.env.EXPO_PUBLIC_APPLE_MUSIC_REGION ?? 'CA').trim().toUpperCase() || 'CA';

/** Songs missing from one storefront are often in the US one. */
const FALLBACK_REGION = 'US';

const BATCH_SIZE = 150;

/** id -> preview URL, or null once every storefront has said there is none. */
const resolved = new Map<string, string | null>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let flushScheduled = false;

async function lookup(region: string, ids: string[]): Promise<Map<string, string>> {
  const found = new Map<string, string>();
  for (let start = 0; start < ids.length; start += BATCH_SIZE) {
    const chunk = ids.slice(start, start + BATCH_SIZE);
    const url = `https://itunes.apple.com/lookup?country=${region.toLowerCase()}&entity=song&id=${chunk.join(',')}`;
    try {
      const response = await fetch(url);
      if (!response.ok) continue;
      const body = (await response.json()) as { results?: { trackId?: number; previewUrl?: string }[] };
      for (const result of body.results ?? []) {
        if (result.trackId !== undefined && result.previewUrl) found.set(String(result.trackId), result.previewUrl);
      }
    } catch {
      // A failed lookup just means no play button for this batch.
    }
  }
  return found;
}

async function flush(): Promise<void> {
  flushScheduled = false;
  const ids = [...waiting.keys()];
  const callbacks = new Map(waiting);
  waiting.clear();

  const found = await lookup(APPLE_MUSIC_REGION, ids);
  if (APPLE_MUSIC_REGION !== FALLBACK_REGION) {
    const missing = ids.filter((id) => !found.has(id));
    if (missing.length > 0) {
      for (const [id, url] of await lookup(FALLBACK_REGION, missing)) found.set(id, url);
    }
  }

  for (const id of ids) {
    const url = found.get(id) ?? null;
    resolved.set(id, url);
    for (const callback of callbacks.get(id) ?? []) callback(url);
  }
}

/** Requests made in the same tick share one lookup, so a whole screen costs one call. */
export function requestPreviewUrl(id: string, onResolved: (url: string | null) => void): () => void {
  if (resolved.has(id)) {
    onResolved(resolved.get(id) ?? null);
    return () => undefined;
  }
  const callbacks = waiting.get(id) ?? [];
  callbacks.push(onResolved);
  waiting.set(id, callbacks);
  if (!flushScheduled) {
    flushScheduled = true;
    setTimeout(() => void flush(), 0);
  }
  return () => {
    const current = waiting.get(id);
    if (current !== undefined) waiting.set(id, current.filter((callback) => callback !== onResolved));
  };
}

/** undefined while looking, null when there is no preview. */
export function usePreviewUrl(id: string | undefined): string | null | undefined {
  // Keyed by id, so a card that swaps to a new item never shows the last one's preview.
  const [answer, setAnswer] = useState<{ id: string; url: string | null } | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    return requestPreviewUrl(id, (url) => setAnswer({ id, url }));
  }, [id]);

  if (id === undefined) return null;
  if (answer?.id === id) return answer.url;
  return resolved.get(id);
}

/* One shared audio element: starting a preview stops the one before it. */

let audio: HTMLAudioElement | null = null;
let playingId: string | null = null;
const listeners = new Set<() => void>();

function setPlaying(id: string | null): void {
  playingId = id;
  for (const listener of listeners) listener();
}

export function togglePreview(id: string, url: string): void {
  if (typeof Audio === 'undefined') return;
  if (audio === null) {
    audio = new Audio();
    audio.addEventListener('ended', () => setPlaying(null));
  }
  if (playingId === id) {
    audio.pause();
    setPlaying(null);
    return;
  }
  audio.src = url;
  setPlaying(id);
  audio.play().catch(() => setPlaying(null));
}

/** Silences any preview, e.g. when the card it belongs to is replaced. */
export function stopPreview(id: string): void {
  if (playingId !== id) return;
  audio?.pause();
  setPlaying(null);
}

export function useIsPlaying(id: string): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => playingId === id,
    () => false,
  );
}
