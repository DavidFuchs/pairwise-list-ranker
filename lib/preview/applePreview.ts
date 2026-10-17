/**
 * The Apple Music storefront looked up first. Set EXPO_PUBLIC_APPLE_MUSIC_REGION
 * to a two-letter country code when building; it is compiled into the bundle.
 */
export const APPLE_MUSIC_REGION =
  (process.env.EXPO_PUBLIC_APPLE_MUSIC_REGION ?? 'CA').trim().toUpperCase() || 'CA';

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
        if (result.trackId !== undefined && result.previewUrl)
          found.set(String(result.trackId), result.previewUrl);
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
export function requestApplePreview(id: string, onResolved: (url: string | null) => void): () => void {
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
    if (current !== undefined)
      waiting.set(
        id,
        current.filter((callback) => callback !== onResolved),
      );
  };
}
